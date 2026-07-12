// src/utils/storage.js
// Custom, safe wrapper around LocalStorage and SessionStorage APIs with fallback

const PREFIX = 'nqs_';

export const storage = {
  // LocalStorage Get
  get: (key, fallback = null) => {
    try {
      const value = localStorage.getItem(`${PREFIX}${key}`);
      return value ? JSON.parse(value) : fallback;
    } catch (e) {
      console.warn(`[storage] LocalStorage get error for key "${key}":`, e);
      return fallback;
    }
  },

  // LocalStorage Set
  set: (key, value) => {
    try {
      localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`[storage] LocalStorage set error for key "${key}":`, e);
      return false;
    }
  },

  // LocalStorage Remove
  remove: (key) => {
    try {
      localStorage.removeItem(`${PREFIX}${key}`);
      return true;
    } catch (e) {
      console.warn(`[storage] LocalStorage remove error for key "${key}":`, e);
      return false;
    }
  },

  // SessionStorage Get
  sessionGet: (key, fallback = null) => {
    try {
      const value = sessionStorage.getItem(`${PREFIX}${key}`);
      return value ? JSON.parse(value) : fallback;
    } catch (e) {
      console.warn(`[storage] SessionStorage get error for key "${key}":`, e);
      return fallback;
    }
  },

  // SessionStorage Set
  sessionSet: (key, value) => {
    try {
      sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`[storage] SessionStorage set error for key "${key}":`, e);
      return false;
    }
  },

  // Clear all NQS items
  clearAll: () => {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith(PREFIX)) {
          sessionStorage.removeItem(key);
        }
      });
      return true;
    } catch (e) {
      console.warn('[storage] Storage clearing failed:', e);
      return false;
    }
  }
};

export default storage;
