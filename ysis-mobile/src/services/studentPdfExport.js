import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { getDb } from '../db';
import { readBiodata } from './biodataLocal';
import { FIELD_GROUPS } from '../utils/biodataForm';

/**
 * Export a single student record as an A4 PDF for printing.
 * Offline only. Reads from local SQLite.
 * Only the school logo and student photo are in colour.
 * Everything else is pure black text on white.
 */

const SCHOOL = {
  name: 'YALA MATRIX SCHOOLS',
  tagline: '...doing better than the Parents',
  address: 'Along Erinje Bye-Pass, Igbodigo, P.O Box 77, Okitipupa, Ondo State.',
  tel: '09059039212',
  email: 'info@yalamatrixschools.org',
  website: 'www.yalamatrixschools.org',
};

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

function capitalize(value) {
  if (!value) return '-';
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

async function loadLogoBase64() {
  try {
    const asset = Asset.fromModule(
      require('../../assets/yala-matrix-schools-logo.jpg')
    );
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (!uri) return null;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch (err) {
    console.warn('Could not load school logo for PDF:', err);
    return null;
  }
}

async function loadPhotoBase64(localUri) {
  if (!localUri) return null;
  try {
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) return null;
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch (err) {
    console.warn('Could not load student photo for PDF:', err);
    return null;
  }
}

function escapeOrDash(value) {
  if (value === null || value === undefined || String(value).trim() === '') return '-';
  return escapeHtml(String(value));
}

function yesNo(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '-';
}

// Second page: the student's biodata, from the phone's local copy.
function biodataPageHtml(biodataRow) {
  const data = biodataRow && biodataRow.data ? biodataRow.data : (biodataRow || {});
  const status = biodataRow && biodataRow.approval_status ? biodataRow.approval_status : null;
  const statusLabel = status === 'approved' ? 'Verified by Head Teacher'
    : status === 'pending' ? 'Awaiting verification'
    : status === 'returned' ? 'Returned for correction'
    : 'Not yet entered';

  const rowStyle = 'display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:5px 0;font-size:12px;';
  const labelStyle = 'color:#000;width:45%;';
  const valueStyle = 'color:#000;width:55%;text-align:right;font-weight:bold;';

  const groups = FIELD_GROUPS.map((g) => {
    const rows = g.fields.map((f) => {
      let value;
      if (f.type === 'bool') value = yesNo(data[f.key]);
      else if (f.type === 'date' && data[f.key]) value = formatDate(String(data[f.key]).slice(0, 10));
      else value = escapeOrDash(data[f.key]);
      return `<div style="${rowStyle}"><div style="${labelStyle}">${escapeHtml(f.label)}</div><div style="${valueStyle}">${value}</div></div>`;
    }).join('');
    return `<div style="font-size:12px;font-weight:bold;margin-top:14px;margin-bottom:4px;">${escapeHtml(g.title)}</div>${rows}`;
  }).join('');

  return `<div style="page-break-before: always; padding: 24px 40px; font-family: sans-serif; color: #000;">
  <div style="font-size:18px;font-weight:bold;margin-bottom:4px;">Student Biodata</div>
  <div style="font-size:11px;margin-bottom:12px;">Status: ${escapeHtml(statusLabel)}</div>
  ${groups}
</div>`;
}

function buildHtml({ student, logoDataUri, photoDataUri, printedAt, biodataRow }) {
  const name = escapeHtml(student.full_name || '-');
  const admission = escapeHtml(student.admission_no || '-');
  const section = escapeHtml(capitalize(student.division));
  const classLevel = escapeHtml(student.class_level || '-');
  const arm = escapeHtml(student.arm || 'None');
  const status = escapeHtml(capitalize(student.status || '-'));
  const guardian = escapeHtml(student.guardian_name || '-');
  const phone = escapeHtml(student.guardian_phone || '-');
  const registered = escapeHtml(formatDate(student.created_at));
  const registeredSession = escapeHtml(student.academic_session || 'Not recorded');
  const currentSession = escapeHtml(student.current_session || student.academic_session || 'Not recorded');
  const printed = escapeHtml(formatDate(printedAt));

  const logoBlock = logoDataUri
    ? `<img src="${logoDataUri}" class="logo" alt="School logo" />`
    : '';

  const photoBlock = photoDataUri
    ? `<img src="${photoDataUri}" class="photo" alt="Student photo" />`
    : `<div class="photo-placeholder">No photo</div>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Helvetica, Arial, sans-serif;
      color: #000000;
      background: #ffffff;
      font-size: 11pt;
      line-height: 1.35;
    }
    .header {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 6px;
    }
    .logo {
      width: 72px;
      height: 72px;
      object-fit: contain;
    }
    .header-text {
      flex: 1;
    }
    .school-name {
      font-size: 22pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #000000;
    }
    .tagline {
      font-size: 10pt;
      font-style: italic;
      color: #000000;
      margin-top: 2px;
    }
    .contact {
      font-size: 8pt;
      color: #000000;
      margin-top: 6px;
      line-height: 1.4;
    }
    .line {
      border: none;
      border-top: 1px solid #000000;
      margin: 10px 0;
    }
    .body {
      display: flex;
      gap: 28px;
      margin-top: 18px;
    }
    .fields {
      flex: 1;
    }
    .row {
      margin-bottom: 11px;
    }
    .label {
      font-size: 9pt;
      font-weight: 700;
      color: #000000;
      margin-bottom: 1px;
    }
    .value {
      font-size: 12pt;
      color: #000000;
    }
    .name-value {
      font-size: 15pt;
      font-weight: 700;
    }
    .photo-wrap {
      width: 140px;
      flex-shrink: 0;
    }
    .photo {
      width: 140px;
      height: 160px;
      object-fit: cover;
      border: 1px solid #000000;
    }
    .photo-placeholder {
      width: 140px;
      height: 160px;
      border: 1px solid #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9pt;
      color: #000000;
    }
    .footer {
      margin-top: 36px;
      font-size: 8pt;
      color: #000000;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoBlock}
    <div class="header-text">
      <div class="school-name">${escapeHtml(SCHOOL.name)}</div>
      <div class="tagline">${escapeHtml(SCHOOL.tagline)}</div>
      <div class="contact">
        ${escapeHtml(SCHOOL.address)}<br/>
        Tel: ${escapeHtml(SCHOOL.tel)} &nbsp;|&nbsp;
        Email: ${escapeHtml(SCHOOL.email)}<br/>
        ${escapeHtml(SCHOOL.website)}
      </div>
    </div>
  </div>

  <hr class="line" />

  <div class="body">
    <div class="fields">
      <div class="row">
        <div class="label">Full Name</div>
        <div class="value name-value">${name}</div>
      </div>
      <div class="row">
        <div class="label">Admission Number</div>
        <div class="value">${admission}</div>
      </div>
      <div class="row">
        <div class="label">Section</div>
        <div class="value">${section}</div>
      </div>
      <div class="row">
        <div class="label">Class</div>
        <div class="value">${classLevel}</div>
      </div>
      <div class="row">
        <div class="label">Arm</div>
        <div class="value">${arm}</div>
      </div>
      <div class="row">
        <div class="label">Status</div>
        <div class="value">${status}</div>
      </div>
      <div class="row">
        <div class="label">Guardian Name</div>
        <div class="value">${guardian}</div>
      </div>
      <div class="row">
        <div class="label">Guardian Phone</div>
        <div class="value">${phone}</div>
      </div>
      <div class="row">
        <div class="label">Date Registered</div>
        <div class="value">${registered}</div>
      </div>
      <div class="row">
        <div class="label">Registered Session</div>
        <div class="value">${registeredSession}</div>
      </div>
      <div class="row">
        <div class="label">Current Session</div>
        <div class="value">${currentSession}</div>
      </div>
      <div class="row">
        <div class="label">Date Printed</div>
        <div class="value">${printed}</div>
      </div>
    </div>
    <div class="photo-wrap">
      ${photoBlock}
    </div>
  </div>

  <div class="footer">
    Official student record - Yala Matrix Schools
  </div>
  ${biodataPageHtml(biodataRow)}
</body>
</html>
`;
}

/**
 * Generates and shares an A4 PDF for one student.
 * Returns true on success, false if the student was not found.
 */
export async function exportStudentToPdf(studentId) {
  const db = await getDb();

  const student = await db.getFirstAsync(
    'SELECT * FROM students WHERE id = ?',
    [studentId]
  );

  if (!student) {
    return false;
  }

  const photo = await db.getFirstAsync(
    'SELECT local_uri FROM student_photos WHERE student_id = ? AND is_current = 1',
    [studentId]
  );

  const biodataRow = await readBiodata(studentId);

  const [logoDataUri, photoDataUri] = await Promise.all([
    loadLogoBase64(),
    loadPhotoBase64(photo?.local_uri || null),
  ]);

  const printedAt = new Date().toISOString();
  const html = buildHtml({
    student,
    logoDataUri,
    photoDataUri,
    printedAt,
    biodataRow,
  });

  // Remove any previous PDF for this student from the cache
  const cacheDir = FileSystem.cacheDirectory;
  try {
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    const prefix = `yala-student-${studentId}-`;
    await Promise.all(
      files
        .filter((name) => name.startsWith(prefix) && name.endsWith('.pdf'))
        .map((name) =>
          FileSystem.deleteAsync(`${cacheDir}${name}`, { idempotent: true })
        )
    );
  } catch {
    // non-fatal
  }

  const { uri } = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
  });

  const safeName = (student.admission_no || studentId)
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const finalUri = `${cacheDir}yala-student-${studentId}-${safeName}.pdf`;

  try {
    await FileSystem.moveAsync({ from: uri, to: finalUri });
  } catch {
    // if move fails, just use the original uri
  }

  const shareUri = (await FileSystem.getInfoAsync(finalUri)).exists
    ? finalUri
    : uri;

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(shareUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Export student PDF for printing',
      UTI: 'com.adobe.pdf',
    });
  }

  return true;
}
