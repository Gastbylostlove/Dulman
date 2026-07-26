# 기능 테스트 보고서 — 2026-07-26

**테스트 환경**

- Flutter 3.44.2 / Android API 34
- 에뮬레이터: Pixel 7 (Google Pixel 7 API 34)
- Supabase 프로젝트: `kfcfbqmriqcqyriisnof`
- 테스트 계정: 2개 (사용자 A / 사용자 B)

---

## 완료한 테스트

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| 1 | 회원가입 — 사용자 A | ✅ | LoginId·닉네임 입력, 계정 생성 성공 |
| 2 | 회원가입 — 사용자 B | ✅ | 동일 절차 |
| 3 | 로그인 — 사용자 A | ✅ | 로그인 후 초대코드 화면 진입 확인 |
| 4 | 로그인 — 사용자 B | ✅ | 동일 절차 |
| 5 | 채팅 생성 (A) | ✅ | waiting 상태 채팅 생성, 초대코드 발급 |
| 6 | 초대코드 입력 (B→A) | ✅ | B가 A의 코드 입력, 채팅방 #10 active 전환 |
| 7 | 메시지 전송 (B→A) | ✅ | "Hello" 전송, A 수신 확인 |
| 8 | 미디어 업로드 (보관) | ✅ | 이미지 파일 업로드, 채팅방 버블 표시 확인 |
| 9 | 앱 재시작 후 채팅방 재진입 | ✅ | BUG-014 수정 후 active 채팅방으로 올바르게 이동 확인 |

---

## 완료하지 못한 테스트

| # | 항목 | 상태 |
|---|------|------|
| 1 | 미디어 열람 (버블 탭 → 이미지/영상 표시) | ❌ 미완료 |
| 2 | 열람 횟수 소진 후 재열람 차단 확인 | ❌ 미완료 |
| 3 | `replay_once` 타입 미디어 두 번째 열람 | ❌ 미완료 |

---

## 완료하지 못한 이유

### Supabase DB 마이그레이션 미적용

미디어 열람은 다음 흐름으로 동작한다.

```
버블 탭
  → Edge Function `access-media` 호출
    → DB RPC `access_media` / `prepare_media_access`
      → Storage signed URL 발급
        → 미디어 표시
```

이 흐름에 필요한 DB 함수·RLS 정책이 아래 6개 마이그레이션 파일에 담겨 있으나,
프로덕션 DB에 적용되지 않은 상태다.

| 파일 | 주요 내용 |
|------|----------|
| `20260723130000_fix_media_security.sql` | `access_media` TOCTOU 경쟁 조건 수정 (FOR UPDATE) |
| `20260725100000_fix_remaining_review_blockers.sql` | `authorize_media_upload`, `prepare_media_access`, `send_media_message` 신규/교체 |
| `20260725200000_restore_storage_insert_rls.sql` | Storage INSERT RLS 복구 (`media_upload_signed_only`) |
| `20260726153000_clarify_chat_self_join.sql` | `join_chat`: 셀프조인 전용 에러코드 `CHAT_SELF_JOIN` 추가 |
| `20260726170000_android_staging_validation.sql` | `join_chat` 재확인 (스테이징 검증용) |
| `20260726180000_fix_sender_media_view_count.sql` | 발신자 열람은 `view_count` 미차감 처리 |

**적용 시도 결과**

| 방법 | 결과 |
|------|------|
| `npx supabase link` → `db push` | 토큰 권한 부족 (org-level 필요) |
| Management API `POST /v1/projects/.../database/query` | `"Your account does not have the necessary privileges"` |
| `psql db.[ref].supabase.co` | DNS 미해석 (신규 인프라) |
| `psql` pooler | ENOTFOUND |

→ Supabase Dashboard SQL Editor에서 직접 실행 필요. SQL은 아티팩트로 제공.

---

## 코드 수정 내용과 이유

### BUG-014 — `getActiveChat` 정렬 우선순위 오류

**파일:** `frontend/lib/core/api_client.dart` (L16–31)

**증상**

사용자 B가 자신의 채팅(A)을 먼저 만든 후(`status='waiting'`),
A의 초대코드로 다른 채팅에 참여(`status='active'`)했을 때
앱을 재시작하면 `active` 채팅방이 아닌 자신의 `waiting` 채팅 초대코드 화면으로 이동.

**원인**

`getActiveChat()` 쿼리가 `created_at DESC` 단일 정렬이었음.
B의 `waiting` 채팅이 더 최근에 만들어졌으므로 `active` 채팅보다 먼저 반환됨.

**수정**

```dart
// 변경 전
.order('created_at', ascending: false)

// 변경 후
.order('status', ascending: true)    // 'active' < 'waiting' 알파벳 순
.order('created_at', ascending: false)
```

`'active'`가 `'waiting'`보다 알파벳 앞에 오므로, `status ASC` 정렬 시
`active` 채팅이 항상 먼저 반환된다.
같은 상태가 여러 개인 경우에는 최신 순으로 정렬된다.

**검증**

수정 후 APK 재빌드·재설치 → 앱 재시작 시 `active` 채팅방(`#10`)으로 정상 이동 확인.
