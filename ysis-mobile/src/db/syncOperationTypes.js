/**
 * Every operation type the phone can queue for sync.
 * One type per feature. The sync_operations table only accepts types listed here.
 * When a type is added, the table is rebuilt once on each phone (slice1Migrations.js).
 */
export const SYNC_OP_TYPES = [
  // Students (existing)
  'create_student',
  'edit_student',
  'upload_photo',
  'promote_student',
  'undo_promote_student',
  // Class teacher and head teacher work
  'biodata_save',
  'biodata_review',
  'log_entry_create',
  'log_entry_edit',
  'student_leave',
  'student_status_change',
  'entrance_outcome',
  'staff_report_save',
  // Admin work
  'staff_profile_update',
  'directory_create',
  'directory_update',
  'directory_delete',
  'user_create',
  'user_status_change',
  'user_delete',
  'class_teacher_assign',
  'device_approve',
  'device_remove',
  'login_block_unblock',
  'guest_create',
  'guest_update_status',
  'guest_renew',
  'permission_delegate_add',
  'permission_delegate_remove',
  'conflict_resolve',
  'merge_queue_resolve',
  'notification_read',
];

/** SQL list literal, e.g. 'a','b','c', used in the CHECK constraint. */
export const SYNC_OP_TYPES_SQL = SYNC_OP_TYPES.map((t) => `'${t}'`).join(',');
