const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit } = require('../middleware/audit');
const { Errors } = require('../utils/errors');

const router = express.Router();

const EVENT_ACTION = {
  open: 'RESULTS_PORTAL_OPENED',
  autologin: 'RESULTS_PORTAL_AUTOLOGIN',
};

/**
 * POST /results-portal/access
 * Logs each time a staff member opens the external results portal, and each
 * time a saved login is sent. The entry records the account and the device.
 */
router.post(
  '/access',
  requireAuth,
  requireRole('director', 'principal', 'head_teacher'),
  [body('event').isIn(Object.keys(EVENT_ACTION))],
  async (req, res, next) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        throw Errors.badRequest('VALIDATION_ERROR', result.array()[0].msg);
      }

      await writeAudit({
        userId: req.auth.userId,
        deviceId: req.auth.deviceId,
        action: EVENT_ACTION[req.body.event],
        entityType: 'results_portal',
        result: 'success',
      });

      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
