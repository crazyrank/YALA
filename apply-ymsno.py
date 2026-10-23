import os, sys

HELPER = r"""// Admission numbers are YMS/YEAR/GROUP/SERIAL, e.g. YMS/2024/03/033.
const ADMISSION_PREFIX = 'YMS';
const ADMISSION_FIRST_YEAR = 2016;

/** Year from the school's first year to next year; group 01-99; serial 001-999. */
function admissionNoInRange(value) {
  const m = ADMISSION_NO_PATTERN.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  return (
    year >= ADMISSION_FIRST_YEAR &&
    year <= new Date().getFullYear() + 1 &&
    Number(m[2]) >= 1 &&
    Number(m[3]) >= 1
  );
}

/**
 * Typing guard for the admission number field. Uppercases, drops anything that
 * is not a letter or digit, and lays the rest out as YMS/YYYY/NN/NNN.
 */
function formatAdmissionInput(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let i = 0;
  while (i < s.length && i < ADMISSION_PREFIX.length && s[i] === ADMISSION_PREFIX[i]) i += 1;
  const d = s.slice(i).replace(/\D/g, '').slice(0, 9);
  if (!d) return s.slice(0, i);
  let out = `${ADMISSION_PREFIX}/${d.slice(0, 4)}`;
  if (d.length > 4) out += `/${d.slice(4, 6)}`;
  if (d.length > 6) out += `/${d.slice(6)}`;
  return out;
}"""

NEW_PATTERN = r"const ADMISSION_NO_PATTERN = /^YMS\/(\d{4})\/(\d{2})\/(\d{3})$/;"
PAT_OLDS = [
    "const ADMISSION_NO_PATTERN = /^[A-Za-z0-9/-]+$/; // format still pending school confirmation",
    r"const ADMISSION_NO_PATTERN = /^YALA\/(\d{4})\/(\d{4})$/;",
]
NEW_CHECK = ("  else if (!ADMISSION_NO_PATTERN.test(v.admissionNo)) errors.push('admissionNo: must look like YMS/2024/03/033');\n"
             "  else if (!admissionNoInRange(v.admissionNo)) errors.push('admissionNo: year or number is out of range');")
CHECK_OLDS = [
    "  else if (!ADMISSION_NO_PATTERN.test(v.admissionNo)) errors.push('admissionNo: contains characters that are not allowed');",
    ("  else if (!ADMISSION_NO_PATTERN.test(v.admissionNo)) errors.push('admissionNo: must look like YALA/2026/0001');\n"
     "  else if (!admissionNoInRange(v.admissionNo)) errors.push('admissionNo: year or serial is out of range');"),
]
FN_MARK = "/** Removes control and invisible characters, normalizes Unicode, collapses spaces. */"
HELPER_START = "// Admission numbers are "
EXPORT_OLD = "  DIVISIONS, ARMS, GENDERS, normalizeStudent, cleanText, canonicalClass, divisionOfClass, armRuleFor,\n};"
EXPORT_NEW = "  DIVISIONS, ARMS, GENDERS, normalizeStudent, cleanText, canonicalClass, divisionOfClass, armRuleFor,\n  formatAdmissionInput, admissionNoInRange,\n};"

def one(text, old, new, path):
    n = text.count(old)
    if n != 1:
        sys.exit('STOP: %s: expected 1 match, found %d for:\n%s\nNothing changed.' % (path, n, old[:100]))
    return text.replace(old, new)

def first_present(text, olds, path):
    for o in olds:
        if text.count(o) == 1:
            return o
    sys.exit('STOP: %s: could not find the admission rule to replace. Nothing changed.' % path)

def patch_rules(text, path):
    if NEW_PATTERN in text:
        sys.exit('STOP: %s already uses the YMS format. Nothing changed.' % path)
    text = one(text, first_present(text, PAT_OLDS, path), NEW_PATTERN, path)
    text = one(text, first_present(text, CHECK_OLDS, path), NEW_CHECK, path)
    if "cleanText(input.admissionNo).toUpperCase()" not in text:
        text = one(text, "v.admissionNo = cleanText(input.admissionNo);",
                   "v.admissionNo = cleanText(input.admissionNo).toUpperCase();", path)
    start = text.find(HELPER_START)
    if start != -1:
        fn = text.find("function formatAdmissionInput", start)
        end = text.find("\n}", fn) + 2 if fn != -1 else -1
        if fn == -1 or end < 2:
            sys.exit('STOP: %s: old helper block not recognised. Nothing changed.' % path)
        text = text[:start] + HELPER + text[end:]
    else:
        text = one(text, FN_MARK, HELPER + "\n\n" + FN_MARK, path)
    if "formatAdmissionInput, admissionNoInRange" not in text:
        text = one(text, EXPORT_OLD, EXPORT_NEW, path)
    return text

IMPORT_OLD = "import { divisionOfClass, ARMS } from '../utils/studentRules';"
IMPORT_NEW = "import { divisionOfClass, ARMS, formatAdmissionInput } from '../utils/studentRules';"
FIELD_NEW = """            value={admissionNo}
            onChangeText={(t) => setAdmissionNo(formatAdmissionInput(t))}
            placeholder="YMS/2024/03/033"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={15}
"""
FIELD_OLDS = [
"""            value={admissionNo}
            onChangeText={setAdmissionNo}
            placeholder="Admission number"
            autoCapitalize="characters"
""",
"""            value={admissionNo}
            onChangeText={(t) => setAdmissionNo(formatAdmissionInput(t))}
            placeholder="YALA/2026/0001"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={14}
""",
]

def patch_screen(text, path):
    if 'placeholder="YMS/2024/03/033"' in text:
        sys.exit('STOP: %s already updated. Nothing changed.' % path)
    if "formatAdmissionInput }" not in text:
        text = one(text, IMPORT_OLD, IMPORT_NEW, path)
    return one(text, first_present(text, FIELD_OLDS, path), FIELD_NEW, path)

def main():
    if not os.path.isdir('ysis-backend') or not os.path.isdir('ysis-mobile'):
        sys.exit('STOP: run this from ~/YALA_SIS. Nothing changed.')
    jobs = [
        ('ysis-backend/src/utils/studentRules.js', patch_rules),
        ('ysis-mobile/src/utils/studentRules.js', patch_rules),
        ('ysis-mobile/src/screens/RegisterStudentScreen.js', patch_screen),
    ]
    staged = []
    for path, fn in jobs:
        if not os.path.isfile(path):
            sys.exit('STOP: missing file %s. Nothing changed.' % path)
        staged.append((path, fn(open(path, encoding='utf-8').read(), path)))
    for path, text in staged:
        open(path, 'w', encoding='utf-8').write(text)
        print('patched', path)
    print('Done.')

main()
