const { verifyAccessToken } = require('../utils/jwt');
const { Errors } = require('../utils/errors');
const db = require('../db');

/**
 * Verifies the JWT, then checks session_version and device trust against
 * the DATABASE on every request (not just at login). This is what makes a
 * remote device revocation take effect immediately, per the architecture
 * doc's device-trust requirement.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw Errors.unauthorized('Please sign in to continue.');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (e) {
      throw Errors.unauthorized('Your session has expired. Please sign in again.');
    }

    const { rows } = await db.query(
      `SELECT u.id, u.role, u.status, u.session_version,
              d.status AS device_status
       FROM users u
       JOIN devices d ON d.id = $2
       WHERE u.id = $1`,
      [payload.userId, payload.deviceId]
    );

    const record = rows[0];
    if (!record) throw Errors.unauthorized('Account not found.');
    if (record.status !== 'active') throw Errors.forbidden('This account is not active.');
    if (record.session_version !== payload.sessionVersion) {
      throw Errors.unauthorized('Your session has expired. Please sign in again.');
    }
    if (record.device_status !== 'trusted') {
      throw Errors.deviceNotTrusted();
    }

    req.auth = {
      userId: payload.userId,
      role: payload.role,
      deviceId: payload.deviceId,
      sessionVersion: payload.sessionVersion,
    };
    next();
  } catch (err) {
    next(err);
  }
}

// Usage: requireRole('principal', 'director')
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return next(Errors.forbidden());
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
