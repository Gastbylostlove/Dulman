# Bug Knowledge Base

## 파일 구성

| 파일 | 목적 | 읽는 시점 |
|------|------|-----------|
| `patterns.md` | 패턴별 버그 원인·수정·재발 위험 | 버그 진단 또는 위험 패턴 코드 작성 시 |
| `history.md` | 날짜·커밋 타임라인 인덱스 | 특정 버그가 언제 픽스됐는지 추적할 때만 |

## 패턴 요약 (상세 내용은 patterns.md)

- **BUG-001** async initState에서 네비게이션 후 코드 계속 실행 → 이중 탐색
- **BUG-002** 메인 스레드에서 동기 파일 I/O (`File.lengthSync`)
- **BUG-003** RPC read-then-write TOCTOU 레이스 (미디어 조회 횟수)
- **BUG-004** Edge Function JSON 파싱 try-catch 누락 → 500 에러
- **BUG-005** 비핵심 작업 실패가 로그인 전체를 차단
- **BUG-006** DB 캐시 fire-and-forget (에러 무시, stale 덮어쓰기)
- **BUG-007** ScrollController.hasClients 미확인 → StateError
- **BUG-008** 마이그레이션에서 RLS 정책 삭제 후 대체 정책 없음
- **BUG-009** Drift LazyDatabase ensureOpen 순서 오류
- **BUG-010** 항상 null을 반환하는 함수의 반환값으로 분기 → 도달 불가능한 코드
- **BUG-011** 무기한 회전 애니메이션 + lavapipe → CPU 과점유
- **BUG-012** 발신자 미디어 열람이 수신자 view_count 소진
- **BUG-013** 셀프조인 전용 에러 코드 없음 → 엉뚱한 오류 메시지
- **BUG-014** getActiveChat에서 waiting 채팅이 active보다 먼저 반환 → 채팅방 재진입 실패
