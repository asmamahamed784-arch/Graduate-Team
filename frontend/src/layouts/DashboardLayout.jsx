import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { NotificationProvider } from '../context/NotificationContext';
import { QueueProvider } from '../context/QueueContext';
import { useAuth } from '../hooks';

const SIDEBAR_COLLAPSE_KEY = 'nqs-admin-sidebar-collapsed';

const DashboardLayout = () => {
  const { role } = useAuth();
  const isAdminShell = role === 'admin' || role === 'super_admin';
  const isCitizen = role === 'citizen';
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const effectiveCollapsed = isAdminShell && collapsed;
  const expandedSidebarMargin = isCitizen ? '284px' : '284px';
  const marginLeft = effectiveCollapsed ? '76px' : expandedSidebarMargin;

  return (
    <NotificationProvider>
      <QueueProvider>
        <div className={`nqs-dashboard-surface nqs-app-shell flex min-h-screen bg-[var(--nqs-bg)] text-[var(--nqs-text)] ${effectiveCollapsed ? 'is-sidebar-collapsed' : ''}`}>
          <Sidebar collapsed={effectiveCollapsed} onToggleCollapse={() => setCollapsed((value) => !value)} />
          <div 
            className="nqs-dashboard-main flex h-screen flex-1 flex-col overflow-hidden transition-all duration-200 ease-in-out"
            style={{ '--desktop-ml': marginLeft }}
          >
            <Header />
            <main className="nqs-dashboard-surface nqs-app-content flex-1 overflow-auto bg-[var(--nqs-bg)] p-0">
              <Outlet />
            </main>
          </div>
        </div>
      </QueueProvider>
    </NotificationProvider>
  );
};

export default DashboardLayout;
