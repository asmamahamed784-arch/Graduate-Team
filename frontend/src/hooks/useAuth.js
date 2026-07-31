import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * Custom hook to access global Authentication state and operations.
 * Connects with AuthContext and exposes role helper getters.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const { user, role, login, register, logout, updateUser, loading } = context;

  const isAdmin = role === 'admin' || role === 'super_admin';
  const isOperator = role === 'operator' || role === 'super_operator' || role === 'center_manager';
  const isUserManager = role === 'user_manager';
  const isCitizen = role === 'citizen';
  const isUser = isCitizen;

  const hasRole = (allowedRoles) => {
    if (!role) return false;
    return allowedRoles.includes(role);
  };

  return {
    user,
    isAuthenticated: !!user,
    role,
    login,
    register,
    logout,
    updateUser,
    loading,
    isAdmin,
    isOperator,
    isUserManager,
    isCitizen,
    isUser,
    hasRole
  };
};
