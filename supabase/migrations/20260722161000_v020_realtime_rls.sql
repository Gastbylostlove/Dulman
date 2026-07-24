CREATE POLICY private_chat_changes_select
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  topic ~ '^private-chat:[0-9]+$'
  AND EXISTS (
    SELECT 1
    FROM public.chat
    WHERE chat.id = (substring(topic from '[0-9]+$'))::bigint
      AND (chat.user_a_id = public.current_login_id()
        OR chat.user_b_id = public.current_login_id())
  )
);
