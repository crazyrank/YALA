// Cleans and checks guest form input before it is sent.
// The server validates again, so this is for good input, not security.

const collapse = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

export const sanitizeName = (v) =>
  collapse(v).replace(/[^A-Za-z\u00C0-\u024F .'\-]/g, '');

export const sanitizeEmail = (v) => String(v ?? '').trim().toLowerCase();

export const sanitizePhone = (v) => {
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  const plus = raw.startsWith('+') ? '+' : '';
  return plus + raw.replace(/\D/g, '');
};

export const sanitizeReason = (v) => collapse(v);

export const sanitizeSearch = (v) => {
  const s = collapse(v).slice(0, 60);
  // Admission numbers look like YMS/2022/03/236, so keep / and letters/digits.
  return s.replace(/[^A-Za-z0-9 .'\-/\u00C0-\u024F]/g, '');
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Default expiry: 30 days from today.
export const defaultExpiry = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const isValidDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

// Returns { ok, errors, data }. Errors are plain sentences for the user.
export const validateGuestForm = ({ fullName, email, phone, reason, expiresAt, studentIds }) => {
  const errors = [];
  const data = {
    fullName: sanitizeName(fullName),
    email: sanitizeEmail(email),
    phone: sanitizePhone(phone),
    reason: sanitizeReason(reason),
    expiresAt: String(expiresAt ?? '').trim(),
    studentIds: Array.isArray(studentIds) ? studentIds : [],
  };

  if (data.fullName.length < 3) errors.push('Enter the guest full name.');
  if (data.fullName.length > 100) errors.push('Full name is too long.');
  if (!EMAIL_RE.test(data.email) || data.email.length > 120) errors.push('Enter a valid email address.');
  if (data.phone && (data.phone.replace('+', '').length < 7 || data.phone.replace('+', '').length > 15)) {
    errors.push('Phone number should have 7 to 15 digits, or leave it empty.');
  }
  if (data.reason.length < 8) errors.push('Give a clear reason for access (at least 8 characters).');
  if (data.reason.length > 300) errors.push('Reason is too long (300 characters maximum).');

  if (!isValidDate(data.expiresAt)) {
    errors.push('Expiry date must be in the form YYYY-MM-DD.');
  } else if (data.expiresAt <= todayISO()) {
    errors.push('Expiry date must be a future date.');
  }

  if (data.studentIds.length === 0) errors.push('Select at least one student.');
  if (data.studentIds.length > 100) errors.push('You can assign at most 100 students.');

  return { ok: errors.length === 0, errors, data };
};
