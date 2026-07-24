-- Fix: user_account 보안 강화
-- 1. 사용하지 않는 password_hash 컬럼 제거 (Supabase Auth가 인증 담당)
-- 2. 클라이언트의 직접 UPDATE 권한 제거
-- 3. current_device_id 갱신은 SECURITY DEFINER RPC를 통해서만 허용

-- 1. password_hash 제거
ALTER TABLE user_account DROP COLUMN IF EXISTS password_hash;

-- 2. 직접 UPDATE 권한 회수
REVOKE UPDATE ON user_account FROM authenticated;

-- 3. UPDATE 정책 제거 (직접 UPDATE를 허용하지 않으므로 불필요)
DROP POLICY IF EXISTS user_account_update_own ON user_account;

-- 4. 기기 ID 등록/교체 전용 RPC
--    새 기기에서 로그인 시 호출 → current_device_id를 갱신해 단일 기기 세션 추적
CREATE OR REPLACE FUNCTION public.update_device_id(p_device_id text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
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

  UPDATE user_account
  SET current_device_id = trim(p_device_id)
  WHERE auth_user_id = v_auth_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_device_id(text) TO authenticated;
REVOKE ALL ON FUNCTION public.update_device_id(text) FROM anon;
