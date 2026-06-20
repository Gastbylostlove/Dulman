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

- `ChatRoomScreen` 진입 시와 `MainActivity.onCreate()`에서만 `FLAG_SECURE`를 건다.
- 이 프로젝트에는 `ios/` 네이티브 코드가 없으므로 iOS 캡처 차단은 여기서 해결되지 않는다.
- 이미지 뷰어를 별도 route로 열어도 같은 window 안에서만 보호가 유지된다. 다른 플랫폼이나 다른 캡처 경로는 별도 대응이 필요하다.
- 캡처 보호가 안 된다고 보이면 먼저 실제 실행 플랫폼이 Android인지, 그리고 보호 대상이 현재 `FlutterActivity`의 같은 window인지 확인한다.
