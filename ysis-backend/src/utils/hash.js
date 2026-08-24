const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');

async function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptSaltRounds);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// For password-reset temp credentials: generate a short, readable code,
// store only its hash (same discipline as users.password_hash).
function generateTempCredential() {
  // 8-character, unambiguous alphabet (no 0/O/1/I confusion) - easy to
  // read aloud from a Principal's screen to a Head Teacher.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return code;
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

module.exports = { hashPassword, verifyPassword, generateTempCredential, sha256 };
