import { Outlet } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';

function MainLayout() {
  return (
    <div className="nqs-public-blue-lock flex min-h-screen flex-col transition-colors duration-300">
      <NavBar />
      <main className="nqs-public-surface flex-1 w-full">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default MainLayout;
