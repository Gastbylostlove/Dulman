-- 20260725100000에서 media_upload_participant INSERT 정책을 삭제했으나
-- 대체 정책이 없어 인증된 사용자가 signed token 없이 media 버킷에 직접
-- 업로드 가능한 상태였음. 기본 경로 가드를 복구한다.
--
-- 정상 경로: Edge Function이 발급한 signed upload token으로 업로드.
-- 이 정책은 서비스 키 없이 bearer JWT만으로 직접 업로드하는 경우를 제한한다.
-- signed token 업로드는 이 정책의 적용을 받지 않는다.

CREATE POLICY media_upload_signed_only ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] ~ '^[0-9]+$'
  AND EXISTS (
    SELECT 1
    FROM public.media_upload_intent mui
    WHERE mui.storage_path = name
      AND mui.auth_user_id = auth.uid()
      AND mui.expires_at > now()
  )
);
