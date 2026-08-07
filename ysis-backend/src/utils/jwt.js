const jwt = require('jsonwebtoken');
const config = require('../config');

// Access and refresh tokens use SEPARATE secrets, deliberately, so a leak
// of one never compromises the other token type.

function signAccessToken({ userId, role, sessionVersion, deviceId }) {
  return jwt.sign(
    { userId, role, sessionVersion, deviceId },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

function signRefreshToken({ userId, sessionVersion, deviceId }) {
  return jwt.sign(
    { userId, sessionVersion, deviceId },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret);
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
