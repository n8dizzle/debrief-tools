'use strict';

/**
 * Application-level error with an HTTP status code.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;    // optional machine-readable code, e.g. 'BATCH_ALREADY_LOCKED'
  }
}

/** 404 catcher — mount AFTER all routes */
const notFound = (req, res, _next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
  });
};

/** Global error handler — mount last */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const isDev = process.env.NODE_ENV !== 'production';

  // Zod validation errors arrive as ZodError
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Postgres unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'A record with that value already exists',
      detail: isDev ? err.detail : undefined,
    });
  }

  // Postgres FK violation
  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Referenced record does not exist',
      detail: isDev ? err.detail : undefined,
    });
  }

  // Application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code || undefined,
    });
  }

  // Unexpected errors
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: isDev ? err.message : 'An unexpected error occurred',
    stack: isDev ? err.stack : undefined,
  });
};

module.exports = { AppError, notFound, errorHandler };
