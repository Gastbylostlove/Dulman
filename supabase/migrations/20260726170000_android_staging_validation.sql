-- Keep the invite failure reason observable for the staging validation matrix.
CREATE OR REPLACE FUNCTION public.join_chat(p_invite_code text)
RETURNS SETOF public.chat
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_login_id varchar(64) := public.current_login_id();
  v_chat public.chat;
BEGIN
  IF v_login_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF NOT public.consume_rate_limit('chat_join', v_login_id, 5, 300) THEN
    RAISE EXCEPTION 'CHAT_INVITE_RATE_LIMITED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.chat
    WHERE status = 'active' AND (user_a_id = v_login_id OR user_b_id = v_login_id)
  ) THEN
    RAISE EXCEPTION 'CHAT_ACTIVE_EXISTS';
  END IF;

  SELECT * INTO v_chat
  FROM public.chat
  WHERE invite_code = upper(trim(p_invite_code))
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'CHAT_INVITE_NOT_FOUND'; END IF;
  IF v_chat.status = 'ended' THEN RAISE EXCEPTION 'CHAT_NOT_ACTIVE'; END IF;
  IF v_chat.user_a_id = v_login_id THEN RAISE EXCEPTION 'CHAT_SELF_JOIN'; END IF;
  IF v_chat.user_b_id IS NOT NULL OR v_chat.status = 'active' THEN
    RAISE EXCEPTION 'CHAT_FULL';
  END IF;

  RETURN QUERY
  UPDATE public.chat
  SET user_b_id = v_login_id, status = 'active'
  WHERE id = v_chat.id
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.join_chat(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_chat(text) TO authenticated;
