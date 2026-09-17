const db = require('../db');

/**
 * Returns a head_teacher's scope as an array of
 * { division, class_level, arm } rows from head_teacher_class_assignments,
 * or `null` for principal/director, meaning "unscoped — sees everything".
 * An empty array means a head_teacher with NO assignments yet — they are
 * scoped to nothing until a principal/director assigns them a class.
 */
async function getScopeForUser(auth) {
  if (auth.role === 'principal' || auth.role === 'director') {
    return null;
  }

  const { rows } = await db.query(
    `SELECT division, class_level, arm
     FROM head_teacher_class_assignments
     WHERE user_id = $1`,
    [auth.userId]
  );

  return rows;
}

/**
 * Builds a SQL WHERE fragment matching any of a scope's assignment rows,
 * for use in the /students list query. Placeholder numbering starts at
 * startIndex so it can be combined with other filters in the same query.
 */
function scopeToSqlClause(scope, startIndex) {
  if (!scope || scope.length === 0) {
    return {
      clause: 'FALSE',
      params: [],
    };
  }

  const clauses = [];
  const params = [];
  let idx = startIndex;

  for (const s of scope) {
    if (s.arm) {
      clauses.push(
        `(division = $${idx}
          AND class_level = $${idx + 1}
          AND arm = $${idx + 2})`
      );

      params.push(s.division, s.class_level, s.arm);
      idx += 3;
    } else {
      clauses.push(
        `(division = $${idx}
          AND class_level = $${idx + 1})`
      );

      params.push(s.division, s.class_level);
      idx += 2;
    }
  }

  return {
    clause: `(${clauses.join(' OR ')})`,
    params,
  };
}

/**
 * True if a single { division, classLevel, arm } combination falls
 * inside a scope returned by getScopeForUser. Used to guard single-record
 * writes (register, edit, promote, photo) where a SQL WHERE clause isn't
 * applicable.
 *
 * An assignment row with no `arm` set matches ANY arm at that
 * division/class_level (a whole-class-level assignment); a row WITH an
 * arm only matches that exact arm.
 */
function isWithinScope(scope, { division, classLevel, arm }) {
  if (scope === null) return true; // unscoped: principal/director
  if (scope.length === 0) return false;

  return scope.some((s) => {
    if (s.division !== division) return false;
    if (s.class_level !== classLevel) return false;
    if (s.arm) return s.arm === arm;
    return true;
  });
}

module.exports = { getScopeForUser, scopeToSqlClause, isWithinScope };
