-- Fix: message_select_participant RLS에 last_reset_at 필터 추가
-- 클라이언트 Dart 코드에서만 적용되던 리셋 필터를 서버(RLS)로 이동
-- 이전에는 REST API 직접 호출 시 리셋 전 메시지가 노출되는 개인정보 유출 경로가 존재했음

DROP POLICY IF EXISTS message_select_participant ON message;

CREATE POLICY message_select_participant ON message
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM chat
    WHERE chat.id = message.chat_id
      AND (
        chat.user_a_id = current_login_id()
        OR chat.user_b_id = current_login_id()
      )
      AND (
        chat.last_reset_at IS NULL
        OR message.created_at > chat.last_reset_at
      )
  )
);
