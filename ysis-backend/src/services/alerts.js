const db = require('../db');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

/**
 * Creates an in-app notification for every active Director, then sends a phone
 * push to each trusted device they have registered. Never throws: an alert must
 * not block the action it reports.
 *
 * Keep bodies free of student data. Push messages pass through Expo's servers.
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
    return;
  }
  sendPushToDirectors({ title, body, category, entityId }).catch((err) =>
    console.error('Push send failed:', err.message)
  );
}

async function sendPushToDirectors({ title, body, category, entityId }) {
  const { rows } = await db.query(
    `SELECT d.push_token FROM devices d
       JOIN users u ON u.id = d.user_id
      WHERE u.role = 'director' AND u.status = 'active'
        AND d.status = 'trusted' AND d.push_token IS NOT NULL`
  );
  if (rows.length === 0) return;

  const messages = rows.map((r) => ({
    to: r.push_token,
    sound: 'default',
    title,
    body: body || '',
    channelId: category === 'security' ? 'security' : 'general',
    data: { category, entityId },
  }));

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`);

    const json = await res.json();
    const tickets = json.data || [];
    for (let j = 0; j < tickets.length; j++) {
      // Forget tokens the push service says are no longer valid
      if (tickets[j].status === 'error' && tickets[j].details?.error === 'DeviceNotRegistered') {
        await db.query('UPDATE devices SET push_token = NULL WHERE push_token = $1', [batch[j].to]);
      }
    }
  }
}

module.exports = { notifyDirectors };
