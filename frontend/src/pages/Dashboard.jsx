import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, byStatus: {} });

  useEffect(() => {
    api.get('/campaigns').then(({ data }) => {
      const byStatus = {};
      data.forEach((c) => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });
      setStats({ total: data.length, byStatus });
    }).catch(() => {});
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, <strong>{user?.name}</strong> ({user?.role})</p>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Campaigns</h3>
          <span className="stat-number">{stats.total}</span>
        </div>
        {Object.entries(stats.byStatus).map(([status, count]) => (
          <div key={status} className="stat-card">
            <h3>{status.replace(/_/g, ' ')}</h3>
            <span className="stat-number">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
