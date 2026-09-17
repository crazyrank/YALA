/* eslint-disable camelcase */

exports.shorthands = undefined;

// MANAGE_CLASS_ASSIGNMENTS was seeded in 001_core_auth_devices.js but
// never granted to any role, and no route ever used it. Director and
// principal are the two roles that create head_teacher accounts
// (see CREATABLE_ROLE_BY_CALLER in users.routes.js), so they're the
// two roles that need to be able to assign those accounts a division/
// class scope in head_teacher_class_assignments.
exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO role_permissions (role, permission_id)
    SELECT 'director'::user_role, id FROM permissions WHERE code = 'MANAGE_CLASS_ASSIGNMENTS'
    UNION ALL
    SELECT 'principal'::user_role, id FROM permissions WHERE code = 'MANAGE_CLASS_ASSIGNMENTS';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM role_permissions
    WHERE permission_id = (SELECT id FROM permissions WHERE code = 'MANAGE_CLASS_ASSIGNMENTS')
      AND role IN ('director', 'principal');
  `);
};
