// src/auth/jwtUtils.js
export const TOKEN_KEY = 'nqs_jwt_token';

export const getToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  return sessionStorage.getItem(TOKEN_KEY);
};

export const setToken = (token) => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
};

export const logout = () => {
  clearToken();
  // Optionally redirect to login page
  window.location.href = '/login';
};
