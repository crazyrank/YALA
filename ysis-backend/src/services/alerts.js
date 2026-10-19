const db = require('../db');

/**
 * Creates an in-app notification for every active Director.
 * Never throws: an alert must not block the action it reports.
 */
async function notifyDirectors({ title, body = null, category = 'security', entityId = null }) {
  try {
    await db.query(
      `INSERT INTO notifications (user_id, title, body, category, related_entity_id)
       SELECT id, $1, $2, $3, $4 FROM users WHERE role = 'director' AND status = 'active'`,
      [title, body, category, entityId]
    );
  } catch (err) {
    console.error('Failed to create alert:', err.message);
  }
}

module.exports = { notifyDirectors };
