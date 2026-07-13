import { Outlet } from 'react-router-dom';

function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F8FC] text-slate-900 dark:bg-[#061225] dark:text-slate-100">
      <main className="nqs-public-surface flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default AuthLayout;
