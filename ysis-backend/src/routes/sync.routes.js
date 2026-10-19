const express = require('express');
const { v4: uuidv4, validate: isUuid } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { processBatch } = require('../services/syncService');
const { Errors } = require('../utils/errors');

const router = express.Router();

const OP_TYPES = ['create_student', 'edit_student', 'upload_photo', 'promote_student'];
const MAX_OPERATIONS = 50;

// Checks one operation. Returns an error message, or null if it is valid.
function validateOperation(op) {
  if (!op || typeof op !== 'object' || Array.isArray(op)) {
    return 'Operation must be an object.';
  }
  if (!isUuid(op.operationId)) return 'operationId must be a UUID.';
  if (!OP_TYPES.includes(op.opType)) return 'opType is not supported.';
  if (!isUuid(op.entityId)) return 'entityId must be a UUID.';
  if (!op.payload || typeof op.payload !== 'object' || Array.isArray(op.payload)) {
    return 'payload must be an object.';
  }
  if (!Number.isInteger(op.sequenceNo)) return 'sequenceNo must be an integer.';
  if (typeof op.createdAtClient !== 'string' || Number.isNaN(Date.parse(op.createdAtClient))) {
    return 'createdAtClient must be a date.';
  }
  return null;
}

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const operations = req.body?.operations;

    if (!Array.isArray(operations) || operations.length === 0) {
      throw Errors.badRequest('VALIDATION_ERROR', 'Malformed sync payload.');
    }
    if (operations.length > MAX_OPERATIONS) {
      throw Errors.badRequest(
        'BATCH_TOO_LARGE',
        `A sync batch can hold at most ${MAX_OPERATIONS} operations.`
      );
    }

    // Invalid operations are reported individually. The valid ones still run.
    const valid = [];
    const rejected = [];
    for (const op of operations) {
      const problem = validateOperation(op);
      if (!problem) {
        valid.push(op);
      } else if (typeof op?.operationId === 'string' && isUuid(op.operationId)) {
        rejected.push({
          operationId: op.operationId,
          status: 'failed',
          error: 'VALIDATION_ERROR',
          message: problem,
        });
      }
    }

    const batchId = valid.length > 20 ? uuidv4() : null;

    const processed = valid.length > 0
      ? await processBatch({
          operations: valid,
          userId: req.auth.userId,
          userRole: req.auth.role,
          deviceId: req.auth.deviceId,
          batchId,
        })
      : [];

    return res.json({ results: [...rejected, ...processed], batchId });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
