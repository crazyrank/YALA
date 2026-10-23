// Login protection: a pair lock for one account from one network, and a
// whole-network block for brute force across many accounts. Both return the
// same message, with no minutes and no hint about which accounts exist.
const crypto = require('crypto');
const db = require('../db');
const { notifyDirectors } = require('./alerts');
const { writeAudit } = require('../middleware/audit');
const { AppError } = require('../utils/errors');

const PAIR_MAX_FAILURES = 6;
const PAIR_WINDOW_MINUTES = 15;
const PAIR_LOCK_MINUTES = 40;
const IP_MAX_FAILURES = 25;
const IP_WINDOW_MINUTES = 60;
const IP_BLOCK_MINUTES = 60;
const RETENTION_DAYS = 30;

const LOCKED_MESSAGE = 'Too many attempts. Try again later.';

function sha(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function normalizedEmail(email) {
  return String(email).trim().toLowerCase();
}

function emailHash(email) {
  return sha(normalizedEmail(email));
}

function pairKey(email, ip) {
  return sha(`${normalizedEmail(email)}|${ip}`);
}

function tooMany() {
  return new AppError(429, 'TOO_MANY_ATTEMPTS', LOCKED_MESSAGE);
}

/** Throws the generic lockout if this network is blocked or this pair is locked. */
async function assertNotLocked(email, ip) {
  const block = await db.query(
    'SELECT 1 FROM ip_blocks WHERE ip = $1 AND blocked_until > now()',
    [ip]
  );
  if (block.rows.length > 0) throw tooMany();

  const pair = await db.query(
    'SELECT 1 FROM login_pair_locks WHERE pair_key = $1 AND locked_until > now()',
    [pairKey(email, ip)]
  );
  if (pair.rows.length > 0) throw tooMany();
}

/** Records one failed sign-in, then applies the pair lock and IP block rules. */
async function recordFailure(email, ip) {
  const eh = emailHash(email);
  await db.query(
    'INSERT INTO login_attempts (email_hash, ip, succeeded) VALUES ($1, $2, false)',
    [eh, ip]
  );

  const pairCount = await db.query(
    `SELECT COUNT(*)::int AS n FROM login_attempts
     WHERE email_hash = $1 AND ip = $2 AND succeeded = false
       AND attempted_at > now() - make_interval(mins => $3::int)`,
    [eh, ip, PAIR_WINDOW_MINUTES]
  );

  if (pairCount.rows[0].n >= PAIR_MAX_FAILURES) {
    const key = pairKey(email, ip);
    const wasLocked = await db.query(
      'SELECT 1 FROM login_pair_locks WHERE pair_key = $1 AND locked_until > now()',
      [key]
    );
    await db.query(
      `INSERT INTO login_pair_locks (pair_key, locked_until)
       VALUES ($1, now() + make_interval(mins => $2::int))
       ON CONFLICT (pair_key) DO UPDATE SET locked_until = excluded.locked_until`,
      [key, PAIR_LOCK_MINUTES]
    );
    if (wasLocked.rows.length === 0) {
      await writeAudit({
        action: 'LOGIN_LOCKOUT',
        result: 'blocked',
        metadata: { scope: 'account_and_network', ip },
      });
      notifyDirectors({
        title: 'Account sign-in locked',
        body: 'An account was locked after repeated failed sign-ins from one network.',
        category: 'security',
      });
    }
  }

  const ipCount = await db.query(
    `SELECT COUNT(*)::int AS n FROM login_attempts
     WHERE ip = $1 AND succeeded = false
       AND attempted_at > now() - make_interval(mins => $2::int)`,
    [ip, IP_WINDOW_MINUTES]
  );

  if (ipCount.rows[0].n >= IP_MAX_FAILURES) {
    const wasBlocked = await db.query(
      'SELECT 1 FROM ip_blocks WHERE ip = $1 AND blocked_until > now()',
      [ip]
    );
    await db.query(
      `INSERT INTO ip_blocks (ip, blocked_until)
       VALUES ($1, now() + make_interval(mins => $2::int))
       ON CONFLICT (ip) DO UPDATE SET
         blocked_until = excluded.blocked_until,
         created_at = now(),
         unblocked_by = NULL,
         unblocked_at = NULL`,
      [ip, IP_BLOCK_MINUTES]
    );
    if (wasBlocked.rows.length === 0) {
      await writeAudit({
        action: 'IP_BLOCK',
        result: 'blocked',
        metadata: { ip, failures: IP_MAX_FAILURES, windowMinutes: IP_WINDOW_MINUTES },
      });
      notifyDirectors({
        title: 'Network blocked after repeated failed sign-ins',
        body: 'Sign-ins from one network were blocked after many failed attempts. Admins can unblock it from the device screen.',
        category: 'security',
      });
    }
  }
}

/** Deletes login records and blocks older than the retention period. */
async function purgeOldLoginRecords() {
  const attempts = await db.query(
    'DELETE FROM login_attempts WHERE attempted_at < now() - make_interval(days => $1::int)',
    [RETENTION_DAYS]
  );
  const pairLocks = await db.query('DELETE FROM login_pair_locks WHERE locked_until < now()');
  const blocks = await db.query(
    'DELETE FROM ip_blocks WHERE blocked_until < now() - make_interval(days => $1::int)',
    [RETENTION_DAYS]
  );
  return {
    attempts: attempts.rowCount,
    pairLocks: pairLocks.rowCount,
    blocks: blocks.rowCount,
  };
}

/** Runs the cleanup once at startup, then once a day. */
function startRetentionJob() {
  const run = () =>
    purgeOldLoginRecords().catch((err) =>
      console.error('Login record cleanup failed:', err.message)
    );
  run();
  const timer = setInterval(run, 24 * 60 * 60 * 1000);
  timer.unref();
}

module.exports = {
  assertNotLocked,
  recordFailure,
  purgeOldLoginRecords,
  startRetentionJob,
  RETENTION_DAYS,
};
