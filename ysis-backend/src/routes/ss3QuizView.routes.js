const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const db = require('../db');

const router = express.Router();

const ALLOWED_ROLES = ['director', 'principal', 'head_teacher', 'class_teacher'];
const TOKEN_SECONDS = 60;

/**
 * POST /ss3-quiz-view/token
 * Director, Principal and Head Teachers see every SS3 arm.
 * A class teacher sees only the SS3 arm(s) they are assigned to.
 * Returns a link that YalaPrep accepts once, within 60 seconds.
 */
router.post('/token', requireAuth, requireRole(...ALLOWED_ROLES), async (req, res, next) => {
  try {
    if (!process.env.YALAPREP_VIEW_SECRET || !process.env.YALAPREP_ORIGIN) {
      return res.status(503).json({ error: 'NOT_CONFIGURED', message: 'SS3 quiz view is not configured.' });
    }

    const { userId, role, deviceId } = req.auth;
    let arms = null; // null means every SS3 arm

    if (role === 'class_teacher') {
      const { rows } = await db.query(
        `SELECT arm FROM class_teacher_assignments
         WHERE user_id = $1 AND class_level = 'SS3'`,
        [userId]
      );
      if (rows.length === 0) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'This screen is for SS3 class teachers only.' });
      }
      // A class-wide assignment with no arm means all SS3 arms
      arms = rows.some((r) => !r.arm) ? null : rows.map((r) => r.arm);
    }

    const token = jwt.sign(
      { sub: userId, role, arms, scope: 'ss3-view' },
      process.env.YALAPREP_VIEW_SECRET,
      { algorithm: 'HS256', expiresIn: TOKEN_SECONDS, jwtid: crypto.randomUUID() }
    );

    await writeAudit({
      userId,
      deviceId,
      action: 'SS3_QUIZ_VIEW_OPENED',
      entityType: 'ss3_quiz',
      result: 'success',
    });

    return res.json({ url: `${process.env.YALAPREP_ORIGIN}/staff-view#t=${token}` });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
