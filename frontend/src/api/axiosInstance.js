// src/api/axiosInstance.js
import axios from 'axios';
import { getToken, logout } from '../auth/jwtUtils';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/',
  timeout: 12000,
});

// Attach JWT from localStorage to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global response handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isLoginRequest = requestUrl.includes('/api/auth/login');
    // Wrong "current password" must not look like an expired session.
    const isPasswordChangeRequest = requestUrl.includes('/api/auth/password');
    const status = error.response?.status;

    if (status === 401 && !isLoginRequest && !isPasswordChangeRequest && getToken()) {
      logout(); // clear token and force logout
    }

    return Promise.reject(error);
  }
);

export default api;
