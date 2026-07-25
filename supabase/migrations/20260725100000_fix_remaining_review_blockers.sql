-- Close the remaining media upload and access review blockers in a new migration.

DROP POLICY IF EXISTS media_upload_participant ON storage.objects;

-- Signed-upload authorization records are private and consumed once.
CREATE TABLE public.media_upload_intent (
  storage_path text PRIMARY KEY,
  chat_id bigint NOT NULL,
  auth_user_id uuid NOT NULL,
  item_index integer NOT NULL,
  mime_type varchar(128) NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  expires_at timestamptz NOT NULL
);

CREATE INDEX idx_media_upload_intent_owner_expiry
ON public.media_upload_intent (auth_user_id, expires_at);

ALTER TABLE public.media_upload_intent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.media_upload_intent FROM PUBLIC, anon, authenticated;

-- Validate declarations, rate-limit the request, and generate server-owned paths.
CREATE OR REPLACE FUNCTION public.authorize_media_upload(
  p_chat_id bigint,
  p_files jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_login_id varchar(64) := public.current_login_id();
  v_total_size numeric;
  v_intents jsonb;
BEGIN
  IF v_auth_user_id IS NULL OR v_login_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.chat
    WHERE id = p_chat_id
      AND status = 'active'
      AND (user_a_id = v_login_id OR user_b_id = v_login_id)
  ) THEN
    RAISE EXCEPTION 'CHAT_PARTICIPANT_REQUIRED';
  END IF;
  IF p_files IS NULL OR jsonb_typeof(p_files) <> 'array'
    OR jsonb_array_length(p_files) = 0 OR jsonb_array_length(p_files) > 10 THEN
    RAISE EXCEPTION 'MESSAGE_INVALID';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_files) AS item
    WHERE item->>'mime_type' IS NULL
      OR item->>'mime_type' NOT IN (
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'
    )
      OR jsonb_typeof(item->'byte_size') IS DISTINCT FROM 'number'
      OR COALESCE(item->>'byte_size', '') !~ '^[0-9]+$'
      OR CASE
        WHEN COALESCE(item->>'byte_size', '') ~ '^[0-9]+$' THEN
          (item->>'byte_size')::numeric <= 0
          OR (item->>'mime_type' LIKE 'image/%'
            AND (item->>'byte_size')::numeric > 20971520)
          OR (item->>'mime_type' = 'video/mp4'
            AND (item->>'byte_size')::numeric > 209715200)
        ELSE true
      END
  ) THEN
    RAISE EXCEPTION 'MESSAGE_INVALID';
  END IF;
  SELECT sum((item->>'byte_size')::numeric)
  INTO v_total_size
  FROM jsonb_array_elements(p_files) AS item;
  IF v_total_size > 524288000 THEN RAISE EXCEPTION 'MESSAGE_INVALID'; END IF;
  DELETE FROM public.media_upload_intent
  WHERE auth_user_id = v_auth_user_id AND expires_at <= now();
  IF NOT public.consume_rate_limit(
    'media_upload_intent',
    v_login_id || ':' || p_chat_id,
    20,
    300
  ) THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  WITH inserted AS (
    INSERT INTO public.media_upload_intent (
      storage_path,
      chat_id,
      auth_user_id,
      item_index,
      mime_type,
      byte_size,
      expires_at
    )
    SELECT
      p_chat_id || '/' || extensions.gen_random_uuid()::text || CASE item->>'mime_type'
        WHEN 'image/jpeg' THEN '.jpg'
        WHEN 'image/png' THEN '.png'
        WHEN 'image/gif' THEN '.gif'
        WHEN 'image/webp' THEN '.webp'
        WHEN 'video/mp4' THEN '.mp4'
      END,
      p_chat_id,
      v_auth_user_id,
      entry.position,
      item->>'mime_type',
      (item->>'byte_size')::bigint,
      now() + interval '1 minute'
    FROM jsonb_array_elements(p_files) WITH ORDINALITY AS entry(item, position)
    RETURNING storage_path, item_index, mime_type
  )
  SELECT jsonb_agg(
    jsonb_build_object('storage_path', storage_path, 'mime_type', mime_type)
    ORDER BY item_index
  )
  INTO v_intents
  FROM inserted;

  RETURN v_intents;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_media_upload(bigint, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_media_upload(bigint, jsonb) TO authenticated;

-- Publish only objects that match a live upload intent, then consume the intent.
CREATE OR REPLACE FUNCTION public.send_media_message(
  p_chat_id bigint,
  p_permission_type text,
  p_media_items jsonb,
  p_text_content text DEFAULT NULL
)
RETURNS SETOF public.message
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_login_id varchar(64) := public.current_login_id();
  v_chat public.chat;
  v_message public.message;
BEGIN
  SELECT * INTO v_chat FROM public.chat WHERE id = p_chat_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAT_NOT_FOUND'; END IF;
  IF v_login_id IS NULL OR (v_chat.user_a_id <> v_login_id AND v_chat.user_b_id <> v_login_id) THEN
    RAISE EXCEPTION 'CHAT_PARTICIPANT_REQUIRED';
  END IF;
  IF v_chat.status <> 'active' THEN RAISE EXCEPTION 'CHAT_NOT_ACTIVE'; END IF;
  IF p_permission_type NOT IN ('once', 'replay_once', 'keep') THEN
    RAISE EXCEPTION 'MESSAGE_INVALID';
  END IF;
  IF p_text_content IS NOT NULL AND length(p_text_content) > 4000 THEN
    RAISE EXCEPTION 'MESSAGE_INVALID';
  END IF;
  IF p_media_items IS NULL OR jsonb_typeof(p_media_items) <> 'array'
    OR jsonb_array_length(p_media_items) = 0 OR jsonb_array_length(p_media_items) > 10 THEN
    RAISE EXCEPTION 'MESSAGE_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_media_items) AS item
    LEFT JOIN public.media_upload_intent intent
      ON intent.storage_path = item->>'storage_path'
    LEFT JOIN storage.objects object
      ON object.bucket_id = 'media' AND object.name = item->>'storage_path'
    LEFT JOIN public.media existing
      ON existing.url = item->>'storage_path'
    WHERE intent.storage_path IS NULL
      OR intent.chat_id <> p_chat_id
      OR intent.auth_user_id IS DISTINCT FROM v_auth_user_id
      OR intent.mime_type IS DISTINCT FROM item->>'mime_type'
      OR intent.expires_at <= now()
      OR object.id IS NULL
      OR object.metadata->>'mimetype' IS DISTINCT FROM intent.mime_type
      OR COALESCE(object.metadata->>'size', '') !~ '^[0-9]+$'
      OR CASE
        WHEN COALESCE(object.metadata->>'size', '') ~ '^[0-9]+$' THEN
          (object.metadata->>'size')::bigint IS DISTINCT FROM intent.byte_size
        ELSE true
      END
      OR existing.id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'MESSAGE_INVALID';
  END IF;

  INSERT INTO public.message (chat_id, sender_id, type, text_content, permission_type)
  VALUES (p_chat_id, v_login_id, 'media', p_text_content, p_permission_type)
  RETURNING * INTO v_message;

  INSERT INTO public.media (message_id, url, mime_type)
  SELECT v_message.id, item->>'storage_path', item->>'mime_type'
  FROM jsonb_array_elements(p_media_items) AS item;

  DELETE FROM public.media_upload_intent
  WHERE storage_path IN (
    SELECT item->>'storage_path'
    FROM jsonb_array_elements(p_media_items) AS item
  );

  RETURN NEXT v_message;
END;
$$;

REVOKE ALL ON FUNCTION public.send_media_message(bigint, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_media_message(bigint, text, jsonb, text) TO authenticated;

-- Read-only authorization used before Storage signs limited-media URLs.
CREATE OR REPLACE FUNCTION public.prepare_media_access(p_message_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_login_id varchar(64) := public.current_login_id();
  v_message public.message;
  v_media_items jsonb;
BEGIN
  SELECT m.* INTO v_message
  FROM public.message m
  JOIN public.chat c ON c.id = m.chat_id
  WHERE m.id = p_message_id
    AND (c.user_a_id = v_login_id OR c.user_b_id = v_login_id)
    AND (c.last_reset_at IS NULL OR m.created_at > c.last_reset_at);

  IF NOT FOUND THEN RAISE EXCEPTION 'MESSAGE_NOT_FOUND'; END IF;
  IF v_message.type <> 'media' THEN RAISE EXCEPTION 'MESSAGE_INVALID'; END IF;
  IF v_message.permission_type = 'once' AND v_message.view_count >= 1 THEN
    RAISE EXCEPTION 'MEDIA_VIEW_LIMIT_EXCEEDED';
  END IF;
  IF v_message.permission_type = 'replay_once' AND v_message.view_count >= 2 THEN
    RAISE EXCEPTION 'MEDIA_VIEW_LIMIT_EXCEEDED';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object('storage_path', url, 'mime_type', mime_type)
    ORDER BY id
  )
  INTO v_media_items
  FROM public.media
  WHERE message_id = p_message_id;

  IF v_media_items IS NULL THEN RAISE EXCEPTION 'MESSAGE_INVALID'; END IF;
  RETURN jsonb_build_object('message_id', p_message_id, 'media', v_media_items);
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_media_access(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_media_access(bigint) TO authenticated;

-- Final atomic view consumption after every Storage URL has been signed.
CREATE OR REPLACE FUNCTION public.access_media(p_message_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_login_id varchar(64) := public.current_login_id();
  v_message public.message;
  v_media_items jsonb;
BEGIN
  SELECT m.* INTO v_message
  FROM public.message m
  JOIN public.chat c ON c.id = m.chat_id
  WHERE m.id = p_message_id
    AND (c.user_a_id = v_login_id OR c.user_b_id = v_login_id)
    AND (c.last_reset_at IS NULL OR m.created_at > c.last_reset_at)
  FOR UPDATE OF m;

  IF NOT FOUND THEN RAISE EXCEPTION 'MESSAGE_NOT_FOUND'; END IF;
  IF v_message.type <> 'media' THEN RAISE EXCEPTION 'MESSAGE_INVALID'; END IF;
  IF v_message.permission_type = 'once' AND v_message.view_count >= 1 THEN
    RAISE EXCEPTION 'MEDIA_VIEW_LIMIT_EXCEEDED';
  END IF;
  IF v_message.permission_type = 'replay_once' AND v_message.view_count >= 2 THEN
    RAISE EXCEPTION 'MEDIA_VIEW_LIMIT_EXCEEDED';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object('storage_path', url, 'mime_type', mime_type)
    ORDER BY id
  )
  INTO v_media_items
  FROM public.media
  WHERE message_id = p_message_id;
  IF v_media_items IS NULL THEN RAISE EXCEPTION 'MESSAGE_INVALID'; END IF;

  IF v_message.permission_type IN ('once', 'replay_once') THEN
    UPDATE public.message SET view_count = view_count + 1 WHERE id = p_message_id;
  END IF;

  RETURN jsonb_build_object('message_id', p_message_id, 'media', v_media_items);
END;
$$;

REVOKE ALL ON FUNCTION public.access_media(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.access_media(bigint) TO authenticated;
