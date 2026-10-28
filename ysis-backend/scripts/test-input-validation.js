const { normalizeStudent } = require('../src/utils/studentRules');

const base = {
  admissionNo: 'YMS/2024/03/033',
  fullName: 'Ada Obi',
  division: 'secondary',
  classLevel: 'JSS1',
  arm: '',
  guardianName: '',
  guardianPhone: '',
  dateOfBirth: '',
  gender: '',
};

const cases = [
  ['valid record', {}],
  ['valid DOB', { dateOfBirth: '2015-05-10' }],
  ['impossible date', { dateOfBirth: '2015-02-30' }],
  ['future date', { dateOfBirth: '2099-01-01' }],
  ['too young', { dateOfBirth: '2025-01-01' }],
  ['SQL in DOB', { dateOfBirth: "2015-05-10'; DROP TABLE students;--" }],
  ['SQL in gender', { gender: "M'; DROP TABLE students;--" }],
  ['SQL in name', { fullName: "Robert'); DROP TABLE students;--" }],
  ['apostrophe name (allowed)', { fullName: "O'Brien" }],
  ['SQL in phone', { guardianPhone: "08012345678' OR '1'='1" }],
];

for (const [label, change] of cases) {
  const r = normalizeStudent({ ...base, ...change });
  console.log(r.ok ? 'PASS' : 'REJECT', '-', label, r.ok ? '' : r.errors.join('; '));
}
