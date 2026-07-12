import { Outlet } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';

function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--nqs-bg)] text-[var(--nqs-text)] transition-colors duration-300">
      <NavBar />
      <main className="nqs-public-surface flex-1 w-full">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default MainLayout;
