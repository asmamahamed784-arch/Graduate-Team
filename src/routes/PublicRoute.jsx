// src/routes/PublicRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks';

/**
 * Public routes guard that blocks authenticated users from revisiting
 * guest pages like Login or Register, sending them to their dashboards.
 */
export const PublicRoute = () => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    const dashboardMap = {
      admin: '/dashboard/admin',
      operator: '/dashboard/operator',
      super_operator: '/dashboard/operator',
      citizen: '/dashboard/user'
    };
    return <Navigate to={dashboardMap[role] || '/'} replace />;
  }

  return <Outlet />;
};

export default PublicRoute;
