// Single source of truth: this app runs against the production database
// ONLY. On Render, DATABASE_URL and every other secret are injected
// directly into process.env by the platform's Environment dashboard —
// there is no .env file on the server, so this call intentionally does
// nothing there. It only matters if a local `.env` file happens to
// exist (e.g. for running a one-off maintenance script), in which case
// that file must itself point at the production DATABASE_URL — see
// .env.example. Never create separate dev/test env files or branch this
// on NODE_ENV: that split is what caused scripts to silently query the
// wrong database before.
require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: required('DATABASE_URL'),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  // Comma-separated list of allowed origins. Empty / unset = no browser
  // origins (mobile app uses Bearer tokens and is unaffected).
  corsOrigins: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : [],
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
    apiKey: process.env.CLOUDINARY_API_KEY || null,
    apiSecret: process.env.CLOUDINARY_API_SECRET || null,
  },
  // Progressive lockout
  maxFailedLogins: parseInt(process.env.MAX_FAILED_LOGINS || '8', 10),
  lockoutMinutes: parseInt(process.env.LOCKOUT_MINUTES || '30', 10),
};
