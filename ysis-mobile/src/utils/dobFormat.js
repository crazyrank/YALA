/**
 * Date of birth formats.
 * Staff type and read DD/MM/YYYY. The database, the server and sync use YYYY-MM-DD.
 */

/** "25/03/2014" -> "2014-03-25". Empty -> "". Wrong shape -> null. */
export function dobToIso(text) {
  const t = String(text ?? '').trim();
  if (t === '') return '';
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** "2014-03-25" -> "25/03/2014". Empty or unreadable values come back as they are (or ""). */
export function isoToDob(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? '');
}

/** Typing helper: keeps digits only and inserts the slashes as the person types. */
export function formatDobInput(raw) {
  const d = String(raw ?? '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
