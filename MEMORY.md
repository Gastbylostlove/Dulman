# MEMORY.md

## 채팅 재시작 복구 메모

이 저장소에서 `flutter run` 이후 기존 채팅이 사라진 것처럼 보이거나, 대화 초기화/나가기 동작이 막히는 문제가 다시 나오면 아래를 먼저 확인한다.

- 앱 시작 시 `ChatProvider`에 `AuthProvider`의 토큰이 먼저 주입되어야 한다.
- `loadActiveChat()` 또는 `createChat()`보다 `chat.updateAuth(auth)`가 먼저 실행되어야 한다.
- 백엔드가 `DB_PROVIDER=postgres`로 떠 있는지 확인한다. 메모리 저장소면 서버 재시작 시 대화가 실제로 사라진다.
- `GET /api/chats/active`는 `status=active` 채팅만 복구한다. `waiting` 상태는 이 경로만으로는 복구되지 않는다.

### 재발 방지 체크

1. 앱 시작, 로그인 직후, 온보딩 진입 시 `chat.updateAuth(auth)`를 먼저 호출한다.
2. 채팅 복구 로직을 수정할 때는 active/waiting 상태를 구분한다.
3. 대화가 사라졌다고 보이면 먼저 backend 환경 변수와 DB 상태를 확인한다.

## 캡처 보호 재발 메모

이 저장소의 캡처 보호는 현재 `Android`의 `FLAG_SECURE` 중심 구현이다.

- 현재 기준으로는 `MainActivity` 네이티브 쪽에서 `FLAG_SECURE`를 건다.
- 이 프로젝트에는 `ios/` 네이티브 코드가 없으므로 iOS 캡처 차단은 여기서 해결되지 않는다.
- 이미지 뷰어를 별도 route로 열어도 같은 window 안에서만 보호가 유지된다. 다른 플랫폼이나 다른 캡처 경로는 별도 대응이 필요하다.
- 캡처 보호가 안 된다고 보이면 먼저 실제 실행 플랫폼이 Android인지, 그리고 보호 대상이 현재 `FlutterActivity`의 같은 window인지 확인한다.
- `MainActivity.kt` 같은 네이티브 변경을 반영할 때는 hot reload/hot restart로는 부족할 수 있으니, 앱을 완전히 종료하고 재설치한 뒤 확인한다.
- Android 캡처 검증은 시작 스플래시가 아니라 실제 `MainActivity` window가 떠 있는 상태에서 확인한다. 시작 스플래시는 따로 보일 수 있어서, 너무 이른 스크린샷은 false negative/false positive를 만든다.
- `adb shell dumpsys window windows`에서 `MainActivity` window의 `SECURE` 플래그와 현재 focus window를 같이 확인하면 캡처 보호 상태를 더 정확히 판별할 수 있다.
- `adb shell uiautomator dump`는 Flutter 화면에서 root node가 비거나 실패할 수 있으므로, 캡처 보호 검증 기준으로 쓰지 않는다.
