const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { processBatch } = require('../services/syncService');
const { Errors } = require('../utils/errors');

const router = express.Router();

router.post(
  '/',
  requireAuth,
  [
    body('operations').isArray({ min: 1 }),
    body('operations.*.operationId').isString().notEmpty(),
    body('operations.*.opType').isIn([
      'create_student', 'edit_student', 'upload_photo', 'promote_student',
    ]),
    body('operations.*.entityId').isUUID(),
    body('operations.*.payload').custom(
      (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
    ).withMessage('payload must be an object'),
    body('operations.*.sequenceNo').isInt(),
    body('operations.*.createdAtClient').optional().isISO8601(),
  ],
  async (req, res, next) => {
    try {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        throw Errors.badRequest('VALIDATION_ERROR', 'Malformed sync payload.');
      }

      const { operations } = req.body;
      const batchId = operations.length > 20 ? uuidv4() : null;

      const results = await processBatch({
        operations,
        userId: req.auth.userId,
        userRole: req.auth.role,
        deviceId: req.auth.deviceId,
        batchId,
      });

      return res.json({ results, batchId });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
