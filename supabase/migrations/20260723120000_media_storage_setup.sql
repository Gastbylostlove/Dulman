-- Fix: 미디어 저장소 활성화
-- 1. Supabase Storage private bucket 생성
-- 2. 채팅 참여자만 업로드/다운로드 허용 (Storage RLS)
-- 3. send_media_message, access_media RPC 추가

-- 1. Storage bucket (이미 존재하면 무시)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  false,
  52428800,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','video/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- 2a. 업로드 정책: active 채팅 참여자만, 경로 = {chatId}/{파일명}
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
);

-- 2b. 다운로드/서명된 URL 발급 정책: 채팅 참여자
CREATE POLICY media_select_participant ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND EXISTS (
    SELECT 1 FROM public.chat
    WHERE chat.id::text = (storage.foldername(name))[1]
      AND (
        chat.user_a_id = public.current_login_id()
        OR chat.user_b_id = public.current_login_id()
      )
  )
);

-- 3. 미디어 메시지 전송 RPC
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

-- 4. 미디어 열람 RPC (view_count 차감 + 스토리지 경로 반환)
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
  SELECT m.* INTO v_message
  FROM message m
  JOIN chat c ON c.id = m.chat_id
  WHERE m.id = p_message_id
    AND (c.user_a_id = v_login_id OR c.user_b_id = v_login_id);

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

GRANT EXECUTE ON FUNCTION public.send_media_message(bigint, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.access_media(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.send_media_message(bigint, text, jsonb, text) FROM anon;
REVOKE ALL ON FUNCTION public.access_media(bigint) FROM anon;
