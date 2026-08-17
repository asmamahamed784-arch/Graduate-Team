import { Outlet } from 'react-router-dom';

function AuthLayout() {
  // Do not use nqs-public-surface / nqs-auth-page here — theme CSS forces those
  // to a flat background and can wash out the Login screen.
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default AuthLayout;
