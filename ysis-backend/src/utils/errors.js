/**
 * Shared error shape across every route:
 *   { "error": { "code": "...", "message": "human-readable, no raw IDs" } }
 *
 * Status code conventions (per YSIS_BUILD_SPEC.md Section 13):
 *   400 bad payload / missing required fields
 *   401 no or expired JWT
 *   403 valid JWT, wrong role/permission
 *   404 not found or not visible to caller's scope
 *   409 sync_version mismatch / duplicate operation conflict
 *   423 device not trusted (distinct from 401 — client should re-register)
 *   500 unexpected — never leak internals to the client
 */
class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const Errors = {
  badRequest: (code, message) => new AppError(400, code, message),
  unauthorized: (message = 'You need to sign in again.') =>
    new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You do not have permission to do this.') =>
    new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'That record could not be found.') =>
    new AppError(404, 'NOT_FOUND', message),
  conflict: (code, message) => new AppError(409, code, message),
  deviceNotTrusted: (message = 'This device needs to be verified again.') =>
    new AppError(423, 'DEVICE_NOT_TRUSTED', message),
};

// Express error-handling middleware — mount this LAST, after all routes.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  // Unexpected error: log full details server-side only, never leak to client.
  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' },
  });
}

module.exports = { AppError, Errors, errorHandler };
