import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../hooks';

/**
 * DashboardLayout wraps protected dashboard pages with a persistent sidebar and top header bar.
 * It respects dark mode via Tailwind classes and provides a responsive layout:
 *   - Desktop: sidebar on the left, content column on the right.
 *   - Mobile: sidebar collapses into a top drawer, header handles top controls.
 */
const DashboardLayout = () => {
  const { role } = useAuth();
  const isCitizenPortal = role === 'citizen';

  return (
    <div className={`nqs-dashboard-surface flex min-h-screen ${isCitizenPortal ? 'nqs-citizen-layout bg-[var(--nqs-bg)] text-[var(--nqs-text)]' : 'bg-[var(--nqs-bg)] text-[var(--nqs-text)]'}`}>
      {/* Sidebar */}
      <Sidebar />
      {/* Main content column */}
      <div className="flex h-screen flex-1 flex-col overflow-hidden md:ml-64">
        {/* Header bar */}
        <Header />
        {/* Page Content area */}
        <main className={isCitizenPortal ? 'nqs-dashboard-surface flex-1 overflow-auto bg-[var(--nqs-bg)]' : 'nqs-dashboard-surface flex-1 overflow-auto bg-[var(--nqs-bg)] p-4'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
