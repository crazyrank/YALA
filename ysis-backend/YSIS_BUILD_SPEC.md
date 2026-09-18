# YALAMATRIX Student Information System (YSIS) — Full Build Specification

Owner: Samuel Sunday Rankin (LoneScripter). NYSC CDS project for Yalamatrix Schools, Okitipupa, Ondo State.
Stack: Expo (React Native) + SQLite on mobile, Express.js + PostgreSQL on server, JWT auth.
Status: Architecture, schema, and API fully designed. No code written yet. This document is the complete context needed to start implementation.

---

## 1. Philosophy

YSIS is an offline-first Student Information System. It must keep working with no internet while staying synchronized with a secure central database. Four pillars: security, reliability, performance, maintainability.

## 2. Core Architecture Principles (everything below traces back to these)

1. Offline first — every write completes on-device before any network call.
2. Local commit first — pressing save completes the operation; sync happens after, invisibly.
3. Automatic synchronization — operations sync (not raw tables), via a FIFO queue.
4. Server is source of truth — conflicts resolved against server state, never blind overwrite.
5. School owns student records, not individual teachers.
6. Never trust the client — all validation and authorization enforced server-side.
7. Everything important is auditable — append-only audit log.
8. Users and students are never hard-deleted — status lifecycles instead.
9. Human resolves conflicts — no automatic conflict resolution.
10. Secure by default — JWT + device trust + role middleware on every route.
11. Idempotency — every sync operation has a client-generated UUID so replays are safe.

## 3. User Hierarchy & Trust Model

```
Director (DB-seeded, no public registration)
   ↓ creates
Principal
   ↓ creates
Head Teacher
```

- No public registration anywhere. Every account is created by the role above it.
- Director: creates/disables Principals, resets Principal passwords, exceptional admin actions only, not involved in daily ops.
- Principal: creates Head Teachers, registers students (assigns admission numbers), promotes students, resolves conflicts and merge-queue items, manages permissions, views reports, resets Head Teacher passwords, corrects passport photos.
- Head Teacher: completes student records within assigned classes only, uploads passport photos, searches students within assigned scope. Cannot create users, manage roles, or change system settings.
- Trust never flows upward. No role creates a role above itself.

### Temporary permission delegation
Principal can grant a Head Teacher a specific permission (e.g. `PROMOTE_STUDENT`) for a stated duration with a mandatory reason. Auto-expires, no manual revocation needed (though early revocation is supported).

## 4. Authentication

- First login must be online: verifies credentials, registers device, downloads initial data, creates local SQLite DB.
- After first login: unlock via fingerprint or PIN, no daily password typing.
- New device always requires one fresh online authentication + device registration.
- JWT: 1hr access token + httpOnly refresh cookie. `sessionVersion` on user increments on new login; JWT carries version; mismatches are rejected (kills old sessions).
- Device trust checked on **every** request, not just login, so remote revocation is immediate.

## 5. Offline & Sync Model

- Student registration, editing, photo upload, search — all work fully offline.
- Every offline action creates a row in `sync_operations` before touching the real tables.
- Sync order is strict FIFO **per device**, enforced via a simple auto-incrementing integer `sequence_no` generated client-side (NOT timestamp-based — device clocks aren't trustworthy for ordering).
- Idempotency via client-generated `operation_id` (UUID) — duplicate submissions are no-ops.
- Large syncs happen in batches (`batch_id`); resumes from last successful batch on failure.
- Conflict detection is a deterministic DB-level check, not app-layer judgment: every edit/promote operation payload carries `based_on_version`; the server runs a conditional `UPDATE ... WHERE sync_version = based_on_version`. Zero rows affected → insert into `conflicts`, notify Principal.
- Offline status UI: **passive, generic marquee** only ("You have unsynced changes — connect when you can"), no live pending-count, no blocking banner during normal offline work.
- Conflict UI: **persistent AND blocking** on the Principal's dashboard — they cannot do other admin work until it's resolved.
- No push notifications for now (Expo push would be free but adds a token-management subsystem not yet justified — conflicts are rare and Principal opens the app daily anyway). In-app `notifications` table only.

## 6. Registration Workflow (two-step, Principal + Head Teacher)

1. Principal registers the student first: name + `admission_no` (Principal types every admission number personally — no auto-generation).
2. That record becomes visible to the Head Teacher assigned to that class once synced.
3. Head Teacher searches by name (scoped to their assigned classes only — see Section 8) and completes the rest of the record.
4. **Offline collision fallback**: if the Head Teacher's device hasn't yet received the Principal's pre-registration, the Head Teacher can manually key in the admission number (given verbally by the Principal) and create a full record independently. This produces two rows with different client-generated `id`s sharing the same `admission_no`.
   - This is NOT a `sync_version` conflict (different rows). It's a duplicate-insert collision caught by a UNIQUE constraint on `admission_no`, routed into a dedicated `admission_merge_queue` table (not the `conflicts` table — different problem shape).
   - Principal resolves: sees both records side by side, confirms same student, picks canonical `id`. Discarded record is hard-deleted (only case in the whole schema where a hard delete is correct, since it was never a real second student).
   - Head Teacher's device shows a "this record was merged" notice next time it opens that student — never a silent overwrite.

## 7. Passport Photos

- Exactly ONE photo per student, permanent once uploaded (locked down from an earlier "unlimited history" idea — deliberately simplified).
- Compressed at capture (not at sync time): resize to 400x400px, JPEG, target 30-60KB. Tuned for mid-range Android performance so thumbnail lists don't lag.
- Correction path exists but is gated: only the Principal can authorize a replacement, reason required, no formal Head-Teacher-request workflow (decided against as unnecessary process for a rare edge case). Principal replaces it directly.

## 8. Class Assignment & Search Scoping

- School structure: **Secondary** (JSS1, JSS2, JSS3, SS1, SS2, SS3) and **Primary** (KG stages, Primary 1–6). Captured as `division` + `class_level` on students.
- Head Teachers do NOT self-select which classes they work in. The Principal explicitly assigns classes per Head Teacher account.
- This assignment drives BOTH the UI (what's searchable) AND authorization (server-side enforced, not just hidden in UI) — a Head Teacher literally cannot register/edit/view a student outside their assigned classes.
- Search is scoped to the Head Teacher's assigned class(es) only, never school-wide.
- Search behavior: partial/substring match with ranking (not exact-prefix-only). Postgres: `pg_trgm` trigram similarity index on `full_name`. SQLite (offline): simple `LIKE '%query%'` is sufficient at school scale, no FTS5 needed. Ranking: matches near the start of the name outrank mid-string matches.

## 9. Password Recovery

No self-service reset (no email/SMS to depend on, and it would break the trust chain). Recovery runs through the same hierarchy as account creation:
- Head Teacher locked out → Principal resets it, in-app, must be online.
- Principal locked out → Director resets it, same mechanism.
- Director locked out → **out-of-band operational runbook only** (direct DB access or manual seed script), deliberately NOT an in-app feature — an in-app "recover the Director" path would be the single biggest hole in the trust model.

Flow: human verification happens outside the app (Principal confirms identity in person/phone) → Principal taps reset in-app → server generates temp credential, invalidates any prior unused token, shows the credential once on screen → Principal relays it verbally → Head Teacher logs in, forced to set a new password immediately (`must_change_password` flag) → token marked used, `audit_logs` entry written.

## 10. Data Lifecycle & Auditing

- Users: never deleted. States: ACTIVE → SUSPENDED → INACTIVE. History kept forever.
- Students: REGISTERED → ACTIVE → PROMOTED → (GRADUATED / TRANSFERRED / WITHDRAWN / EXPELLED) → ARCHIVED → eligible for deletion after 10 years → Principal decides → recycle bin → permanent deletion. Deletion is never automatic.
- `audit_logs` is append-only, enforced at the DATABASE level: `REVOKE UPDATE, DELETE ON audit_logs FROM app_user;` — so even a compromised backend can't rewrite history. Logs: login, failed login, registration, edit, promotion, permission grants, password resets, device registration, sync, conflict resolution. Each entry: user, device, time, action, result.

## 11. Backup & Disaster Recovery

- PostgreSQL is the source of truth. Automated daily full backups, encrypted, stored OFF the primary server (S3/R2/B2/GCS class storage), never co-located.
- Point-in-time recovery via WAL (Write-Ahead Logs) enabled — restore to within minutes of an incident, not just the last nightly backup.
- Retention: daily backups 30 days, weekly 6 months, monthly 5 years.
- Recovery objectives: **RPO 15 minutes** (max acceptable data loss), **RTO 4 hours** (max acceptable downtime).
- Backups tested monthly by actually restoring to a test environment and verifying users/students/photos/audit logs exist.
- Lost/damaged device before sync: device disabled remotely, Head Teacher continues from a newly registered device, school data intact (server remains source of truth).

---

## 12. Database Schema (PostgreSQL, full DDL)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TYPE user_role AS ENUM ('director', 'principal', 'head_teacher');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'inactive');
CREATE TYPE student_status AS ENUM (
  'registered', 'active', 'promoted', 'graduated',
  'transferred', 'withdrawn', 'expelled', 'archived'
);
CREATE TYPE division_type AS ENUM ('primary', 'secondary');
CREATE TYPE sync_op_type AS ENUM (
  'create_student', 'edit_student', 'upload_photo', 'promote_student'
);
CREATE TYPE sync_op_status AS ENUM ('pending', 'synced', 'conflicted', 'failed');
CREATE TYPE conflict_status AS ENUM ('open', 'resolved');
CREATE TYPE conflict_resolution AS ENUM ('restore', 'keep_deleted', 'manual_merge');
CREATE TYPE device_status AS ENUM ('trusted', 'revoked', 'pending_verification');
CREATE TYPE notification_status AS ENUM ('unread', 'read', 'archived');
CREATE TYPE merge_status AS ENUM ('open', 'resolved');

-- USERS, RBAC ------------------------------------------------------------

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  email           CITEXT UNIQUE NOT NULL,
  phone           TEXT,
  password_hash   TEXT NOT NULL,
  role            user_role NOT NULL,
  status          user_status NOT NULL DEFAULT 'active',
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  session_version INT NOT NULL DEFAULT 1,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role          user_role NOT NULL,
  permission_id INT NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role, permission_id)
);

CREATE TABLE user_permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id),
  permission_id  INT NOT NULL REFERENCES permissions(id),
  granted_by     UUID NOT NULL REFERENCES users(id),
  reason         TEXT NOT NULL,
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL,
  revoked_at     TIMESTAMPTZ
);

CREATE INDEX idx_user_permissions_active
  ON user_permissions (user_id, expires_at)
  WHERE revoked_at IS NULL;

-- DEVICES ------------------------------------------------------------

CREATE TABLE devices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id),
  device_name        TEXT,
  device_fingerprint TEXT NOT NULL,
  status             device_status NOT NULL DEFAULT 'pending_verification',
  registered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at       TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ,
  revoked_by         UUID REFERENCES users(id),
  UNIQUE (user_id, device_fingerprint)
);

-- CLASS ASSIGNMENTS ------------------------------------------------------------

CREATE TABLE head_teacher_class_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  division      division_type NOT NULL,
  class_level   TEXT NOT NULL,     -- 'JSS1', 'SS2', 'Primary 4', 'KG1', etc.
  arm           TEXT,               -- nullable, secondary only (Science/Arts/Commercial if used)
  assigned_by   UUID NOT NULL REFERENCES users(id),
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- STUDENTS ------------------------------------------------------------

CREATE TABLE students (
  id              UUID PRIMARY KEY,    -- NO server default — client-generated always, see note below
  admission_no    TEXT UNIQUE NOT NULL,
  full_name       TEXT NOT NULL,
  date_of_birth   DATE,
  gender          TEXT,
  division        division_type NOT NULL,
  class_level     TEXT NOT NULL,
  arm             TEXT,
  guardian_name   TEXT,
  guardian_phone  TEXT,
  status          student_status NOT NULL DEFAULT 'registered',
  sync_version    INT NOT NULL DEFAULT 1,
  registered_by   UUID NOT NULL REFERENCES users(id),
  registered_device_id UUID REFERENCES devices(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at     TIMESTAMPTZ,
  eligible_for_deletion_at TIMESTAMPTZ
);

CREATE INDEX idx_students_search_trgm ON students USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_students_class_scope ON students (division, class_level, arm);

-- NOTE on students.id: deliberately has NO DEFAULT. The Expo app generates
-- the UUID client-side (uuid.v4()) at the moment of creation, offline or
-- online. This guarantees the same student has the same ID everywhere,
-- since the ID has to exist before the record ever reaches the server.

-- STUDENT PHOTOS (exactly one per student, permanent) ------------------------------------------------------------

CREATE TABLE student_photos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         UUID NOT NULL REFERENCES students(id),
  storage_url        TEXT NOT NULL,
  uploaded_by        UUID NOT NULL REFERENCES users(id),
  uploaded_device_id UUID REFERENCES devices(id),
  is_current         BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by        UUID REFERENCES users(id),   -- NULL on normal first upload
  correction_reason  TEXT,                         -- required if approved_by is set
  uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_student_photos_one_current
  ON student_photos (student_id) WHERE is_current = TRUE;

-- ADMISSION MERGE QUEUE ------------------------------------------------------------

CREATE TABLE admission_merge_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_no   TEXT NOT NULL,
  record_a_id    UUID NOT NULL REFERENCES students(id),
  record_b_id    UUID NOT NULL REFERENCES students(id),
  status         merge_status NOT NULL DEFAULT 'open',
  resolved_by    UUID REFERENCES users(id),
  canonical_id   UUID REFERENCES students(id),
  discarded_id   UUID REFERENCES students(id),
  resolved_at    TIMESTAMPTZ,
  detected_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SYNC ------------------------------------------------------------

CREATE TABLE sync_operations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id      UUID UNIQUE NOT NULL,
  op_type           sync_op_type NOT NULL,
  entity_id         UUID NOT NULL,
  payload           JSONB NOT NULL,
  user_id           UUID NOT NULL REFERENCES users(id),
  device_id         UUID NOT NULL REFERENCES devices(id),
  status            sync_op_status NOT NULL DEFAULT 'pending',
  sequence_no       BIGINT NOT NULL,
  created_at_client TIMESTAMPTZ NOT NULL,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at      TIMESTAMPTZ,
  batch_id          UUID,
  error_message     TEXT
);

CREATE INDEX idx_sync_ops_pending_fifo
  ON sync_operations (device_id, sequence_no)
  WHERE status = 'pending';
CREATE INDEX idx_sync_ops_batch ON sync_operations (batch_id);

-- CONFLICTS (same-record disputed edits, distinct from merge queue) ------------------------------------------------------------

CREATE TABLE conflicts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_operation_id UUID NOT NULL REFERENCES sync_operations(id),
  student_id        UUID NOT NULL REFERENCES students(id),
  conflict_summary  TEXT NOT NULL,
  server_state      JSONB NOT NULL,
  incoming_change   JSONB NOT NULL,
  status            conflict_status NOT NULL DEFAULT 'open',
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by       UUID REFERENCES users(id),
  resolution        conflict_resolution,
  resolved_at       TIMESTAMPTZ
);

CREATE INDEX idx_conflicts_open ON conflicts (status) WHERE status = 'open';

-- AUDIT LOGS (append-only) ------------------------------------------------------------

CREATE TABLE audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id),
  device_id     UUID REFERENCES devices(id),
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     UUID,
  result        TEXT NOT NULL,
  metadata      JSONB,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs (user_id, occurred_at);

-- Run this as a separate admin step once the app's DB role exists:
-- REVOKE UPDATE, DELETE ON audit_logs FROM app_user;

-- NOTIFICATIONS ------------------------------------------------------------

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  body        TEXT,
  category    TEXT,
  related_entity_id UUID,
  status      notification_status NOT NULL DEFAULT 'unread',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ
);

CREATE INDEX idx_notifications_unread
  ON notifications (user_id) WHERE status = 'unread';

-- PASSWORD RESET ------------------------------------------------------------

CREATE TABLE password_reset_tokens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id),
  token_hash            TEXT NOT NULL,
  issued_by             UUID NOT NULL REFERENCES users(id),
  issued_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at            TIMESTAMPTZ NOT NULL,   -- 15-30 min window
  used_at               TIMESTAMPTZ,
  used_from_device_id   UUID REFERENCES devices(id),
  invalidated_at        TIMESTAMPTZ
);

CREATE INDEX idx_password_reset_active
  ON password_reset_tokens (user_id)
  WHERE used_at IS NULL AND invalidated_at IS NULL;
```

### Conflict detection query pattern (used by both `PATCH /students/:id` and the sync processor)

```sql
UPDATE students
SET class_level = $1,
    sync_version = sync_version + 1,
    updated_at = now()
WHERE id = $2
  AND sync_version = $3;   -- $3 = based_on_version from the client payload

-- If this returns 0 rows affected, insert a row into `conflicts` instead
-- of erroring out. That zero-rows result IS the conflict signal.
```

### Permission-check query pattern (for delegated permissions on synced/offline operations)

```sql
SELECT 1 FROM user_permissions
WHERE user_id = $1
  AND permission_id = $2
  AND revoked_at IS NULL
  AND $3 BETWEEN granted_at AND expires_at;
  -- $3 = created_at_client for synced ops, now() for live online requests
  -- revoked_at always checked against server time regardless — an explicit
  -- revocation wins immediately no matter what the device clock says
```

---

## 13. API Endpoint Reference

Base conventions: JWT in `Authorization: Bearer`, device_id claim checked against `devices.status = 'trusted'` on every request. All error responses: `{ "error": { "code": "...", "message": "human-readable, no raw IDs" } }`.

### Auth & Devices
- `POST /auth/login` — body `{email, password, deviceFingerprint}`. Verifies password, checks `users.status='active'`, registers device if new (`pending_verification`), bumps `session_version`. Returns `{accessToken, user}` + httpOnly refresh cookie. JWT claims: `userId, role, sessionVersion, deviceId`.
- `POST /auth/refresh` — reads refresh cookie, checks `session_version` match + device `trusted`, issues new access token.
- `POST /auth/logout` — clears refresh cookie, optionally bumps `session_version`.
- `POST /auth/reset-password` — body `{targetUserId}`. Auth: Principal (for Head Teacher target) or Director (for Principal target). Generates temp credential, stores hash, invalidates prior tokens, returns credential once. Writes audit log.
- `POST /auth/complete-reset` — body `{tempCredential, newPassword}`. Validates token, sets password, clears `must_change_password`, marks token used.

### Students
- `GET /students` — query `?division=&class_level=&arm=&status=&search=&page=`. Role-scoped via `head_teacher_class_assignments` for Head Teachers; unrestricted for Principal/Director. Use `.select()` to limit fields.
- `POST /students` — body includes client-generated `id` (required, reject if missing).
- `PATCH /students/:id` — body must include `based_on_version`. Runs the conditional-update pattern above; 0 rows → creates a `conflicts` row.
- `POST /students/:id/promote` — auth: Principal, or Head Teacher with an active `user_permissions` grant for `PROMOTE_STUDENT`.

### Sync
- `POST /sync` — body `{operations: [{operationId, opType, entityId, payload, sequenceNo, createdAtClient}]}`. Processed per-device in `sequenceNo` order. Idempotent on `operationId`. Response: `{results: [{operationId, status, conflictId?}]}`.

### Conflicts & Merge Queue
- `GET /conflicts` — query `?status=open`. Auth: Principal/Director only.
- `POST /conflicts/:id/resolve` — body `{resolution: 'restore'|'keep_deleted'|'manual_merge', notes?}`. Auth: Principal/Director only.
- `GET /admission-merge-queue` — query `?status=open`.
- `POST /admission-merge-queue/:id/resolve` — body `{canonicalId, discardedId}`. Hard-deletes the discarded row.

### Permissions
- `POST /permissions/delegate` — body `{userId, permissionCode, expiresInHours, reason}`. Auth: Principal only, `reason` required.
- `DELETE /permissions/delegate/:id` — early revocation. Auth: granting Principal or Director.

### Notifications
- `GET /notifications` — scoped to caller's `user_id`. Query `?status=unread`.
- `PATCH /notifications/:id` — body `{status: 'read'|'archived'}`.

### Devices
- `GET /devices` — Principal/Director view of all devices, or self-view.
- `DELETE /devices/:id` — revoke a device remotely (lost/damaged phone scenario).

### Status codes
- `400` bad payload (missing `based_on_version`, missing client `id`)
- `401` no/expired JWT
- `403` valid JWT, wrong role/permission (includes expired delegation)
- `404` not found or not visible to caller's scope
- `409` sync_version mismatch, or duplicate `operation_id` with conflicting payload
- `423` device not trusted (distinct from 401 — client should re-register, not re-login)
- `500` never leak stack traces/SQL to client, log server-side only

---

## 14. Security & Environment Config Decisions

- **Migrations**: `node-pg-migrate`. Closest to raw SQL, minimal translation needed, lighter than Prisma/Knex for this project's size.
- **Migration files**: grouped by phase, 4 files: (1) enums + auth + devices + class assignments, (2) students + photos + merge queue, (3) sync + conflicts, (4) audit + notifications + password reset.
- **Migration naming**: timestamp-prefixed (tool default), not manually numbered.
- **Enums**: defined once in the first migration file, reused everywhere (Postgres enums are DB-wide types).
- **Env files**: separate `.env.development` and `.env.production`. Given a prior real credential leak on GitHub (AllConnect project), production secrets must never share a file with dev secrets.
- **Production secrets**: live only on Render's dashboard, `.env.production` is never created on any local machine.
- **.gitignore**: `.env*` wildcard, not just `.env`.
- **JWT secrets**: two separate secrets, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
- **Password hashing**: bcrypt, 12 salt rounds (proven from prior projects; 12 balances security against Render's limited CPU on lower tiers).

## 15. Implementation Order

1. DB migrations, in dependency order: enums → users/permissions → devices → class assignments → students/photos → merge queue → sync/conflicts → audit/notifications/password reset.
2. Auth + devices (login, refresh, device registration/trust).
3. Audit logging middleware — build early, everything else depends on it.
4. Students CRUD, online path only, no sync yet.
5. Sync endpoint — hardest piece, build after students work normally online.
6. Conflicts + admission merge queue resolution.
7. Permissions delegation.
8. Notifications.
9. Password reset flow.
10. SQLite mirror + Expo sync client — mobile side last, once the server contract is stable and tested.

## 16. Still Open (unresolved, flagged for later)

- `sync_operations_archive`: separate table vs. partition by status/age — decide before sync endpoint hits real scale, not before initial build.
- Automated retention job (archive flip + Principal-approved recycle bin step) — not urgent, years away.
- Deployment specifics: hosting details, monitoring, uptime alerting — needed before production, not before local dev.

---

## 17. SQLite (Expo client) notes

- Schema mirrors Postgres exactly — same column names. Enums stored as TEXT with `CHECK` constraints (SQLite has no native enum type) enforcing the same allowed values.
- `sequence_no`: simple per-device auto-increment integer, persisted locally, survives app restarts, only resets on full reinstall. Never timestamp-derived.
- Photos: compress to 400x400px JPEG at capture time, before ever touching local storage.
- Offline UI: passive marquee only, generic message, no live pending-operation count.
