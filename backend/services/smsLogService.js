import prisma from '../config/prisma.js';

const logSms = async ({ recipient, message, status, errorReason = '' }) => {
  const log = await prisma.sMSLog.create({
    data: {
      recipient,
      message,
      status
    }
  });
  return { ...log, errorReason };
};

const env = (key, fallback = '') => process.env[key] || fallback;

const joinUrl = (base, path = '') => {
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  return `${String(base || '').replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
};

const formatRecipientForProvider = (recipient) => {
  const raw = String(recipient || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (env('SMS_STRIP_COUNTRY_CODE', 'false').toLowerCase() !== 'true') return raw;
  if (digits.startsWith('252')) return digits.slice(3);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
};

const readPath = (value, path) => String(path || '')
  .split('.')
  .filter(Boolean)
  .reduce((current, key) => (current && current[key] !== undefined ? current[key] : undefined), value);

const extractToken = (payload) => {
  const configured = readPath(payload, env('SMS_TOKEN_FIELD', 'token'));
  return configured || payload?.token || payload?.accessToken || payload?.data?.token || payload?.data?.accessToken;
};

const loginToSmsProvider = async ({ providerUrl, username, password }) => {
  const loginEndpoint = process.env.SMS_LOGIN_ENDPOINT;
  if (!loginEndpoint || !username || !password) return null;

  const loginUrl = joinUrl(providerUrl, loginEndpoint);
  const response = await fetch(joinUrl(providerUrl, loginEndpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      [env('SMS_LOGIN_USERNAME_FIELD', 'username')]: username,
      [env('SMS_LOGIN_PASSWORD_FIELD', 'password')]: password
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`SMS login failed (${response.status}) at ${loginUrl}: ${text.slice(0, 180)}`);
  }
  const payload = await response.json().catch(() => ({}));
  const token = extractToken(payload);
  if (!token) {
    throw new Error(`SMS login succeeded but token was not found. Set SMS_TOKEN_FIELD to the correct response field.`);
  }
  return token;
};

export const sendSms = async ({ recipient, message }) => {
  if (!recipient) return null;

  const providerUrl = process.env.SMS_PROVIDER_URL;
  const apiKey = process.env.SMS_API_KEY;
  const username = process.env.SMS_USERNAME;
  const password = process.env.SMS_PASSWORD;
  const senderId = process.env.SMS_SENDER_ID || 'NQS';
  const authHeader = env('SMS_AUTH_HEADER', 'Authorization');
  const authPrefix = env('SMS_AUTH_PREFIX', 'Bearer');
  const toField = env('SMS_TO_FIELD', 'to');
  const providerRecipient = formatRecipientForProvider(recipient);
  const logRecipient = recipient;
  const toValue = env('SMS_TO_ARRAY', 'false').toLowerCase() === 'true' ? [providerRecipient] : providerRecipient;
  const messageField = env('SMS_MESSAGE_FIELD', 'message');
  const senderField = env('SMS_SENDER_FIELD', 'sender');
  const includeSender = env('SMS_INCLUDE_SENDER', 'false').toLowerCase() === 'true';
  const apiKeyField = env('SMS_API_KEY_FIELD');
  const bodyWrapper = env('SMS_BODY_WRAPPER');

  if (!providerUrl || (!apiKey && (!username || !password))) {
    return logSms({ recipient: logRecipient, message, status: 'Logged' });
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = await loginToSmsProvider({ providerUrl, username, password });
    const credential = token || apiKey;

    if (credential && !apiKeyField) {
      headers[authHeader] = authPrefix ? `${authPrefix} ${credential}` : credential;
    }

    const requestBody = {
      [toField]: toValue,
      [messageField]: message
    };
    if (includeSender && senderField) {
      requestBody[senderField] = senderId;
    }
    if (credential && apiKeyField) {
      requestBody[apiKeyField] = credential;
    }
    const body = bodyWrapper ? { [bodyWrapper]: requestBody } : requestBody;

    const sendUrl = joinUrl(providerUrl, process.env.SMS_SEND_ENDPOINT);
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`SMS send failed (${response.status}) at ${sendUrl}: ${text.slice(0, 500)}`);
      return logSms({ recipient: logRecipient, message, status: 'Failed' });
    }

    return logSms({ recipient: logRecipient, message, status: 'Sent' });
  } catch (error) {
    const reason = error.message || 'SMS send failed.';
    console.error(reason);
    return logSms({ recipient: logRecipient, message, status: 'Failed', errorReason: reason });
  }
};

export const logSmsOnly = sendSms;
