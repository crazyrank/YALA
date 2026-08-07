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
  [body('operations').isArray({ min: 1 })],
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
