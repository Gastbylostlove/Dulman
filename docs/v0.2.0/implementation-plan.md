# Dulman v0.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the pre-release 1:1 chat app from Node.js/local PostgreSQL polling to Supabase-backed direct Flutter access with cursor pagination, local search groundwork, Realtime delivery, and read receipts. FCM remains configuration-only in this version.

**Architecture:** Supabase PostgreSQL remains the server source of truth. Flutter accesses Supabase directly through Supabase Auth, PostgREST, and Realtime; the old Node.js API is no longer used by the implemented text-chat path. Drift/SQLite provides the local message cache and FTS5 index. Media upload/access remains disabled until its private-storage authorization path is implemented. FCM has configuration slots only.

**Tech Stack:** Flutter/Dart, `supabase_flutter`, Drift/SQLite FTS5, Supabase CLI, Supabase PostgreSQL/RLS/Realtime/Edge Functions, Firebase Cloud Messaging for Android.

---

## 1. Scope and fixed decisions

### Included

- Keep the current 1:1 `chat.user_a_id`/`chat.user_b_id` model.
- Preserve the current table names where possible: `user_account`, `chat`, `message`, `media`, `chat_reset_log`.
- Replace in-memory message slicing with DB-level keyset pagination using `after_message_id`.
- Replace message and waiting-room polling with Supabase Realtime subscriptions.
- Add monotonic 1:1 read state through `chat_read_state`; do not create one row per message.
- Add Drift/SQLite cache and local FTS5 search.
- Use normalization plus 2–3 character N-grams for the MVP; do not add a server-side Korean morphological analyzer yet.
- Reserve FCM for Android background/terminated notifications. Do not include message body text in notifications.
- Use Supabase Edge Functions or an equivalent trusted boundary for future privileged media and FCM work.
- Remove the Node.js runtime only after media parity and the remaining smoke tests pass.

### Explicitly excluded

- Group chat or `chat_members` migration.
- Read receipts per message row.
- E2EE claims or encryption redesign.
- Server-side search API.
- iOS push setup in the Android MVP. The design must remain compatible with FCM/APNs later.

### Decision gate before code migration

The user-facing credential remains the arbitrary `login_id`. Supabase Auth uses a deterministic internal email alias such as `<login_id>@auth.dulman.invalid` only as its identity key; the alias is never shown to users and email confirmation/reset flows are not part of this MVP. The linked project's email confirmation is disabled through CLI config because the alias does not have a real mailbox. The `user_account.login_id` value remains the application identity used by chat rows and RLS mapping. Login IDs are restricted to `^[A-Za-z0-9._-]{3,64}$` before alias generation.

### Implementation status at this checkpoint

- Done: linked Supabase project `kfcfbqmriqcqyriisnof` and applied schema, RLS, rate-limit RPCs, security grants, and Realtime publication migrations.
- Done: Supabase Auth `login_id` mapping, direct text-chat RPCs, keyset message reads, read-state RPC, Realtime subscription, and sender-side `읽음` display.
- Done: Drift/SQLite database with an FTS5 cache table and FCM configuration-only constants.
- Pending: private media upload/access RPCs and Storage policy, full offline sync/search UI, negative RLS integration tests, and Node.js retirement.
- Environment limitation: `supabase db lint` requires a running Docker daemon; remote security advisors were run instead.

## 2. Current implementation evidence

| Area | Current behavior | Evidence |
| --- | --- | --- |
| Pagination | Repository loads all messages; service filters and slices in JS | `backend/src/db/postgres.js:157`, `backend/src/service.js:218` |
| Client polling | 3-second waiting and message timers | Previous implementation; replaced in `frontend/lib/providers/chat_provider.dart` |
| Local cache | Messages existed only in `_messages` memory list | Previous implementation; Drift cache is now in `frontend/lib/data/local_database.dart` |
| Search | No search implementation or SQLite dependency | `frontend/pubspec.yaml:9` |
| Schema | Current database is 1:1 `chat` plus `message` | `backend/db/schema.sql:9` |
| Media | Node.js currently proxies S3 upload/download | `backend/src/server.js:92` |
| Read receipt | No read-state table or API | Previous implementation; now `chat_read_state` and `mark_chat_read` |

## 3. Target data contracts

### 3.1 Message pagination

Keep the existing query names and response shape:

```text
GET /messages?chat_id=:chat_id&after_message_id=:after_message_id&limit=:limit
```

The Supabase query must apply the cursor before returning rows:

```sql
SELECT *
FROM message
WHERE chat_id = :chat_id
  AND id > :after_message_id
  AND (:last_reset_at IS NULL OR created_at > :last_reset_at)
ORDER BY id ASC
LIMIT :limit;
```

Media is queried only for the returned message IDs. The client stores the highest received message ID as the next cursor.

### 3.2 Read receipt

Add one row per user and chat:

```sql
CREATE TABLE chat_read_state (
  chat_id bigint NOT NULL,
  user_id varchar(64) NOT NULL,
  last_read_message_id bigint NOT NULL DEFAULT 0,
  read_at timestamptz NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);
```

No foreign keys are added, matching the existing project rule. The update is monotonic:

```sql
UPDATE chat_read_state
SET last_read_message_id = GREATEST(last_read_message_id, :message_id),
    read_at = now()
WHERE chat_id = :chat_id AND user_id = :user_id;
```

If the row does not exist, insert it. The client sends the highest message actually displayed, not merely downloaded. A sender's message is shown as read when it is at or below the partner's `last_read_message_id`.

The implemented client path is a Supabase RPC rather than a Node HTTP endpoint:

```text
rpc mark_chat_read(p_chat_id := 123, p_message_id := 456)
```

The receipt update is delivered to the other participant through Realtime.

### 3.3 Push notification configuration

FCM is deferred. This version only provides configuration slots and does not add the Firebase SDK, token registration, Edge Function, webhook, or notification permission flow.

```text
FCM project ID
FCM sender ID
Android app ID
FCM server credential reference
```

The configuration file must contain empty or development-safe values only. No service credential is committed. Future FCM work will store the registration token server-side and send only generic notifications without message content.

## 4. Security baseline

Security is a release gate. The Flutter client is untrusted; client-side checks are for UX only. Authorization, rate limits, media access, and privileged writes must be enforced by Supabase policies or server-side functions.

### 4.1 Authentication and secrets

- Use Supabase Auth sessions. Do not keep passwords, service-role keys, FCM credentials, or AWS credentials in Flutter, `pubspec.yaml`, the repository, or public app configuration.
- Flutter may contain only the Supabase publishable key. `service_role`, FCM service-account credentials, and AWS signing credentials belong in Supabase secrets or the provider's secret store.
- Never log access tokens, refresh tokens, FCM tokens, message content, search tokens, media URLs, or raw authorization headers.
- Rotate leaked or suspected credentials immediately and verify that old credentials no longer work.
- `current_device_id` is recorded for device management, but this checkpoint does not claim complete single-device session invalidation. A server-verified device/session claim is required before restoring that policy.

### 4.2 RLS and authorization

- Enable RLS on every application table exposed through Supabase.
- `user_account`: a user can select/update only the row mapped to `auth.uid()`.
- `chat`: a user can select/update only a chat where the mapped login ID equals `user_a_id` or `user_b_id`.
- `message`: a user can select only messages in a chat they participate in; inserts must force `sender_id` to the authenticated user and must reject client-supplied sender changes.
- `media`: a user can read metadata only for messages in a participating active chat. `once`/`replay_once` view-count changes and URL issuance must be atomic server-side operations, never a client-side `UPDATE`.
- `chat_read_state`: a user can upsert only their own row and can read read-state rows only for a chat they participate in.
- `realtime.messages`: a private channel subscription is allowed only when the authenticated user participates in the chat ID encoded in the channel topic.
- `push_token` is not present in v0.2.0 because FCM registration is deferred. Add it only with the token-registration task and matching RLS policy.
- Add a negative RLS test for every table using an authenticated non-participant and an unauthenticated client.

### 4.3 Rate limiting and abuse controls

RLS prevents unauthorized access but does not prevent an authorized user from abusing a valid endpoint. Apply both provider-level and application-level controls:

| Operation | Initial application limit | Required behavior |
| --- | ---: | --- |
| Login/signup | Supabase Auth limits plus project monitoring | Return a generic failure; do not reveal whether an account exists |
| Invite-code failures | 5 failures per 5 minutes per account/device/IP | Reuse the existing `CHAT_INVITE_RATE_LIMITED` behavior |
| Chat creation | 10 attempts per hour per user | Reject before creating rows |
| Text messages | 60 accepted inserts per 5 minutes per user/chat | Reject with a retryable rate-limit response |
| Media upload intents | 20 requests per 5 minutes per user/chat | Check file count, MIME type, and declared size before issuing URLs |
| Read receipts | 120 updates per minute per user/chat | Client debounces updates; server keeps the cursor monotonic |
| Push-token updates | 10 updates per hour per user | Replace the token; do not append unlimited tokens |

Implement limits at the trusted boundary used by the write operation. For message, media-intent, read-state, chat-create, and chat-join writes:

- Deny direct PostgREST `INSERT`/`UPDATE`/`DELETE` access from the client.
- Accept writes through a small `SECURITY DEFINER` RPC or Edge Function that derives the user from `auth.uid()`, checks chat participation, consumes the fixed limit, and performs the write atomically.
- Keep the rate-limit state private:

```sql
CREATE TABLE security_rate_limit (
  operation text NOT NULL,
  subject_key text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL,
  PRIMARY KEY (operation, subject_key, window_start)
);
```

`subject_key` is derived inside the trusted function from the authenticated user and, where applicable, the chat ID. Clients cannot choose a different user or raise a limit. Store only the minimum counters needed for the fixed window and expire old counters. Return `429`-equivalent behavior without exposing internal counters.

### 4.4 DDoS and traffic exhaustion

- Do not treat RLS or application rate limiting as DDoS protection. Supabase's edge/network protections are the first layer; project quotas and connection limits must be monitored.
- Do not expose a replacement public Node.js server just to handle traffic limiting.
- Bound every request: message length, query limit, media count, MIME type, file size, and upload URL lifetime.
- Use client exponential backoff with a cap after network failures; never retry immediately in a tight loop.
- Keep Realtime channels private and subscribe only to the active chat. Remove subscriptions when leaving the screen.
- Run load tests only against a staging Supabase project with an explicit request rate and stop threshold. A unit test cannot prove DDoS resistance.
- Configure alerts for Auth failures, database errors, Realtime connection saturation, Edge Function errors, storage egress, and rate-limit rejections.

### 4.5 Media and content security

- Keep the future media bucket private. Generate object keys server-side; never accept arbitrary bucket keys or public URLs from the client.
- Use short-lived signed upload/access URLs and verify chat participation before issuing them.
- Enforce the documented media limits: 20 MB per photo, 200 MB per video, and 500 MB total per send request, unless the product policy is changed first.
- Allow only the supported MIME types and derive the object extension from the validated MIME type.
- Do not trust client-provided file names, content types, or sizes. Re-check the uploaded object before making it available.
- Preserve `once`/`replay_once`/`keep` limits in one atomic server-side operation to prevent concurrent double access.

### 4.6 Logging, privacy, and supply chain

- Log event type, user identifier hash or internal ID, chat ID, result code, and latency; never log message bodies, media URLs, tokens, or secrets.
- Keep audit events for authentication failures, RLS denials, media access, account/session changes, rate-limit blocks, and privileged function failures.
- Keep dependency lockfiles. Run `npm audit --omit=dev` for the Node transition period and review Flutter dependency changes before adding them.
- Scan diffs for secrets before commit and ensure `.env`, Firebase credentials, Supabase service keys, and AWS keys are ignored.

### 4.7 Security acceptance tests

- Unauthenticated reads and writes fail.
- An authenticated non-participant cannot read, insert, update, or delete another chat's rows.
- A participant cannot change `sender_id`, `chat_id`, `view_count`, `last_read_message_id` for another user, or another user's push token.
- Repeated invite failures, message sends, media-intent requests, and read updates hit the documented limits and recover after the window expires.
- A signed media URL cannot be reused after expiry or used for another chat/object.
- Concurrent media access cannot exceed `once`/`replay_once` limits.
- No secret, token, message body, or media URL appears in application logs or committed files.
- Realtime subscriptions are private and are removed when the chat screen is disposed.

## 5. File map

### Create

- `supabase/config.toml` — local Supabase CLI configuration.
- `supabase/migrations/*_v020_schema.sql` — target schema, indexes, read state, token fields, RLS, and rate-limit prerequisites. Create it with `supabase migration new v020_schema`.
- `frontend/lib/core/supabase_client.dart` — one Supabase client entry point.
- `frontend/lib/core/supabase_config.dart` — project URL and publishable-key configuration.
- `frontend/lib/core/push_config.dart` — future FCM project/configuration slots; no active push integration.
- `frontend/lib/data/local_database.dart` — Drift database and FTS5 table definition.

### Modify

- `frontend/pubspec.yaml` — add `supabase_flutter`, `drift`, and `sqlite3_flutter_libs`; do not add `firebase_messaging` in v0.2.0.
- `frontend/lib/main.dart` — initialize Supabase and Drift. FCM is not initialized.
- `frontend/lib/providers/auth_provider.dart` — replace custom HTTP auth with Supabase Auth.
- `frontend/lib/providers/chat_provider.dart` — replace timers with repository sync/Realtime subscriptions and read cursor updates.
- `frontend/lib/core/api_client.dart` — use Supabase RPC/PostgREST for the implemented text-chat path; media methods remain an explicit disabled boundary.
- `frontend/lib/screens/chat_room_screen.dart` — search UI, read-state reporting, and removal of the false E2EE label.
- `frontend/android/app/src/main/AndroidManifest.xml` — Android notification permission/channel configuration.
- `docs/prd.md` — update the source architecture, Realtime, read receipt, push, and retention policy after implementation decisions are finalized.

### Retire after verification

- `backend/src/server.js`
- `backend/src/service.js`
- `backend/src/db/postgres.js`
- `backend/src/store.js`
- `backend/db/schema.sql`
- `backend/src/request-validation.js`
- `backend/test/*` old HTTP/API tests, after equivalent Supabase/RLS tests exist

## 6. Execution tasks

### Task 1: Supabase CLI project and local database

**Files:** `supabase/config.toml`, `supabase/migrations/*`

- [x] Authenticate CLI, create/link the `dulman` project, and apply the migrations.
- [x] Add the target schema without changing the 1:1 chat model.
- [x] Add `chat_read_state`, `user_account.auth_user_id`, indexes, private `security_rate_limit`, trusted functions, and security grants.
- [ ] Verify locally with `supabase db reset` and `supabase db lint` after Docker is available.

### Task 2: Supabase Auth and RLS

**Files:** `supabase/migrations/*`, `frontend/lib/core/supabase_client.dart`, `frontend/lib/providers/auth_provider.dart`, auth screens

- [x] Configure email/password Auth for the Android MVP with email confirmation disabled for the internal alias.
- [x] Create the `user_account` mapping row after Auth signup.
- [x] Replace custom JWT storage and refresh calls with Supabase Auth session handling.
- [x] Add RLS policies and deny direct client writes to message/read-state tables; text/read writes use approved RPCs.
- [ ] Add a negative RLS test for a non-participant attempting to read another chat.
- [x] Run Flutter analysis/tests and remote security advisors.

### Task 3: Cursor pagination and local cache

**Files:** `frontend/lib/data/local_database.dart`, `frontend/lib/core/api_client.dart`, `frontend/lib/providers/chat_provider.dart`

- [x] Define a Drift/SQLite message cache and FTS5 search table.
- [x] Implement ascending cursor reads and merge pages by message ID.
- [x] Query media only for returned message IDs.
- [ ] Persist sync cursor/read-state metadata and add repository-level pagination tests.

### Task 4: Realtime messages and read receipts

**Files:** `frontend/lib/core/api_client.dart`, `frontend/lib/providers/chat_provider.dart`, `frontend/lib/screens/chat_room_screen.dart`, `supabase/migrations/*`

- [x] Subscribe to Realtime changes for active-chat message, chat-status, and read-state events.
- [ ] Insert each received message into Drift before notifying the UI.
- [x] Subscribe to `chat_read_state` changes for the active chat.
- [x] Submit the monotonic read cursor after the rendered message list advances.
- [x] Display `읽음` for sent messages at or below the partner's read cursor.
- [ ] Run a two-client manual check: B reads through message 7, and A sees messages 1–7 as read.

### Task 5: FCM configuration only

**Files:** `frontend/lib/core/push_config.dart`, `frontend/test/push_config_test.dart`

- [x] Add empty configuration fields for Firebase project ID, sender ID, Android app ID, and credential reference.
- [x] Keep the configuration non-secret; the app starts without Firebase credentials.
- [ ] Do not add Firebase dependencies, Android Firebase files, push-token storage, webhooks, or notification handlers in v0.2.0.

### Task 6: Search

**Files:** `frontend/lib/data/local_database.dart`, `frontend/lib/screens/chat_room_screen.dart`

- [ ] Normalize text with lowercase conversion, whitespace compression, NFC normalization, and the agreed repeated-character rule.
- [ ] Generate 2–3 character N-grams locally and store them as one whitespace-separated FTS5 field.
- [ ] Search FTS5 candidates locally, then verify the normalized original text to remove N-gram false positives.
- [ ] Add the AppBar search mode, highlighted results, and result-to-message scrolling.
- [ ] Test Korean partial matches, exact matches, empty queries, and messages containing only media.

### Task 7: S3 path and Node.js retirement

**Files:** `frontend/lib/core/api_client.dart`, `backend/*`, `supabase/migrations/*`

- [ ] Implement private Supabase Storage (or S3) upload/access RPCs before re-enabling media.
- [ ] Keep media access authorization server-side and preserve `once`/`replay_once`/`keep` behavior.
- [x] Confirm the implemented auth/text/read path has no calls to `/api/*`; media retains disabled compatibility methods.
- [ ] Stop the Node.js runtime locally and run the Supabase-backed Flutter smoke flow.
- [ ] Remove old backend code only after the smoke flow and equivalent tests pass.

### Task 8: Documentation and policy gate

**Files:** `docs/prd.md`, `docs/v0.2.0/search-query.md`, `docs/v0.2.0/open-question.md`

- [ ] Update the architecture and API descriptions to match Supabase direct access.
- [ ] Document cursor pagination with `after_message_id`, read receipts, Realtime, FCM, and the Android-only MVP scope.
- [ ] Remove the `chat_members` migration proposal from the implementation contract.
- [ ] Resolve the retention choice before implementing account deletion: minimum, 1-year balanced, or 3-year evidence-preservation policy.
- [ ] Publish the privacy policy and consent copy before release; include chat/media storage, retention, external processors, push tokens, and user rights.
- [x] Replace the `E2EE 보호 중` UI copy with wording consistent with the actual security model.

## 7. Validation gates

Run the narrowest check after each task, then the full release check:

```bash
supabase db reset
supabase db lint
cd backend && npm test
cd ../frontend && flutter test
```

Manual acceptance criteria:

- A user cannot query a chat they do not participate in.
- 51 messages are retrieved in two cursor pages without loading all rows.
- Realtime delivers a new online message without a timer.
- The app builds and starts with empty FCM configuration.
- Read state moves forward only and appears on the sender's message.
- FTS5 search works for messages already inserted into the local cache; search UI and N-gram normalization remain pending.
- No implemented auth/text/read path calls the retired Node.js API; media compatibility methods fail closed until storage is implemented.

Current verification: `flutter test` passed; `flutter analyze` reports only pre-existing/deprecation-level info; remote Realtime publication contains `chat`, `message`, and `chat_read_state`. `supabase db lint` remains pending until Docker is running.

## 8. Items intentionally not hardcoded yet

- Retention duration and account-deletion purge timing require a product/legal decision.
- FCM/APNs transport and notification delivery are deferred until the push integration task is explicitly started.
- Korean morphological analysis is deferred until N-gram search quality is measured.
- Supabase plan limits are not treated as architecture requirements; monitor actual usage after deployment.
