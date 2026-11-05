/**
 * Class Teacher rules (Build Spec Section 8).
 *  - A Class Teacher is responsible for exactly one class. The table enforces this.
 *  - The class must belong to the division, and the arm rule for that class applies.
 * Pure functions. They never touch the database.
 */
const { canonicalClass, divisionOfClass, armRuleFor, ARMS } = require('./studentRules');

/** Checks the one class a Class Teacher is responsible for. */
function validateClassTeacherClass({ division, classLevel, arm } = {}) {
  const div = typeof division === 'string' ? division.trim().toLowerCase() : '';
  if (div !== 'primary' && div !== 'secondary') {
    return { ok: false, code: 'DIVISION_REQUIRED', message: 'Choose Primary or Secondary for this class teacher.' };
  }
  const cls = canonicalClass(typeof classLevel === 'string' ? classLevel : '');
  if (!cls) {
    return { ok: false, code: 'CLASS_REQUIRED', message: 'Choose the one class this class teacher is responsible for.' };
  }
  if (divisionOfClass(cls) !== div) {
    return { ok: false, code: 'CLASS_DIVISION_MISMATCH', message: 'That class does not belong to the chosen division.' };
  }
  const armRaw = typeof arm === 'string' ? arm.trim() : '';
  const rule = armRuleFor(cls);
  let armValue = null;
  if (rule.required) {
    armValue = ARMS.find((a) => a.toLowerCase() === armRaw.toLowerCase()) || null;
    if (!armValue) {
      return { ok: false, code: 'ARM_REQUIRED', message: 'Choose the arm for this class.' };
    }
  } else if (armRaw) {
    return { ok: false, code: 'ARM_NOT_ALLOWED', message: 'This class does not have arms.' };
  }
  return { ok: true, value: { division: div, classLevel: cls, arm: armValue } };
}

module.exports = { validateClassTeacherClass };
