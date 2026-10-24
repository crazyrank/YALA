/**
 * Trust devices from the server, without the in-app approval step.
 * Run from ysis-backend, against the environment you choose:
 *
 *   node scripts/trust-devices.js list <email>
 *       Show every device registered to this account and its status.
 *
 *   node scripts/trust-devices.js trust <email>
 *       Trust every PENDING device on this account.
 *
 *   node scripts/trust-devices.js trust <email> <deviceId>
 *       Trust one specific pending device on this account.
 *
 *   node scripts/trust-devices.js trust-all
 *       Trust every PENDING device in the system (asks you to confirm).
 *
 * Only pending devices are changed. Revoked devices are never re-trusted
 * by this script; register the phone again from the app instead.
 * Every trusted device writes a row to audit_logs.
 */
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
});
const os = require('os');
const readline = require('readline');
const { pool } = require('../src/db');
const { writeAudit } = require('../src/middleware/audit');

const [command, email, deviceId] = process.argv.slice(2);
const operator = os.userInfo().username;

function usage() {
  console.log(`Usage:
  node scripts/trust-devices.js list <email>
  node scripts/trust-devices.js trust <email> [deviceId]
  node scripts/trust-devices.js trust-all`);
  process.exit(1);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

async function list() {
  const { rows } = await pool.query(
    `SELECT d.id, u.email, d.device_name, d.status, d.registered_at, d.last_seen_at
       FROM devices d
       JOIN users u ON u.id = d.user_id
      WHERE lower(u.email) = lower($1)
      ORDER BY d.registered_at DESC`,
    [email]
  );
  if (rows.length === 0) {
    console.log('No devices found for', email);
    return;
  }
  console.table(rows);
}

async function trustForUser() {
  const params = [email];
  let sql = `UPDATE devices d
                SET status = 'trusted', last_seen_at = now()
               FROM users u
              WHERE u.id = d.user_id
                AND lower(u.email) = lower($1)
                AND d.status = 'pending_verification'`;
  if (deviceId) {
    params.push(deviceId);
    sql += ' AND d.id = $2';
  }
  sql += ' RETURNING d.id, d.device_name, u.email';

  const { rows } = await pool.query(sql, params);
  await report(rows);
}

async function trustAll() {
  const answer = await ask('Trust EVERY pending device in the system? Type "yes" to continue: ');
  if (answer !== 'yes') {
    console.log('Cancelled. Nothing was changed.');
    return;
  }
  const { rows } = await pool.query(
    `UPDATE devices SET status = 'trusted', last_seen_at = now()
      WHERE status = 'pending_verification'
      RETURNING id, device_name, user_id`
  );
  await report(rows);
}

async function report(rows) {
  if (rows.length === 0) {
    console.log('No pending devices matched. Nothing was changed.');
    console.log('Revoked devices are not touched by this script.');
    return;
  }
  for (const row of rows) {
    await writeAudit({
      action: 'DEVICE_TRUSTED_BY_OPERATOR',
      entityType: 'device',
      entityId: row.id,
      result: 'success',
      metadata: { via: 'scripts/trust-devices.js', operator },
    });
    console.log(`Trusted: ${row.id}  ${row.device_name || 'unnamed device'}`);
  }
  console.log(`Done. ${rows.length} device(s) trusted.`);
}

async function main() {
  if (command === 'list') {
    if (!email) usage();
    await list();
  } else if (command === 'trust') {
    if (!email) usage();
    await trustForUser();
  } else if (command === 'trust-all') {
    await trustAll();
  } else {
    usage();
  }
}

main()
  .catch((err) => {
    console.error('trust-devices failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
