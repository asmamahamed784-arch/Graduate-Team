import { normalizeError } from '../utils/errorMessages.js';

export const errorHandler = (err, req, res, _next) => {
  let { statusCode, message } = normalizeError(err);
  if (res.statusCode !== 200) statusCode = res.statusCode;

  // Invalid object-style identifier
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = 'Resource not found';
  }

  // Duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    message = 'Duplicate field value entered';
  }

  // Validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};
