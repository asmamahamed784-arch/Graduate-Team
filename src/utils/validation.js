// src/utils/validation.js
// Custom validation helpers for inputs, credentials, and references

/**
 * Validates whether an email format is correct
 */
export const validateEmail = (email) => {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(String(email).toLowerCase());
};

/**
 * Validates a password (must be at least 6 characters)
 */
export const validatePassword = (password) => {
  return typeof password === 'string' && password.trim().length >= 6;
};

/**
 * Validates Somalia-style or general phone number formats
 */
export const validatePhone = (phone) => {
  const re = /^(?:\+?252|0)?6[0-9]{8}$/;
  return re.test(String(phone).replace(/\s+/g, ''));
};

/**
 * Validates NQS Ticket Reference numbers e.g. NQS-1023
 */
export const validateTicketReference = (ref) => {
  const re = /^NQS-\d{4}$/i;
  return re.test(String(ref).trim());
};

/**
 * Validates National ID format (exactly 10 digits)
 */
export const validateNationalID = (id) => {
  const re = /^\d{10}$/;
  return re.test(String(id).trim());
};

/**
 * Checks for SQL injection or scripting patterns.
 */
export const checkInputSafety = (input) => {
  if (typeof input !== 'string') return true;
  const lowercase = input.toLowerCase();
  const dangerousPatterns = [
    'select * from',
    'drop table',
    'insert into',
    '<script>',
    'javascript:',
    'union select',
    '--'
  ];
  return !dangerousPatterns.some(pattern => lowercase.includes(pattern));
};
