/**
 * One-time setup script. Run manually after migrations:
 *   node scripts/seed-director.js
 *
 * The Director is the ONLY account ever created outside the normal
 * hierarchy (Build Spec Section 3). There is no API route for this —
 * on purpose, matching "no public registration" and the "no in-app
 * Director recovery" rule.
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
  const fullName = await ask('Director full name: ');
  const email = await ask('Director email: ');
  const password = await ask('Temporary password (Director must change on first login): ');

  const passwordHash = await hashPassword(password);

  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, must_change_password)
     VALUES ($1, $2, $3, 'director', TRUE)
     RETURNING id, email`,
    [fullName, email, passwordHash]
  );

  console.log('Director account created:', rows[0]);
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
