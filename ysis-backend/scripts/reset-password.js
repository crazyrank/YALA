/**
 * Password reset utility. Run manually:
 *   node scripts/reset-password.js
 * Prompts for an email and a new password, then updates that user's
 * password_hash directly. Use when a password is forgotten — there is
 * no "view password" option since passwords are hashed, not encrypted.
 */
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
});
const readline = require('readline');
const { pool } = require('../src/db');
const { hashPassword } = require('../src/utils/hash');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function main() {
  const email = await ask('Email of account to reset: ');
  const newPassword = await ask('New password: ');

  const passwordHash = await hashPassword(newPassword);

  const { rows } = await pool.query(
    `UPDATE users SET password_hash = $1, must_change_password = TRUE
     WHERE email = $2
     RETURNING id, email`,
    [passwordHash, email]
  );

  if (rows.length === 0) {
    console.log('No user found with that email.');
  } else {
    console.log('Password reset for:', rows[0]);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
