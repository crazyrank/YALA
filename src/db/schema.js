/**
 * SQLite schema — deliberately mirrors the Postgres schema exactly
 * (Build Spec Section 17, locked decision). Same column names. Enums
 * become TEXT with CHECK constraints since SQLite has no native enum type.
 *
 * A `device_meta` table (not present server-side) tracks the local
 * per-device sequence_no counter, since that has to persist across app
 * restarts and survive until a full reinstall.
 */

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS students (
    id              TEXT PRIMARY KEY,
    admission_no    TEXT UNIQUE NOT NULL,
    full_name       TEXT NOT NULL,
    date_of_birth   TEXT,
    gender          TEXT,
    division        TEXT NOT NULL CHECK (division IN ('primary','secondary')),
    class_level     TEXT NOT NULL,
    arm             TEXT,
    guardian_name   TEXT,
    guardian_phone  TEXT,
    status          TEXT NOT NULL DEFAULT 'registered'
      CHECK (status IN ('registered','active','promoted','graduated','transferred','withdrawn','expelled','archived')),
    sync_version    INTEGER NOT NULL DEFAULT 1,
    registered_by   TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    -- local-only bookkeeping, not present server-side:
    local_dirty     INTEGER NOT NULL DEFAULT 0,   -- 1 if there are unsynced local changes
    merged_notice_pending INTEGER NOT NULL DEFAULT 0  -- 1 if this record was merged server-side and hasn't been shown yet
  );`,

  `CREATE TABLE IF NOT EXISTS student_photos (
    id                 TEXT PRIMARY KEY,
    student_id         TEXT NOT NULL,
    local_uri          TEXT,
    storage_url        TEXT,
    is_current         INTEGER NOT NULL DEFAULT 1,
    uploaded_at        TEXT NOT NULL,
    synced             INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS sync_operations (
    id                TEXT PRIMARY KEY,      -- local rowid equivalent
    operation_id      TEXT UNIQUE NOT NULL,  -- the idempotency key sent to the server
    op_type           TEXT NOT NULL CHECK (op_type IN ('create_student','edit_student','upload_photo','promote_student')),
    entity_id         TEXT NOT NULL,
    payload           TEXT NOT NULL,          -- JSON-encoded
    sequence_no       INTEGER NOT NULL,
    created_at_client TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','synced','conflicted','failed')),
    last_attempt_at   TEXT,
    error_code        TEXT,   -- e.g. 'ADMISSION_NUMBER_COLLISION' (added post-launch, see index.js migration)
    error_message     TEXT    -- human-readable reason the server rejected this op
  );`,

  `CREATE TABLE IF NOT EXISTS notifications_cache (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    body        TEXT,
    category    TEXT,
    status      TEXT NOT NULL DEFAULT 'unread',
    created_at  TEXT NOT NULL
  );`,

  // Local-only device bookkeeping — NOT mirrored server-side.
  `CREATE TABLE IF NOT EXISTS device_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );`,
];

export const DEVICE_META_KEYS = {
  DEVICE_FINGERPRINT: 'device_fingerprint',
  NEXT_SEQUENCE_NO: 'next_sequence_no',
  ACCESS_TOKEN: 'access_token', // mirrored to SecureStore too; this is a cache
};
