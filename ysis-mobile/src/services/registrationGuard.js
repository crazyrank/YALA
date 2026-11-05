import { normalizeStudent } from '../utils/studentRules';

/**
 * Runs the shared rules on a registration before it is saved or queued.
 * The same rules run on the server, so a record that passes here will not
 * be rejected later for its class or arm.
 *
 * Returns { ok, value, errors }. Each error reads like "arm: not allowed for
 * this class"; formatErrors() turns them into field and message pairs.
 */
export function checkRegistration(input) {
  return normalizeStudent(input);
}

export function formatErrors(errors = []) {
  return errors.map((text) => {
    const idx = text.indexOf(':');
    if (idx === -1) return { field: null, message: text };
    return {
      field: text.slice(0, idx).trim(),
      message: text.slice(idx + 1).trim(),
    };
  });
}
