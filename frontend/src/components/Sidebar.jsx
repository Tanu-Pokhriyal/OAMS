import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = {
  admin: [
    { to: '/', label: 'Dashboard' },
    { to: '/campaigns', label: 'Campaigns' },
    { to: '/operations', label: 'Operations' },
    { to: '/users', label: 'Users' },
    { to: '/billing', label: 'Billing' },
    { to: '/settings', label: 'Settings' },
    { to: '/notifications', label: 'Notifications' },
  ],
  client: [
    { to: '/', label: 'Dashboard' },
    { to: '/campaigns', label: 'My Campaigns' },
    { to: '/operations', label: 'Operations' },
    { to: '/notifications', label: 'Notifications' },
  ],
  vendor: [
    { to: '/', label: 'Dashboard' },
    { to: '/campaigns', label: 'Assigned Campaigns' },
    { to: '/operations', label: 'Operations' },
    { to: '/notifications', label: 'Notifications' },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navItems[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Billboard MS</h2>
        <span className="role-badge">{user?.role}</span>
      </div>
      <nav className="sidebar-nav">
        {items.map(({ to, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
          <div className="sidebar-avatar">{user?.name?.charAt(0)?.toUpperCase() || '?'}</div>
          <div>
            <p style={{ margin: 0 }}>{user?.name}</p>
            <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>View Profile</span>
          </div>
        </div>
        <button onClick={handleLogout} className="btn btn-logout">Logout</button>
      </div>
    </aside>
  );
}
