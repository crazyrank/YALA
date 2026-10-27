// Offline check of the date of birth rule. Pure function, no database.
const { normalizeStudent } = require('../src/utils/studentRules');

const base = {
  admissionNo: 'YMS/2024/03/033',
  fullName: 'Test Student',
  division: 'secondary',
  classLevel: 'JSS1',
  gender: 'F',
};

const cases = [
  ['empty', ''],
  ['valid, age 11', '2015-05-10'],
  ['future date', '2099-01-01'],
  ['impossible date', '2024-02-30'],
  ['wrong format', '15/05/2015'],
  ['too young', '2025-10-01'],
  ['too old', '1986-01-01'],
];

for (const [label, dob] of cases) {
  const r = normalizeStudent({ ...base, dateOfBirth: dob });
  const dobErrors = r.errors.filter((e) => e.startsWith('dateOfBirth'));
  console.log(
    label.padEnd(18),
    'value:', String(r.value.dateOfBirth).padEnd(12),
    'errors:', dobErrors.length ? dobErrors.join('; ') : 'none'
  );
}
