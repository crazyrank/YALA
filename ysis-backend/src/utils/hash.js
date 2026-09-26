const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');

async function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptSaltRounds);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Temp credentials shown once on an admin screen and relayed verbally.
 * 12 characters from an unambiguous alphabet ≈ 60 bits of entropy —
 * strong enough for a 20-minute lifetime, still readable aloud.
 */
function generateTempCredential() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i += 1) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return code;
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

module.exports = { hashPassword, verifyPassword, generateTempCredential, sha256 };
