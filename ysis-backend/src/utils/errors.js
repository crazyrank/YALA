class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const Errors = {
  badRequest: (code, message) => new AppError(400, code || 'BAD_REQUEST', message),
  unauthorized: (message = 'You need to sign in again.') =>
    new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You do not have permission to do this.') =>
    new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'That resource could not be found.') =>
    new AppError(404, 'NOT_FOUND', message),
  deviceNotTrusted: (message = 'This device is not trusted. Contact your Principal.') =>
    new AppError(423, 'DEVICE_NOT_TRUSTED', message),
  accountLocked: (message = 'This account is temporarily locked. Try again later or contact your administrator.') =>
    new AppError(423, 'ACCOUNT_LOCKED', message),
  mustChangePassword: (message = 'You must set a new password before continuing.') =>
    new AppError(403, 'MUST_CHANGE_PASSWORD', message),
};

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  // express-validator style or unexpected
  console.error('[UNHANDLED]', err);
  return res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' },
  });
}

module.exports = { AppError, Errors, errorHandler };
