// src/auth/authService.js
import api from '../api/axiosInstance';

export const login = async (email, password) => {
  const response = await api.post('/api/auth/login', { email, password });
  return response.data; // { token, user }
};

export const logout = async () => {
  return Promise.resolve();
};

export const refreshToken = async () => {
  const response = await api.get('/api/auth/profile');
  return response.data;
};
