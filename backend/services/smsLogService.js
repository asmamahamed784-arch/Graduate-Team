import SMSLog from '../models/SMSLog.js';

// SMS is intentionally log-only for now. Add the real provider integration here
// later, using environment variables for provider URL/API keys.
export const logSmsOnly = async ({ recipient, message }) => {
  if (!recipient) return null;

  return SMSLog.create({
    recipient,
    message,
    status: 'Sent'
  });
};
