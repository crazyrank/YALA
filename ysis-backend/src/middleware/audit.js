const db = require('../db');

/**
 * Writes one row to the append-only audit_logs table.
 * Call this from route handlers after any meaningful action, success OR
 * failure (e.g. failed login attempts still get logged).
 *
 * Never awaited in a way that blocks the response on failure — audit
 * writes should not be able to break the actual user-facing action, but
 * we do log to console if the write itself fails, since that's a signal
 * worth knowing about operationally.
 */
async function writeAudit({ userId = null, deviceId = null, action, entityType = null, entityId = null, result, metadata = null }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, device_id, action, entity_type, entity_id, result, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, deviceId, action, entityType, entityId, result, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

module.exports = { writeAudit };
