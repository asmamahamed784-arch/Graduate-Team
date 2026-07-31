export const ERRORS = {
  INVALID_DATE: 'Invalid Date',
  CLOSED_DATE: 'Closed Date',
  CLOSED_TIME: 'Closed Time',
  DUPLICATE_REQUEST: 'Duplicate Request',
  OPERATOR_NOT_APPROVED: 'Operator Not Approved',
  INVALID_OTP: 'Invalid OTP',
  APPOINTMENT_ALREADY_COMPLETED: 'Appointment Already Completed',
  FUTURE_DATE_NOT_ALLOWED: 'Future Date Not Allowed',
  PHONE_NUMBER_ALREADY_EXISTS: 'Phone Number Already Exists'
};

export const sendError = (res, statusCode, message, extra = {}) => (
  res.status(statusCode).json({
    success: false,
    message,
    ...extra
  })
);

export const normalizeError = (error) => {
  if (!error) return { statusCode: 500, message: 'Server Error' };

  if (Object.values(ERRORS).includes(error.message)) {
    return { statusCode: error.statusCode || 400, message: error.message };
  }

  if (error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(' ') : String(error.meta?.target || '');
    if (target.toLowerCase().includes('phone')) {
      return { statusCode: 400, message: ERRORS.PHONE_NUMBER_ALREADY_EXISTS };
    }
    return { statusCode: 400, message: 'Duplicate Request' };
  }

  if (error.code === 'P2025') {
    return { statusCode: 404, message: 'Record not found' };
  }

  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors || {})
      .map((value) => value.message)
      .filter(Boolean)
      .join(', ');
    return { statusCode: 400, message: message || 'Invalid input' };
  }

  if (error.message?.includes('Invalid Date')) {
    return { statusCode: 400, message: ERRORS.INVALID_DATE };
  }

  return {
    statusCode: error.statusCode || 500,
    message: error.message || 'Server Error'
  };
};
