// src/auth/jwtUtils.js
export const TOKEN_KEY = 'nqs_jwt_token';

const safeStorage = (storage, action, fallback = null) => {
  try {
    return action(storage);
  } catch {
    return fallback;
  }
};

export const getToken = () => {
  safeStorage(localStorage, (store) => store.removeItem(TOKEN_KEY));
  return safeStorage(sessionStorage, (store) => store.getItem(TOKEN_KEY), null);
};

export const setToken = (token) => {
  safeStorage(localStorage, (store) => store.removeItem(TOKEN_KEY));
  safeStorage(sessionStorage, (store) => store.setItem(TOKEN_KEY, token));
};

export const clearToken = () => {
  safeStorage(sessionStorage, (store) => store.removeItem(TOKEN_KEY));
  safeStorage(localStorage, (store) => store.removeItem(TOKEN_KEY));
};

export const logout = () => {
  clearToken();
  // Optionally redirect to login page
  window.location.href = '/login';
};
