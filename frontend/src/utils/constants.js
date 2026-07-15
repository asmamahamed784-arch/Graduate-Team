// src/utils/constants.js
// NQS System Configuration Constants

export const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/';

export const USER_ROLES = {
  USER: 'user',
  OPERATOR: 'operator',
  ADMIN: 'admin',
};

export const TICKET_STATUS = {
  WAITING: 'Waiting',
  SERVING: 'Being Served',
  HOLD: 'On Hold',
  COMPLETED: 'Completed',
};

export const CENTER_STATUS = {
  ACTIVE: 'Active',
  MAINTENANCE: 'Maintenance',
  CLOSED: 'Closed',
};

export const RISK_LEVELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export const SERVICE_CATEGORIES = {
  NATIONAL_ID: 'National ID',
};

export const SERVICE_PRIORITIES = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export const LANGUAGES = {
  EN: 'en',
};
