import { Outlet } from 'react-router-dom';

function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--nqs-bg)] text-[var(--nqs-text)]">
      <main className="nqs-public-surface flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default AuthLayout;
