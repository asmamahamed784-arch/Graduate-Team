// src/routes/AppRoutes.jsx
import React, { Suspense, lazy } from 'react';
import { Link, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';

// Guarantees & guards
import ProtectedRoute from './ProtectedRoute';
import PublicRoute from './PublicRoute';

// Lazy loading views
const Home = lazy(() => import('../pages/Home.jsx'));
const About = lazy(() => import('../pages/About.jsx'));
const Services = lazy(() => import('../pages/Services.jsx'));
const Centers = lazy(() => import('../pages/Centers.jsx'));
const FAQ = lazy(() => import('../pages/FAQ.jsx'));
const Contact = lazy(() => import('../pages/Contact.jsx'));
const TrackQueue = lazy(() => import('../pages/TrackQueue.jsx'));
const NewIdRegistration = lazy(() => import('../pages/NewIdRegistration.jsx'));
const UpdateInformationRequest = lazy(() => import('../pages/UpdateInformationRequest.jsx'));
const ReplaceLostId = lazy(() => import('../pages/ReplaceLostId.jsx'));
const LiveQueue = lazy(() => import('../pages/LiveQueue.jsx'));

const UserDashboard = lazy(() => import('../pages/UserDashboard.jsx'));
const UserAppointments = lazy(() => import('../pages/UserAppointments.jsx'));
const OperatorDashboard = lazy(() => import('../pages/OperatorDashboard.jsx'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard.jsx'));
const AdminAppointments = lazy(() => import('../pages/AdminAppointments.jsx'));
const OperatorManagement = lazy(() => import('../pages/OperatorManagement.jsx'));
const ActiveSessions = lazy(() => import('../pages/ActiveSessions.jsx'));

const Login = lazy(() => import('../pages/Login.jsx'));
const Register = lazy(() => import('../pages/Register.jsx'));

const Reports = lazy(() => import('../pages/Reports.jsx'));
const QueueManagement = lazy(() => import('../pages/QueueManagement.jsx'));
const ServiceManagement = lazy(() => import('../pages/ServiceManagement.jsx'));
const CenterManagement = lazy(() => import('../pages/CenterManagement.jsx'));
const QRVerify = lazy(() => import('../pages/QRVerify.jsx'));
const NotificationManagement = lazy(() => import('../pages/NotificationManagement.jsx'));
const AntiCorruptionLogs = lazy(() => import('../pages/AntiCorruptionLogs.jsx'));
const Settings = lazy(() => import('../pages/Settings.jsx'));
const Profile = lazy(() => import('../pages/Profile.jsx'));

const Loader = () => (
  <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      <span className="text-sm text-gray-500 dark:text-gray-400">Loading NQS Portal...</span>
    </div>
  </div>
);

const NotFound = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
    <h1 className="text-6xl font-bold text-blue-700 dark:text-blue-500 mb-4 animate-pulse">404</h1>
    <p className="text-xl text-gray-600 dark:text-gray-300 mb-6 font-semibold">The page you requested could not be located.</p>
    <Link to="/" className="px-6 py-3 bg-blue-700 text-white rounded-xl hover:bg-blue-800 transition shadow-lg font-medium">
      Return Home
    </Link>
  </div>
);

export const AppRoutes = () => {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Standalone TV Screen */}
        <Route path="/live" element={<LiveQueue />} />
        <Route path="/live-queue" element={<LiveQueue />} />

        {/* Public pages */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/centers" element={<Centers />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<Contact />} />
        </Route>

        {/* Citizen appointment pages require authentication */}
        <Route element={<ProtectedRoute allowedRoles={['citizen', 'admin']} />}>
          <Route path="/booking" element={<Navigate to="/dashboard/user/new-id-registration" replace />} />
          <Route path="/services" element={<Navigate to="/dashboard/user/services" replace />} />
          <Route path="/services/new-id-registration" element={<Navigate to="/dashboard/user/new-id-registration" replace />} />
          <Route path="/services/update-information" element={<Navigate to="/dashboard/user/update-information" replace />} />
          <Route path="/services/replace-lost-id" element={<Navigate to="/dashboard/user/replace-lost-id" replace />} />
          <Route path="/track" element={<Navigate to="/dashboard/user/track" replace />} />
        </Route>

        {/* Guest-only Auth Pages (redirects if logged in) */}
        <Route element={<PublicRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>
        </Route>

        {/* Shared authenticated pages */}
        <Route element={<ProtectedRoute allowedRoles={['citizen', 'operator', 'super_operator', 'admin']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Queue operations available to staff and admins */}
        <Route element={<ProtectedRoute allowedRoles={['operator', 'super_operator', 'admin']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/queue-management" element={<QueueManagement />} />
            <Route path="/qr-scan" element={<QRVerify />} />
            <Route path="/qr-verify" element={<QRVerify />} />
          </Route>
        </Route>

        {/* Citizen Portal (User) */}
        <Route element={<ProtectedRoute allowedRoles={['citizen']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard/user" element={<UserDashboard />} />
            <Route path="/dashboard/user/appointments" element={<UserAppointments />} />
            <Route path="/dashboard/user/services" element={<Services />} />
            <Route path="/dashboard/user/booking" element={<Navigate to="/dashboard/user/new-id-registration" replace />} />
            <Route path="/dashboard/user/new-id-registration" element={<NewIdRegistration />} />
            <Route path="/dashboard/user/update-information" element={<UpdateInformationRequest />} />
            <Route path="/dashboard/user/replace-lost-id" element={<ReplaceLostId />} />
            <Route path="/dashboard/user/track" element={<TrackQueue />} />
          </Route>
        </Route>

        {/* Operator / Staff Portal */}
        <Route element={<ProtectedRoute allowedRoles={['operator', 'super_operator']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/operator-dashboard" element={<OperatorDashboard />} />
            <Route path="/dashboard/operator" element={<OperatorDashboard />} />
            <Route path="/dashboard/operator/qr-scan" element={<QRVerify />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['admin', 'super_operator']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/operator-management" element={<OperatorManagement />} />
          </Route>
        </Route>

        {/* System Administration Portal */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard/admin" element={<AdminDashboard />} />
            <Route path="/dashboard/admin/qr-scan" element={<QRVerify />} />
            <Route path="/admin-appointments" element={<AdminAppointments />} />
            <Route path="/admin-appointments/center" element={<AdminAppointments />} />
            <Route path="/active-sessions" element={<ActiveSessions />} />
            <Route path="/reports" element={<Navigate to="/dashboard/admin/reports" replace />} />
            <Route path="/dashboard/admin/reports" element={<Reports />} />
            <Route path="/dashboard/admin/reports/applications" element={<Reports />} />
            <Route path="/dashboard/admin/reports/operators" element={<Reports />} />
            <Route path="/dashboard/admin/reports/citizens" element={<Reports />} />
            <Route path="/dashboard/admin/reports/citizens/all" element={<Reports />} />
            <Route path="/dashboard/admin/reports/citizens/male" element={<Reports />} />
            <Route path="/dashboard/admin/reports/citizens/female" element={<Reports />} />
            <Route path="/dashboard/admin/reports/citizens/districts" element={<Reports />} />
            <Route path="/dashboard/admin/reports/security" element={<Reports />} />
            <Route path="/service-management" element={<ServiceManagement />} />
            <Route path="/center-management" element={<CenterManagement />} />
            <Route path="/citizen-management" element={<Navigate to="/active-sessions" replace />} />
            <Route path="/users-management" element={<Navigate to="/active-sessions" replace />} />
            <Route path="/citizens" element={<Navigate to="/active-sessions" replace />} />
            <Route path="/notifications" element={<NotificationManagement />} />
            <Route path="/logs" element={<AntiCorruptionLogs />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        {/* Catch-all 404 */}
        <Route element={<MainLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
