import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

/**
 * ProtectedRoute component
 * -------------------------------------------------
 * Checks the authenticated user's role stored in localStorage (set during login).
 * Allows access only if the role matches one of the allowedRoles array.
 * If the user is not logged in or role is not permitted, redirects to /login.
 *
 * Usage example:
 * <ProtectedRoute allowedRoles={['admin', 'operator']}>
 *   <AdminDashboard />
 * </ProtectedRoute>
 */
const ProtectedRoute = ({ allowedRoles }) => {
  const role = localStorage.getItem('role'); // values: 'user', 'operator', 'admin'

  if (!role || !allowedRoles.includes(role)) {
    // Not authorized – redirect to login (or a "Not Authorized" page if you prefer)
    return <Navigate to="/login" replace />;
  }

  // Authorized – render nested routes
  return <Outlet />;
};

export default ProtectedRoute;
