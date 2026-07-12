// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { getToken, setToken, clearToken } from '../auth/jwtUtils';

const normalizeRole = (role) => (role === 'user' ? 'citizen' : role);
const ROLE_KEY = 'role';

export const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  role: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  updateUser: () => {},
  loading: true
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = getToken();
      if (token) {
        try {
          const res = await apiClient.get('/api/auth/profile');
          const nextRole = normalizeRole(res.data.role);
          setUser({ ...res.data, role: nextRole });
          setRole(nextRole);
          localStorage.setItem(ROLE_KEY, nextRole);
        } catch {
          clearToken();
          localStorage.removeItem(ROLE_KEY);
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await apiClient.post('/api/auth/login', { username, password });
      const { token, user } = res.data;
      const nextRole = normalizeRole(user.role);
      setToken(token);
      localStorage.setItem(ROLE_KEY, nextRole);
      setUser({ ...user, role: nextRole });
      setRole(nextRole);
      setLoading(false);
      return user;
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  const register = async (username, password) => {
    setLoading(true);
    try {
      const res = await apiClient.post('/api/auth/register', { username, password });
      setLoading(false);
      return res.data;
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/auth/logout', {});
    } catch {
      // Local logout should still complete if the server is unavailable.
    }
    clearToken();
    localStorage.removeItem(ROLE_KEY);
    setUser(null);
    setRole(null);
    window.location.href = '/login';
  };

  const updateUser = (nextUser) => {
    const nextRole = normalizeRole(nextUser?.role) || null;
    setUser(nextUser ? { ...nextUser, role: nextRole } : null);
    setRole(nextRole);
    if (nextRole) {
      localStorage.setItem(ROLE_KEY, nextRole);
    } else {
      localStorage.removeItem(ROLE_KEY);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      role,
      login,
      register,
      logout,
      updateUser,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
