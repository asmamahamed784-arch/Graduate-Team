import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

/**
 * DashboardLayout wraps protected dashboard pages with a persistent sidebar and top header bar.
 * It respects dark mode via Tailwind classes and provides a responsive layout:
 *   - Desktop: sidebar on the left, content column on the right.
 *   - Mobile: sidebar collapses into a top drawer, header handles top controls.
 */
const DashboardLayout = () => {
  return (
    <div className="flex min-h-screen bg-[var(--nqs-bg)] text-[var(--nqs-text)]">
      {/* Sidebar */}
      <Sidebar />
      {/* Main content column */}
      <div className="flex h-screen flex-1 flex-col overflow-hidden md:ml-64">
        {/* Header bar */}
        <Header />
        {/* Page Content area */}
        <main className="nqs-dashboard-surface flex-1 overflow-auto bg-[var(--nqs-bg)] p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
