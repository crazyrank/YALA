/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
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
  `);
  pgm.sql(`CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);`);
  pgm.sql(`CREATE INDEX idx_audit_logs_user ON audit_logs (user_id, occurred_at);`);

  // Append-only enforcement. The app's runtime DB role must never be able
  // to UPDATE or DELETE audit rows, even if the backend itself is
  // compromised. Replace `app_user` with your actual Neon/Render DB role.
  //
  // NOTE: this will fail harmlessly if the role doesn't exist yet in this
  // environment (e.g. fresh Neon default role). Run it manually later if so:
  //   REVOKE UPDATE, DELETE ON audit_logs FROM <your_db_user>;
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user) THEN
        EXECUTE format('REVOKE UPDATE, DELETE ON audit_logs FROM %I', current_user);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Non-fatal: some managed Postgres providers restrict REVOKE on the
      -- connecting role itself. Enforce this manually via the provider's
      -- dashboard/SQL console if this block is skipped.
      RAISE NOTICE 'Could not auto-revoke audit_logs write access, do this manually.';
    END $$;
  `);

  pgm.sql(`
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
  `);
  pgm.sql(`
    CREATE INDEX idx_notifications_unread ON notifications (user_id) WHERE status = 'unread';
  `);

  pgm.sql(`
    CREATE TABLE password_reset_tokens (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id               UUID NOT NULL REFERENCES users(id),
      token_hash            TEXT NOT NULL,
      issued_by             UUID NOT NULL REFERENCES users(id),
      issued_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at            TIMESTAMPTZ NOT NULL,
      used_at               TIMESTAMPTZ,
      used_from_device_id   UUID REFERENCES devices(id),
      invalidated_at        TIMESTAMPTZ
    );
  `);
  pgm.sql(`
    CREATE INDEX idx_password_reset_active
      ON password_reset_tokens (user_id)
      WHERE used_at IS NULL AND invalidated_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS password_reset_tokens;`);
  pgm.sql(`DROP TABLE IF EXISTS notifications;`);
  pgm.sql(`DROP TABLE IF EXISTS audit_logs;`);
};
