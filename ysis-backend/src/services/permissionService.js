const db = require('../db');

/**
 * Checks whether a user has a given permission, either via their
 * role's baseline permissions or an active delegated grant.
 *
 * `atTime` matters: for a LIVE online request pass `new Date()` (now).
 * For an operation arriving via /sync, pass `created_at_client` instead,
 * since a legitimate offline action performed before a grant expired
 * should not be rejected just because the sync happened to land after
 * the expiry (Build Spec Section 12 / permission-check query pattern).
 *
 * revoked_at is always checked against the actual current time
 * server-side regardless of `atTime` — an explicit revocation must win
 * immediately, no matter what the device's clock claims.
 */
async function userHasPermission({ userId, role, permissionCode, atTime }) {
  const { rows: baseline } = await db.query(
    `SELECT 1 FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role = $1 AND p.code = $2`,
    [role, permissionCode]
  );
  if (baseline.length > 0) return true;

  const { rows: delegated } = await db.query(
    `SELECT 1 FROM user_permissions up
     JOIN permissions p ON p.id = up.permission_id
     WHERE up.user_id = $1
       AND p.code = $2
       AND up.revoked_at IS NULL
       AND $3 BETWEEN up.granted_at AND up.expires_at`,
    [userId, permissionCode, atTime]
  );
  return delegated.length > 0;
}

module.exports = { userHasPermission };
