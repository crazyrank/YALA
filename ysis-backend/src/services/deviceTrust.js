const config = require('../config');

const STALE_DEVICE_MESSAGE =
  'This device has not been used for a while and must be approved again. Ask a Principal or Director to approve it.';

function deviceIsStale(lastSeenAt) {
  if (!lastSeenAt) return true;
  const cutoffMs = config.deviceInactivityDays * 24 * 60 * 60 * 1000;
  return new Date(lastSeenAt).getTime() < Date.now() - cutoffMs;
}

module.exports = { deviceIsStale, STALE_DEVICE_MESSAGE };
