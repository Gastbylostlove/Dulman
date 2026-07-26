# Bug History

| ID | 날짜 | 커밋 | 파일 | 한줄 요약 |
|----|------|------|------|-----------|
| [BUG-011](patterns.md#bug-011-대기-애니메이션--소프트웨어-렌더러-cpu-과점유) | 2026-07-26 | a6b62d8 | onboarding_screen.dart | 무기한 회전 애니메이션과 lavapipe 조합 → 에뮬레이터 CPU 과점유 |
| [BUG-010](patterns.md#bug-010-항상-null-반환-함수의-반환값으로-분기) | 2026-07-26 | 356a68e | splash_screen.dart, auth_provider.dart | 항상 null인 반환값으로 분기 → 도달 불가능한 코드 |
| [BUG-001](patterns.md#bug-001-async-initstate--네비게이션-후-코드-계속-실행) | 2026-07-26 | 356a68e | onboarding_screen.dart | addListener가 navigate 이후 등록 → 이중 탐색 |
| [BUG-008](patterns.md#bug-008-마이그레이션에서-rls-정책-삭제-후-대체-없음) | 2026-07-25 | 826caa9 | 20260725200000_restore_storage_insert_rls.sql | RLS DROP 후 대체 정책 없음 → Storage 업로드 개방 |
| [BUG-004](patterns.md#bug-004-edge-function-json-파싱-try-catch-누락) | 2026-07-25 | 826caa9 | access-media/index.ts | JSON 파싱 try-catch 누락 → 500 에러 |
| [BUG-002](patterns.md#bug-002-메인-스레드-동기-파일-io) | 2026-07-25 | 826caa9 | chat_room_screen.dart | File.lengthSync() 메인 스레드 호출 → UI 프리징 |
| [BUG-007](patterns.md#bug-007-scrollcontrollerhasclients-미확인) | 2026-07-23 | 6c111f2 | chat_room_screen.dart | hasClients 미확인 → StateError |
| [BUG-006](patterns.md#bug-006-db-캐시-fire-and-forget) | 2026-07-23 | 6c111f2 | chat_provider.dart | 캐시 fire-and-forget + stale 덮어쓰기 |
| [BUG-005](patterns.md#bug-005-비핵심-작업-실패가-핵심-흐름-차단) | 2026-07-23 | 6c111f2 | auth_provider.dart | _updateDeviceId 실패가 로그인 전체 차단 |
| [BUG-003](patterns.md#bug-003-rpc-toctou-레이스--미디어-조회-횟수) | 2026-07-23 | 6c111f2 | 20260723130000_fix_media_security.sql | access_media RPC TOCTOU 레이스 → 1회 제한 우회 |
| [BUG-009](patterns.md#bug-009-drift-lazydatabase-ensureopen-순서-오류) | 2026-07-23 | (이전 세션) | local_database.dart | Drift ensureOpen 순서 오류 → 앱 크래시 |
