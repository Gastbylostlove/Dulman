-- 발신자의 미디어 확인은 수신자 열람 횟수에 포함하지 않는다.

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
  IF v_message.sender_id <> v_login_id
    AND v_message.permission_type = 'once'
    AND v_message.view_count >= 1 THEN
    RAISE EXCEPTION 'MEDIA_VIEW_LIMIT_EXCEEDED';
  END IF;
  IF v_message.sender_id <> v_login_id
    AND v_message.permission_type = 'replay_once'
    AND v_message.view_count >= 2 THEN
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
  IF v_message.sender_id <> v_login_id
    AND v_message.permission_type = 'once'
    AND v_message.view_count >= 1 THEN
    RAISE EXCEPTION 'MEDIA_VIEW_LIMIT_EXCEEDED';
  END IF;
  IF v_message.sender_id <> v_login_id
    AND v_message.permission_type = 'replay_once'
    AND v_message.view_count >= 2 THEN
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

  IF v_message.sender_id <> v_login_id
    AND v_message.permission_type IN ('once', 'replay_once') THEN
    UPDATE public.message SET view_count = view_count + 1 WHERE id = p_message_id;
  END IF;

  RETURN jsonb_build_object('message_id', p_message_id, 'media', v_media_items);
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_media_access(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_media_access(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.access_media(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.access_media(bigint) TO authenticated;
