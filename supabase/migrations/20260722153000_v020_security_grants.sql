-- SECURITY DEFINER functions must not remain executable by PUBLIC.
REVOKE ALL ON FUNCTION public.current_login_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_chat() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_chat() TO authenticated;

REVOKE ALL ON FUNCTION public.join_chat(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_chat(text) TO authenticated;

REVOKE ALL ON FUNCTION public.send_text_message(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_text_message(bigint, text) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_chat_read(bigint, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_chat_read(bigint, bigint) TO authenticated;

REVOKE ALL ON FUNCTION public.reset_chat(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_chat(bigint) TO authenticated;

REVOKE ALL ON FUNCTION public.leave_chat(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_chat(bigint) TO authenticated;
