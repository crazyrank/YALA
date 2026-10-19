const crypto = require('crypto');

/**
 * Checks a password against the Have I Been Pwned range API.
 * Only the first 5 characters of the SHA-1 hash leave the server (k-anonymity).
 * Fails open: if the service is unreachable, the password is accepted and a
 * warning is logged.
 */
async function isBreachedPassword(password) {
  const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return text.split('\n').some((line) => {
      const [hashSuffix, count] = line.trim().split(':');
      return hashSuffix === suffix && Number(count) > 0;
    });
  } catch (err) {
    console.warn('Breach check unavailable, continuing:', err.message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { isBreachedPassword };
