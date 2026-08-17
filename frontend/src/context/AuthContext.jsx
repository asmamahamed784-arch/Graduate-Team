// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { getToken, setToken, clearToken } from '../auth/jwtUtils';

const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (value === 'user') return 'citizen';
  if (['user_management', 'user_management_role', 'user_manager'].includes(value)) return 'user_manager';
  return value;
};
const ROLE_KEY = 'role';
const safeStorage = (storage, action, fallback = null) => {
  try {
    return action(storage);
  } catch {
    return fallback;
  }
};

const setStoredRole = (nextRole) => {
  safeStorage(localStorage, (store) => store.removeItem(ROLE_KEY));
  if (nextRole) {
    safeStorage(sessionStorage, (store) => store.setItem(ROLE_KEY, nextRole));
  } else {
    safeStorage(sessionStorage, (store) => store.removeItem(ROLE_KEY));
  }
};

export const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  role: null,
  login: async () => {},
  verifyLoginOtp: async () => {},
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
          setStoredRole(nextRole);
        } catch {
          clearToken();
          setStoredRole(null);
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
      if (res.data?.otpRequired) {
        setLoading(false);
        return res.data;
      }
      const { token, user } = res.data;
      const nextRole = normalizeRole(user.role);
      setToken(token);
      setStoredRole(nextRole);
      setUser({ ...user, role: nextRole });
      setRole(nextRole);
      setLoading(false);
      return user;
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  const verifyLoginOtp = async (loginToken, code, otpId) => {
    setLoading(true);
    try {
      const res = await apiClient.post('/api/auth/login/otp/verify', { loginToken, code, otpId });
      const { token, user } = res.data;
      const nextRole = normalizeRole(user.role);
      setToken(token);
      setStoredRole(nextRole);
      setUser({ ...user, role: nextRole });
      setRole(nextRole);
      setLoading(false);
      return user;
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  const register = async (username, password, phone = '') => {
    setLoading(true);
    try {
      const res = await apiClient.post('/api/auth/register', { username, password, phone });
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
    setStoredRole(null);
    setUser(null);
    setRole(null);
    window.location.href = '/login';
  };

  const updateUser = (nextUser) => {
    const nextRole = normalizeRole(nextUser?.role) || null;
    setUser(nextUser ? { ...nextUser, role: nextRole } : null);
    setRole(nextRole);
    setStoredRole(nextRole);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      role,
      login,
      verifyLoginOtp,
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
