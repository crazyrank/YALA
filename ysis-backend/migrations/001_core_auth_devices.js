/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS "citext";`);
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`);

  // Enums are defined ONCE here and reused by every later migration,
  // since Postgres enums are database-wide types, not per-table.
  pgm.sql(`CREATE TYPE user_role AS ENUM ('director', 'principal', 'head_teacher');`);
  pgm.sql(`CREATE TYPE user_status AS ENUM ('active', 'suspended', 'inactive');`);
  pgm.sql(`CREATE TYPE student_status AS ENUM (
    'registered', 'active', 'promoted', 'graduated',
    'transferred', 'withdrawn', 'expelled', 'archived'
  );`);
  pgm.sql(`CREATE TYPE division_type AS ENUM ('primary', 'secondary');`);
  pgm.sql(`CREATE TYPE sync_op_type AS ENUM (
    'create_student', 'edit_student', 'upload_photo', 'promote_student'
  );`);
  pgm.sql(`CREATE TYPE sync_op_status AS ENUM ('pending', 'synced', 'conflicted', 'failed');`);
  pgm.sql(`CREATE TYPE conflict_status AS ENUM ('open', 'resolved');`);
  pgm.sql(`CREATE TYPE conflict_resolution AS ENUM ('restore', 'keep_deleted', 'manual_merge');`);
  pgm.sql(`CREATE TYPE device_status AS ENUM ('trusted', 'revoked', 'pending_verification');`);
  pgm.sql(`CREATE TYPE notification_status AS ENUM ('unread', 'read', 'archived');`);
  pgm.sql(`CREATE TYPE merge_status AS ENUM ('open', 'resolved');`);

  pgm.sql(`
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
  `);

  pgm.sql(`
    CREATE TABLE permissions (
      id          SERIAL PRIMARY KEY,
      code        TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL
    );
  `);

  pgm.sql(`
    CREATE TABLE role_permissions (
      role          user_role NOT NULL,
      permission_id INT NOT NULL REFERENCES permissions(id),
      PRIMARY KEY (role, permission_id)
    );
  `);

  pgm.sql(`
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
  `);
  pgm.sql(`
    CREATE INDEX idx_user_permissions_active
      ON user_permissions (user_id, expires_at)
      WHERE revoked_at IS NULL;
  `);

  pgm.sql(`
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
  `);

  pgm.sql(`
    CREATE TABLE head_teacher_class_assignments (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID NOT NULL REFERENCES users(id),
      division      division_type NOT NULL,
      class_level   TEXT NOT NULL,
      arm           TEXT,
      assigned_by   UUID NOT NULL REFERENCES users(id),
      assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`
    CREATE INDEX idx_hta_user ON head_teacher_class_assignments (user_id);
  `);

  // Seed baseline permissions used by delegation + promote checks
  pgm.sql(`
    INSERT INTO permissions (code, description) VALUES
      ('PROMOTE_STUDENT', 'Promote a student to the next class/level'),
      ('RESET_PASSWORD', 'Reset another user''s password'),
      ('MANAGE_CLASS_ASSIGNMENTS', 'Assign classes to Head Teachers');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS head_teacher_class_assignments;`);
  pgm.sql(`DROP TABLE IF EXISTS devices;`);
  pgm.sql(`DROP TABLE IF EXISTS user_permissions;`);
  pgm.sql(`DROP TABLE IF EXISTS role_permissions;`);
  pgm.sql(`DROP TABLE IF EXISTS permissions;`);
  pgm.sql(`DROP TABLE IF EXISTS users;`);
  pgm.sql(`DROP TYPE IF EXISTS merge_status;`);
  pgm.sql(`DROP TYPE IF EXISTS notification_status;`);
  pgm.sql(`DROP TYPE IF EXISTS device_status;`);
  pgm.sql(`DROP TYPE IF EXISTS conflict_resolution;`);
  pgm.sql(`DROP TYPE IF EXISTS conflict_status;`);
  pgm.sql(`DROP TYPE IF EXISTS sync_op_status;`);
  pgm.sql(`DROP TYPE IF EXISTS sync_op_type;`);
  pgm.sql(`DROP TYPE IF EXISTS division_type;`);
  pgm.sql(`DROP TYPE IF EXISTS student_status;`);
  pgm.sql(`DROP TYPE IF EXISTS user_status;`);
  pgm.sql(`DROP TYPE IF EXISTS user_role;`);
};
