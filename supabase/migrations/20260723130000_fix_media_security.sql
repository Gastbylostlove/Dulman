-- Fix: 미디어 보안 강화
-- 1. access_media: FOR UPDATE로 동시 열람 경쟁 조건(TOCTOU) 해소
-- 2. send_media_message: storage_path가 해당 채팅방 폴더에 속하는지 검증

-- 1. access_media: SELECT ... FOR UPDATE OF m 으로 행 락 후 view_count 체크
CREATE OR REPLACE FUNCTION public.access_media(p_message_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_login_id varchar(64) := current_login_id();
  v_message message;
  v_media_items jsonb;
BEGIN
  -- FOR UPDATE OF m: 동일 메시지에 대한 동시 access_media 호출을 직렬화
  -- 두 클라이언트가 동시에 once 미디어를 열람해도 한 번만 허용됨
  SELECT m.* INTO v_message
  FROM message m
  JOIN chat c ON c.id = m.chat_id
  WHERE m.id = p_message_id
    AND (c.user_a_id = v_login_id OR c.user_b_id = v_login_id)
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
    UPDATE message SET view_count = view_count + 1 WHERE id = p_message_id;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object('storage_path', url, 'mime_type', mime_type)
  )
  INTO v_media_items
  FROM media WHERE message_id = p_message_id;

  RETURN jsonb_build_object(
    'message_id', p_message_id,
    'media', COALESCE(v_media_items, '[]'::jsonb)
  );
END;
$$;

-- 2. send_media_message: storage_path 소유권 검증 추가
CREATE OR REPLACE FUNCTION public.send_media_message(
  p_chat_id bigint,
  p_permission_type text,
  p_media_items jsonb,  -- [{storage_path, mime_type}]
  p_text_content text DEFAULT NULL
)
RETURNS SETOF message
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_login_id varchar(64) := current_login_id();
  v_chat chat;
  v_message message;
BEGIN
  SELECT * INTO v_chat FROM chat WHERE id = p_chat_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHAT_NOT_FOUND'; END IF;
  IF v_login_id IS NULL OR (v_chat.user_a_id <> v_login_id AND v_chat.user_b_id <> v_login_id) THEN
    RAISE EXCEPTION 'CHAT_PARTICIPANT_REQUIRED';
  END IF;
  IF v_chat.status <> 'active' THEN RAISE EXCEPTION 'CHAT_NOT_ACTIVE'; END IF;
  IF p_permission_type NOT IN ('once', 'replay_once', 'keep') THEN
    RAISE EXCEPTION 'MESSAGE_INVALID';
  END IF;
  IF p_media_items IS NULL OR jsonb_array_length(p_media_items) = 0 THEN
    RAISE EXCEPTION 'MESSAGE_INVALID';
  END IF;

  -- storage_path는 반드시 '{p_chat_id}/' 로 시작해야 함
  -- 다른 채팅방 파일 경로를 삽입하는 공격 방지
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_media_items) AS item
    WHERE item->>'storage_path' IS NULL
       OR split_part(item->>'storage_path', '/', 1) <> p_chat_id::text
  ) THEN
    RAISE EXCEPTION 'MESSAGE_INVALID';
  END IF;

  IF NOT consume_rate_limit('message_send', v_login_id || ':' || p_chat_id, 60, 300) THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  INSERT INTO message (chat_id, sender_id, type, text_content, permission_type)
  VALUES (p_chat_id, v_login_id, 'media', p_text_content, p_permission_type)
  RETURNING * INTO v_message;

  INSERT INTO media (message_id, url, mime_type)
  SELECT v_message.id, item->>'storage_path', item->>'mime_type'
  FROM jsonb_array_elements(p_media_items) AS item;

  RETURN NEXT v_message;
END;
$$;

GRANT EXECUTE ON FUNCTION public.access_media(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_media_message(bigint, text, jsonb, text) TO authenticated;
REVOKE ALL ON FUNCTION public.access_media(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.send_media_message(bigint, text, jsonb, text) FROM anon;
