import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../api/axios';

export default function Notifications() {
  const { notifications, setNotifications, setUnreadCount } = useSocket();

  useEffect(() => {
    api.get('/notifications').then(({ data }) => setNotifications(data)).catch(() => {});
  }, []);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await api.patch('/notifications/mark-all-read');
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Notifications</h1>
        <button className="btn btn-small" onClick={markAllRead}>Mark All Read</button>
      </div>
      <div className="notification-list">
        {notifications.length === 0 && <p className="empty">No notifications</p>}
        {notifications.map((n) => (
          <div key={n._id} className={`card notification-card ${n.read ? 'read' : 'unread'}`} onClick={() => !n.read && markRead(n._id)}>
            <div className="notification-header">
              <strong>{n.title}</strong>
              <span className="notification-time">{new Date(n.createdAt).toLocaleString()}</span>
            </div>
            <p>{n.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
