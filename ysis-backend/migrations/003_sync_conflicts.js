/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
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
  `);
  pgm.sql(`
    CREATE INDEX idx_sync_ops_pending_fifo
      ON sync_operations (device_id, sequence_no)
      WHERE status = 'pending';
  `);
  pgm.sql(`CREATE INDEX idx_sync_ops_batch ON sync_operations (batch_id);`);

  pgm.sql(`
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
  `);
  pgm.sql(`CREATE INDEX idx_conflicts_open ON conflicts (status) WHERE status = 'open';`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS conflicts;`);
  pgm.sql(`DROP TABLE IF EXISTS sync_operations;`);
};
