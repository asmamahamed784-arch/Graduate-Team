// src/auth/jwtUtils.js
export const TOKEN_KEY = 'nqs_jwt_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const logout = () => {
  clearToken();
  // Optionally redirect to login page
  window.location.href = '/login';
};
