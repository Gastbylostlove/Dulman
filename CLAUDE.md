# Dulman — Claude 지침

## Bug Knowledge Base

`bug/CLAUDE.md`는 아래 상황에서만 읽을 것:

- 버그나 오류가 보고되거나 의심될 때
- 이전에 동작하던 기능이 갑자기 안 될 때
- 아래 코드 영역을 새로 작성하거나 수정할 때:
  - async + 네비게이션 (initState, addListener, pushReplacement)
  - Supabase Realtime 구독
  - 미디어 업로드 / 접근 (Edge Function, Storage)
  - 채팅 상태 관리 (ChatProvider, reset, cache)
  - SQL RPC / RLS 정책

아래 상황에서는 읽지 말 것:

- 버그 보고 없는 새 UI 작업
- SQL 마이그레이션 스키마 수정
- 텍스트·스타일 변경
