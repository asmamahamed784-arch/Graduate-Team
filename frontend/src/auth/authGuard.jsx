// src/auth/authGuard.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { decodeToken, isTokenValid, hasRole } from './jwt';

/**
 * Advanced ProtectedRoute that validates the JWT token structure and signature.
 * Prevents spoofing the role in local storage.
 */
export const AuthGuard = ({ allowedRoles = [] }) => {
  const token = localStorage.getItem('token');

  // Verify token existence and validity
  if (!token || !isTokenValid(token)) {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    return <Navigate to="/login" replace />;
  }

  // Verify role permission matches allowed roles list
  if (allowedRoles.length > 0 && !hasRole(token, allowedRoles)) {
    // Role exception: Redirect back to their permitted home panel
    const decoded = decodeToken(token);
    const role = String(decoded?.role || '').toLowerCase();
    const centerRoles = ['operator', 'super_operator', 'center_manager'];
    const fallbackPath =
      (role === 'admin' || role === 'super_admin') ? '/dashboard/admin' :
      centerRoles.includes(role) ? '/dashboard/operator' :
      '/dashboard/user';
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
};

export default AuthGuard;
