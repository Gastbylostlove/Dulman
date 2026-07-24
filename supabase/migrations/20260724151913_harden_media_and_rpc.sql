-- Complete the unresolved review fixes without rewriting applied migrations.

-- RLS policies call this helper, so authenticated needs EXECUTE on it.
REVOKE ALL ON FUNCTION public.current_login_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_login_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_chat()
RETURNS SETOF public.chat
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_login_id varchar(64) := public.current_login_id();
BEGIN
  IF v_login_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF NOT public.consume_rate_limit('chat_create', v_login_id, 10, 3600) THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.chat
    WHERE status = 'active' AND (user_a_id = v_login_id OR user_b_id = v_login_id)
  ) THEN
    RAISE EXCEPTION 'CHAT_ACTIVE_EXISTS';
  END IF;

  RETURN QUERY
  INSERT INTO public.chat (user_a_id, status, invite_code)
  VALUES (v_login_id, 'waiting', upper(encode(extensions.gen_random_bytes(6), 'hex')))
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_device_id(p_device_id text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 OR length(p_device_id) > 128 THEN
    RAISE EXCEPTION 'INVALID_DEVICE_ID';
  END IF;
  IF NOT public.consume_rate_limit('device_update', v_auth_user_id::text, 10, 3600) THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  UPDATE public.user_account
  SET current_device_id = trim(p_device_id)
  WHERE auth_user_id = v_auth_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_device_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_device_id(text) TO authenticated;

-- Storage accepts the largest supported file; send_media_message enforces per-MIME limits.
UPDATE storage.buckets
SET file_size_limit = 209715200,
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'
    ]
WHERE id = 'media';

DROP POLICY IF EXISTS media_upload_participant ON storage.objects;
CREATE POLICY media_upload_participant ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND EXISTS (
    SELECT 1 FROM public.chat
    WHERE chat.id::text = (storage.foldername(name))[1]
      AND chat.status = 'active'
      AND (
        chat.user_a_id = public.current_login_id()
        OR chat.user_b_id = public.current_login_id()
      )
  )
  AND metadata->>'mimetype' IN (
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'
  )
);

-- Keep media may use Storage directly. Limited media must go through access-media.
DROP POLICY IF EXISTS media_select_participant ON storage.objects;
CREATE POLICY media_select_participant ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND (
    owner_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.media md
      JOIN public.message msg ON msg.id = md.message_id
      JOIN public.chat c ON c.id = msg.chat_id
      WHERE md.url = storage.objects.name
        AND msg.permission_type = 'keep'
        AND (c.user_a_id = public.current_login_id() OR c.user_b_id = public.current_login_id())
        AND (c.last_reset_at IS NULL OR msg.created_at > c.last_reset_at)
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_url ON public.media (url);

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
  v_total_size bigint;
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
  IF p_media_items IS NULL OR jsonb_typeof(p_media_items) <> 'array' THEN
    RAISE EXCEPTION 'MESSAGE_INVALID';
  END IF;
  IF jsonb_array_length(p_media_items) = 0 THEN
    RAISE EXCEPTION 'MESSAGE_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_media_items) AS item
    LEFT JOIN storage.objects o
      ON o.bucket_id = 'media' AND o.name = item->>'storage_path'
    LEFT JOIN public.media existing ON existing.url = item->>'storage_path'
    WHERE item->>'storage_path' IS NULL
      OR split_part(item->>'storage_path', '/', 1) <> p_chat_id::text
      OR item->>'mime_type' IS NULL
      OR item->>'mime_type' NOT IN (
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'
      )
      OR o.id IS NULL
      OR o.owner_id::text IS DISTINCT FROM v_auth_user_id::text
      OR o.metadata->>'mimetype' IS DISTINCT FROM item->>'mime_type'
      OR COALESCE(o.metadata->>'size', '') !~ '^[0-9]+$'
      OR CASE
        WHEN COALESCE(o.metadata->>'size', '') ~ '^[0-9]+$' THEN
          (item->>'mime_type' LIKE 'image/%' AND (o.metadata->>'size')::bigint > 20971520)
          OR (item->>'mime_type' = 'video/mp4' AND (o.metadata->>'size')::bigint > 209715200)
        ELSE true
      END
      OR existing.id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'MESSAGE_INVALID';
  END IF;

  SELECT sum((o.metadata->>'size')::bigint)
  INTO v_total_size
  FROM jsonb_array_elements(p_media_items) AS item
  JOIN storage.objects o
    ON o.bucket_id = 'media' AND o.name = item->>'storage_path';
  IF v_total_size > 524288000 THEN
    RAISE EXCEPTION 'MESSAGE_INVALID';
  END IF;
  IF NOT public.consume_rate_limit('media_upload', v_login_id || ':' || p_chat_id, 20, 300) THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  INSERT INTO public.message (chat_id, sender_id, type, text_content, permission_type)
  VALUES (p_chat_id, v_login_id, 'media', p_text_content, p_permission_type)
  RETURNING * INTO v_message;

  INSERT INTO public.media (message_id, url, mime_type)
  SELECT v_message.id, item->>'storage_path', item->>'mime_type'
  FROM jsonb_array_elements(p_media_items) AS item;

  RETURN NEXT v_message;
END;
$$;

REVOKE ALL ON FUNCTION public.send_media_message(bigint, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_media_message(bigint, text, jsonb, text) TO authenticated;

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

  IF v_message.permission_type IN ('once', 'replay_once') THEN
    UPDATE public.message SET view_count = view_count + 1 WHERE id = p_message_id;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object('storage_path', url, 'mime_type', mime_type)
  )
  INTO v_media_items
  FROM public.media WHERE message_id = p_message_id;

  RETURN jsonb_build_object(
    'message_id', p_message_id,
    'media', COALESCE(v_media_items, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.access_media(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.access_media(bigint) TO authenticated;
