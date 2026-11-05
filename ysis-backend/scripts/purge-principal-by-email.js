/**
 * Permanently remove a staff account by email, including related rows
 * and (if the DB role allows) audit_logs that mention them.
 *
 * Default email: principal@yalamatrix.com
 *
 * Dry run (safe):
 *   node scripts/purge-principal-by-email.js
 *   node scripts/purge-principal-by-email.js --email other@example.com
 *
 * Apply:
 *   node scripts/purge-principal-by-email.js --apply
 *   node scripts/purge-principal-by-email.js --email principal@yalamatrix.com --apply
 *
 * Run from ysis-backend with DATABASE_URL set (same as other scripts).
 * If audit_logs DELETE is revoked for the app role, the script still
 * deletes the user and reports that audit rows could not be removed.
 */
const fs = require('fs');

for (const file of ['.env', '.env.production', '.env.development']) {
  if (!process.env.DATABASE_URL && fs.existsSync(file)) {
    require('dotenv').config({ path: file });
    console.log(`Loaded settings from ${file}`);
  }
}
if (!process.env.DATABASE_URL) {
  console.error('ABORT: DATABASE_URL not found in .env, .env.production or .env.development.');
  process.exit(1);
}

const db = require('../src/db');

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

const APPLY = process.argv.includes('--apply');
const EMAIL = (argValue('--email') || 'principal@yalamatrix.com').trim().toLowerCase();

async function main() {
  console.log(APPLY ? 'MODE: APPLY (will delete)' : 'MODE: dry run (no changes)');
  console.log(`Target email: ${EMAIL}`);
  console.log('');

  const { rows } = await db.query(
    `SELECT id, full_name, email, role, status, created_by, created_at
     FROM users WHERE lower(email::text) = $1`,
    [EMAIL]
  );

  if (rows.length === 0) {
    console.log('No user found with that email. Nothing to do.');
    await db.pool.end();
    return;
  }

  const user = rows[0];
  console.log('Found:');
  console.log(`  id:         ${user.id}`);
  console.log(`  full_name:  ${user.full_name}`);
  console.log(`  email:      ${user.email}`);
  console.log(`  role:       ${user.role}`);
  console.log(`  status:     ${user.status}`);
  console.log(`  created_at: ${user.created_at}`);
  console.log('');

  if (user.role === 'director') {
    console.error('ABORT: Refusing to delete a director account.');
    await db.pool.end();
    process.exit(1);
  }

  const subs = await db.query(
    `SELECT id, full_name, email, role, status FROM users WHERE created_by = $1`,
    [user.id]
  );
  if (subs.rows.length > 0) {
    console.log(`Subordinates created by this account (${subs.rows.length}):`);
    for (const s of subs.rows) {
      console.log(`  - ${s.role} ${s.email} (${s.status}) id=${s.id}`);
    }
    console.log('These will be deleted first (and their dependents).');
    console.log('');
  }

  const auditCount = await db.query(
    `SELECT COUNT(*)::int AS n FROM audit_logs
     WHERE user_id = $1
        OR (entity_type = 'user' AND entity_id = $1)
        OR (metadata::text ILIKE '%' || $1::text || '%')`,
    [user.id]
  );
  console.log(`Audit rows referencing this user (approx): ${auditCount.rows[0].n}`);
  console.log('');

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to delete.');
    await db.pool.end();
    return;
  }

  // Delete deepest dependents first. Order matters for FKs.
  const targets = [...subs.rows.map((s) => s.id), user.id];

  await db.withTransaction(async (client) => {
    for (const id of targets) {
      console.log(`Purging user id=${id} ...`);

      await client.query(
        `DELETE FROM password_reset_tokens WHERE user_id = $1 OR issued_by = $1`,
        [id]
      );
      await client.query(`DELETE FROM notifications WHERE user_id = $1`, [id]);
      await client.query(
        `DELETE FROM head_teacher_class_assignments WHERE user_id = $1 OR assigned_by = $1`,
        [id]
      );
      await client.query(
        `DELETE FROM staff_directory WHERE linked_user_id = $1 OR created_by = $1`,
        [id]
      );
      await client.query(
        `DELETE FROM user_permissions WHERE user_id = $1 OR granted_by = $1`,
        [id]
      );
      await client.query(
        `UPDATE devices SET revoked_by = NULL WHERE revoked_by = $1`,
        [id]
      );
      await client.query(`DELETE FROM devices WHERE user_id = $1`, [id]);

      // Child users already in targets list; clear inactive leftovers if any
      await client.query(`DELETE FROM users WHERE created_by = $1`, [id]);
      await client.query(`DELETE FROM users WHERE id = $1`, [id]);
      console.log(`  users row deleted for ${id}`);
    }
  });

  // Audit is often append-only (DELETE revoked). Try; don't fail the whole purge.
  let auditDeleted = 0;
  try {
    const del = await db.query(
      `DELETE FROM audit_logs
       WHERE user_id = $1
          OR (entity_type = 'user' AND entity_id = $1)
          OR (metadata::text ILIKE '%' || $1::text || '%')`,
      [user.id]
    );
    auditDeleted = del.rowCount || 0;
    console.log(`Audit rows deleted: ${auditDeleted}`);
  } catch (err) {
    console.warn('');
    console.warn('Could not delete audit_logs (role may have DELETE revoked):');
    console.warn(`  ${err.message}`);
    console.warn('User account is gone. To clear audit history use a privileged DB role, e.g.:');
    console.warn(
      `  DELETE FROM audit_logs WHERE user_id = '${user.id}' OR (entity_type = 'user' AND entity_id = '${user.id}');`
    );
  }

  // Also scrub audit for subordinates we removed
  for (const s of subs.rows) {
    try {
      await db.query(
        `DELETE FROM audit_logs
         WHERE user_id = $1
            OR (entity_type = 'user' AND entity_id = $1)`,
        [s.id]
      );
    } catch (_) {
      /* same revoke limitation */
    }
  }

  console.log('');
  console.log('Done. Principal (and subordinates if any) removed from users.');
  if (auditDeleted > 0) {
    console.log(`Also removed ${auditDeleted} audit log row(s) for the main account.`);
  }

  await db.pool.end();
}

main().catch(async (err) => {
  console.error('Purge failed:', err);
  try {
    await db.pool.end();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
