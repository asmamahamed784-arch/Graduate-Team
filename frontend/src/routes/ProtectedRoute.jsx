// src/routes/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks';

/**
 * Route protector that checks for authenticated status and valid roles.
 * Displays a loading spinner if profile fetching is in progress.
 */
export const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Checking session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Role unauthorized - return to respective dashboard
    const dashboardMap = {
      admin: '/dashboard/admin',
      super_admin: '/dashboard/admin',
      operator: '/dashboard/operator',
      super_operator: '/dashboard/operator',
      center_manager: '/dashboard/operator',
      user_manager: '/user-management',
      citizen: '/dashboard/user'
    };
    return <Navigate to={dashboardMap[role] || '/'} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
