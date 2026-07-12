// src/routes/RoleRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks';

/**
 * Route protection mapping a child component directly to a required role,
 * returning unauthorized roles back to their default dashboards.
 */
export const RoleRoute = ({ children, requiredRole }) => {
  const { role, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== requiredRole) {
    const fallbackMap = {
      admin: '/dashboard/admin',
      operator: '/dashboard/operator',
      citizen: '/dashboard/user'
    };
    return <Navigate to={fallbackMap[role] || '/'} replace />;
  }

  return children;
};

export default RoleRoute;
