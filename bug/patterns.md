# Bug Patterns

---

## [BUG-001] async initState — 네비게이션 후 코드 계속 실행

**증상:** 화면 전환 후 같은 화면이 한 번 더 열리거나 화면 스택이 꼬임

**원인:** async 함수에서 `_goToChat()` 호출 후 `return` 없이 아래 코드가 계속 실행됨.
리스너가 등록된 직후 Realtime 이벤트가 오면 이미 떠난 화면에서 `_goToChat()` 재호출.

**수정:**

```dart
chat.addListener(_onChatStateChange); // 리스너는 navigate 이전에 등록
if (chat.state == ChatState.active) {
  _goToChat();
  return; // navigate 후 즉시 종료
}
```

**재발 위험:** `initState` / `addPostFrameCallback` 안의 모든 async 함수.
navigate 호출 이후 반드시 `return` 또는 `if (!mounted) return` 확인.

**파일:** `frontend/lib/screens/onboarding_screen.dart`
**커밋:** 356a68e | **픽스:** 2026-07-26

---

## [BUG-002] 메인 스레드 동기 파일 I/O

**증상:** 미디어 전송 시 UI 프리징 (특히 대용량 파일)

**원인:** `File.lengthSync()`를 메인 스레드에서 호출.

**수정:**

```dart
// 수정 전
final size = File(f.path).lengthSync();

// 수정 후
final size = await File(f.path).length();
// 여러 파일은 Future.wait으로 병렬 처리
final fileInfos = await Future.wait(files.map((f) async { ... }));
```

**재발 위험:** `*Sync` 접미사 메서드 전반 (`readAsBytesSync`, `statSync` 등).
Flutter에서 파일·네트워크 I/O는 반드시 async.

**파일:** `frontend/lib/screens/chat_room_screen.dart` (`_sendMedia`)
**커밋:** 826caa9 | **픽스:** 2026-07-25

---

## [BUG-003] RPC TOCTOU 레이스 — 미디어 조회 횟수

**증상:** `once` 타입 미디어를 두 명이 동시에 열면 둘 다 볼 수 있음 (1회 제한 우회)

**원인:** `access_media` RPC에서 `view_count` 확인(READ)과 증가(WRITE) 사이에
다른 세션이 끼어들 수 있었음.

**수정:**

```sql
SELECT m.* INTO v_message
FROM public.message m
...
FOR UPDATE OF m; -- 행 잠금으로 동시 접근 차단
```

**재발 위험:** "확인 후 변경" 패턴의 모든 RPC. 카운터·플래그 업데이트 시
`FOR UPDATE` 또는 단일 `UPDATE ... RETURNING` 패턴 사용.

**파일:** `supabase/migrations/20260723130000_fix_media_security.sql`
**커밋:** 6c111f2 | **픽스:** 2026-07-23

---

## [BUG-004] Edge Function JSON 파싱 try-catch 누락

**증상:** 잘못된 요청 바디(malformed JSON) 전송 시 500 에러 반환

**원인:** `await request.json()`이 try-catch 밖에 있어 파싱 실패 시 unhandled exception.

**수정:**

```typescript
let messageId: number;
try {
  const body = await request.json();
  messageId = body?.message_id;
} catch {
  return json({ error: 'MESSAGE_INVALID' }, 400);
}
```

**재발 위험:** 모든 Edge Function의 request body 파싱. 외부 입력은 항상 try-catch 안에서.

**파일:** `supabase/functions/access-media/index.ts`
**커밋:** 826caa9 | **픽스:** 2026-07-25

---

## [BUG-005] 비핵심 작업 실패가 핵심 흐름 차단

**증상:** 네트워크 불안정 시 로그인 자체가 실패함

**원인:** `_updateDeviceId()` 에러가 catch 없이 위로 전파되어 `login()` 전체를 중단.

**수정:**

```dart
Future<void> _updateDeviceId([String? _]) async {
  if (_deviceId == null) return;
  try {
    await supabaseClient.rpc('update_device_id', ...);
  } catch (e) {
    Log.w('AUTH', 'device_id 업데이트 실패 (비차단): $e');
    // 실패해도 로그인은 계속 진행
  }
}
```

**재발 위험:** 로그인·인증 흐름 내 부가 작업(analytics, device 등록, 푸시 토큰 등).
핵심 흐름에 영향 없는 작업은 try-catch로 격리하고 로그만 남길 것.

**파일:** `frontend/lib/providers/auth_provider.dart`
**커밋:** 6c111f2 | **픽스:** 2026-07-23

---

## [BUG-006] DB 캐시 fire-and-forget

**증상:**

1. 캐시 저장 실패 시 에러가 완전히 무시됨
2. `resetChat()` 이후 in-flight 캐시 요청이 완료되면 리셋된 메시지가 다시 삽입됨

**원인:**

1. `_cacheMessages()`가 await 없이 호출되고 에러를 catch하지 않음
2. 캐시 세대(generation) 검사 없이 무조건 삽입

**수정:**

```dart
// _cacheMessages를 async로 변경, generation 가드 추가
Future<void> _cacheMessages(List<Message> msgs, int generation) async {
  for (final msg in msgs) {
    if (_cacheGeneration != generation) return; // stale write 차단
    try {
      await _localDb.cacheMessage(...);
    } catch (e) {
      Log.w('CHAT', 'cache write failed: $e');
    }
  }
}
```

**재발 위험:** 상태 리셋이 있는 모든 비동기 캐시 패턴. 리셋 후 in-flight 작업이
완료되면 리셋 이전 데이터가 다시 삽입될 수 있음.

**파일:** `frontend/lib/providers/chat_provider.dart`
**커밋:** 6c111f2 | **픽스:** 2026-07-23

---

## [BUG-007] ScrollController.hasClients 미확인

**증상:** 스크롤 이벤트 처리 중 `StateError: No positions are attached`

**원인:** `_scrollCtrl.position.pixels` 접근 시 컨트롤러에 아직 뷰가 붙지 않은 상태.

**수정:**

```dart
void _onScroll() {
  if (!_scrollCtrl.hasClients) return; // 가드 추가
  ...
}
```

**재발 위험:** `ScrollController`를 `initState`에서 생성하고 `build` 이전에 접근하는 모든 경우.
리스너 등록 후 첫 프레임 전에도 호출될 수 있음.

**파일:** `frontend/lib/screens/chat_room_screen.dart`
**커밋:** 6c111f2 | **픽스:** 2026-07-23

---

## [BUG-008] 마이그레이션에서 RLS 정책 삭제 후 대체 없음

**증상:** 인증된 사용자가 signed upload token 없이 Storage에 직접 업로드 가능

**원인:** `20260725100000` 마이그레이션이 `media_upload_participant` INSERT 정책을
`DROP`했지만 대체 정책을 추가하지 않음. Storage INSERT가 완전히 개방된 상태.

**수정:** 별도 마이그레이션(`20260725200000`)으로 `media_upload_intent` 레코드가
있는 경우에만 INSERT를 허용하는 정책 복구.

**재발 위험:** RLS 정책을 DROP할 때 반드시 대체 정책을 같은 마이그레이션에 포함.
"DROP만 하는 마이그레이션"은 권한 공백을 만들 수 있음.

**파일:** `supabase/migrations/20260725200000_restore_storage_insert_rls.sql`
**커밋:** 826caa9 | **픽스:** 2026-07-25

---

## [BUG-009] Drift LazyDatabase ensureOpen 순서 오류

**증상:** `Bad state: Tried to run an operation without first calling QueryExecutor.ensureOpen()`

**원인:** `beforeOpen` 콜백에서 `ensureOpen`을 먼저 호출하지 않고 DB 작업을 시도.
Drift 내부 상태 초기화 순서 문제.

**수정:**

```dart
@override
Future<void> beforeOpen(QueryExecutor executor, OpeningDetails details) async {
  await executor.ensureOpen(this); // 반드시 먼저 호출
  // 이후 마이그레이션 등 작업
}
```

**재발 위험:** Drift `QueryExecutorUser` 구현 시. `beforeOpen` 내부에서
executor를 사용하는 모든 작업 전에 `ensureOpen` 선행 필수.

**파일:** `frontend/lib/data/local_database.dart`
**커밋:** (이전 세션) | **픽스:** 2026-07-23

---

## [BUG-010] 항상 null 반환 함수의 반환값으로 분기

**증상:** 앱 재시작 시 기존 채팅이 있어도 온보딩 화면이 잠깐 깜빡임 (UX 플래시)

**원인:** `auth.init()`이 항상 `null`을 반환하도록 구현되어 있었으나,
반환 타입이 `Future<int?>`이어서 마치 값을 반환할 것처럼 보였음.
이를 믿고 작성한 `if (activeChatId != null)` 분기는 한 번도 실행되지 않음.

**수정:**

- `auth.init()` 반환 타입을 `Future<void>`로 변경
- 도달 불가능한 `ChatRoomScreen` 직행 분기 제거

**재발 위험:** 반환값을 실제로 사용하지 않으면서 의미있는 타입(`int?`, `String?`)을
선언하는 패턴. 반환값을 쓰지 않을 거라면 `void`로 선언할 것.

**파일:** `frontend/lib/screens/splash_screen.dart`, `frontend/lib/providers/auth_provider.dart`
**커밋:** 356a68e | **픽스:** 2026-07-26

---

## [BUG-011] 대기 애니메이션 — 소프트웨어 렌더러 CPU 과점유

**증상:** 초대코드 화면에서 상대방을 기다리는 동안 Android Emulator의
`qemu-system-aarch64` CPU 사용률이 600% 이상으로 유지됨.

**원인:** 대기 상태의 `CircularProgressIndicator`가 60fps 렌더링을 계속 요청하고,
AVD의 `auto` GPU 설정이 CPU 기반 `lavapipe` 렌더러로 선택되어 모든 프레임을 CPU에서 처리함.
상대방 상태 확인은 Supabase Realtime WebSocket이며 polling이나 반복 조회가 아니었음.

**수정:** Realtime 구독은 유지하고 대기 인디케이터만 정적
`Icons.hourglass_empty` 아이콘으로 교체함.

**재발 위험:** 종료 시점이 없는 대기 화면의 반복 애니메이션. 성능 측정 시 앱 프로세스와
에뮬레이터 프로세스를 구분하고 실제 AVD GPU 모드도 함께 확인할 것.

**파일:** `frontend/lib/screens/onboarding_screen.dart`
**커밋:** a6b62d8 | **픽스:** 2026-07-26

---

## [BUG-012] 발신자 열람이 수신자 조회 횟수를 소진

**증상:** `once` 미디어를 보낸 사람이 자기 메시지를 확인하면 `view_count`가 올라가
수신자가 첫 번째 열람에서 `열람 횟수를 초과했습니다.` 오류를 봄.

**원인:** `prepare_media_access`·`access_media` RPC가 발신자와 수신자를 구분하지 않고
모든 채팅 참여자의 열람을 동일한 `view_count`에 반영. 발신자 확인이 수신자 할당 횟수를 차감.
Flutter의 `withAccessedMediaUrls`도 발신자 화면에서 로컬 `viewCount`를 증가시켜
서버보다 먼저 잠김 상태로 전환될 수 있었음.

**수정:**

- RPC에서 `sender_id = v_login_id` 조건으로 발신자 열람을 횟수 제한·증가에서 제외
- Flutter 로컬 카운트도 발신자 열람 시 증가 안 함

**재발 위험:** 제한 횟수 카운터를 가진 모든 기능. 소유자(작성자)와 소비자(열람자)를
동일하게 처리하면 소유자가 자신의 콘텐츠를 확인하는 것만으로 제한에 걸릴 수 있음.

**파일:** `supabase/migrations/20260726180000_fix_sender_media_view_count.sql`, `frontend/lib/models/models.dart`
**커밋:** 7400413 | **픽스:** 2026-07-26

---

## [BUG-013] 초대코드 셀프조인 — 구분 불가 에러

**증상:** 자신의 초대코드로 참여 시도 시 서버가 에러를 반환하지만
클라이언트가 원인을 특정하지 못해 사용자에게 엉뚱한 메시지를 표시함.

**원인:** `join_chat` RPC가 셀프조인을 `CHAT_FULL`·`CHAT_NOT_FOUND` 등과 동일한
일반 에러로 처리해 클라이언트가 "방이 꽉 찼나? 코드가 틀렸나?"를 구분할 수 없었음.

**수정:**

```sql
IF v_chat.user_a_id = v_login_id THEN RAISE EXCEPTION 'CHAT_SELF_JOIN'; END IF;
```

전용 에러 코드 `CHAT_SELF_JOIN` 추가. 클라이언트에서 "자신의 코드입니다" 메시지로 분기.

**재발 위험:** 사용자가 의도치 않게 자신이 만든 리소스에 재진입할 수 있는 모든 API.
소유자 확인을 별도 에러 코드로 분리할 것.

**파일:** `supabase/migrations/20260726153000_clarify_chat_self_join.sql`, `frontend/lib/screens/onboarding_screen.dart`
**커밋:** 7400413 | **픽스:** 2026-07-26
