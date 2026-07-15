// src/services/authService.js
import { apiClient } from '../api/apiClient';

export const authService = {
  /**
   * Logs in a user using credentials
   */
  login: async (email, password) => {
    const res = await apiClient.post('/api/auth/login', { email, password });
    if (res.data && res.data.token) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role', res.data.user.role);
    }
    return res.data;
  },

  /**
   * Registers a new user account
   */
  register: async (username, password) => {
    const res = await apiClient.post('/api/auth/register', { username, password });
    return res.data;
  },

  /**
   * Fetches active user session profile
   */
  getProfile: async () => {
    const res = await apiClient.get('/api/auth/profile');
    return res.data;
  },

  /**
   * Logs out active user session
   */
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/login';
  },

  /**
   * Helper to retrieve JWT token
   */
  getToken: () => {
    return localStorage.getItem('token');
  },

  /**
   * Checks if user is logged in
   */
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  }
};

export default authService;
