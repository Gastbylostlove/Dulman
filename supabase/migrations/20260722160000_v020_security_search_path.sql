ALTER FUNCTION public.current_login_id()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.consume_rate_limit(text, text, integer, integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_chat()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.join_chat(text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.send_text_message(bigint, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.mark_chat_read(bigint, bigint)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_chat(bigint)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.leave_chat(bigint)
  SET search_path = public, pg_temp;
