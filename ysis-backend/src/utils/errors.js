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

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({
      error: { code: 'MALFORMED_JSON', message: 'The request body is not valid JSON.' },
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' },
    });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' },
  });
}

module.exports = { AppError, Errors, errorHandler };
