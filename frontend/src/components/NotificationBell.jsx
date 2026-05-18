import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import api from '../api/axios';

export default function NotificationBell() {
  const { unreadCount, setUnreadCount } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/notifications/unread-count').then(({ data }) => setUnreadCount(data.count)).catch(() => {});
  }, []);

  return (
    <button className="notification-bell" onClick={() => navigate('/notifications')}>
      🔔 {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
    </button>
  );
}
