# 발신자 미디어 열람 횟수 오차

`once`와 `replay_once` 미디어에서 발신자의 자체 확인이 수신자 열람 횟수까지 소진시키는 문제를 기록한다.

상태: 로컬 코드 수정 및 회귀 검증 완료. Supabase staging migration/function 배포 후 최종 확인 필요.

## 증상

- 발신자가 보낸 제한 미디어를 확인하면 `view_count`가 증가한다.
- 수신자는 실제로 열람하지 않았는데 `열람 횟수 초과`를 본다.
- 디바이스에 따라 동일한 실패가 `미디어 열람 실패` 또는 원시 `FunctionException`으로 표시된다.

## 원인

최종 `prepare_media_access`와 `access_media` RPC가 메시지 발신자와 현재 사용자를 구분하지 않았다. 제한 미디어의 모든 참여자 열람을 같은 `view_count`에 반영했기 때문에 발신자의 확인이 수신자에게 할당된 열람 횟수를 차감했다.

Flutter의 `withAccessedMediaUrls`도 성공한 모든 열람을 로컬 `viewCount`에 더해 발신자 화면이 서버 상태보다 먼저 잠길 수 있었다.

오류 표시 차이는 서버가 반환한 `MEDIA_VIEW_LIMIT_EXCEEDED`를 모든 빌드가 동일한 사용자 메시지로 변환하지 못한 데서 발생했다. 최신 코드에서는 Edge Function 오류의 `message`를 읽어 동일하게 `열람 횟수를 초과했습니다.`로 변환한다.

## 해결

- 발신자 열람은 제한 검사와 `view_count` 증가에서 제외한다.
- 수신자 열람만 `once` 1회, `replay_once` 2회 제한을 소비한다.
- Flutter 로컬 카운트도 발신자 열람에서는 증가시키지 않는다.
- 기존 Node 서버의 미디어 카운트도 같은 규칙으로 맞춘다.
- 기존 S3 업로드·다운로드 런타임 코드와 AWS SDK 의존성을 제거하고 Supabase Storage 경로만 유지한다.

## 검증 기준

- 발신자 확인 후 `once` 미디어의 서버 `view_count`가 0이다.
- 수신자의 첫 확인 후 `view_count`가 1이고, 두 번째는 제한 오류다.
- `replay_once`는 발신자 확인과 무관하게 수신자에게 2회 제공된다.
- 두 디바이스 모두 제한 오류를 동일한 사용자 메시지로 표시한다.
- staging 배포 후 동일한 초기 데이터에서 3회 연속 확인한다.
