import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <header className="top-bar">
          <button className="profile-btn" onClick={() => navigate('/profile')} title="My Profile">
            <span className="profile-btn-avatar">{user?.name?.charAt(0)?.toUpperCase() || '?'}</span>
            <span className="profile-btn-name">{user?.name}</span>
          </button>
          <NotificationBell />
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
