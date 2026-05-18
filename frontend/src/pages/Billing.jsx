import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function Billing() {
  const [invoices, setInvoices] = useState([]);
  const [campaignId, setCampaignId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const params = {};
    if (campaignId) params.campaignId = campaignId;
    if (statusFilter) params.status = statusFilter;
    api.get('/invoices', { params })
      .then(({ data }) => setInvoices(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (campaignId) params.campaignId = campaignId;
      if (statusFilter) params.status = statusFilter;
      const resp = await api.get('/invoices/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'billing.xlsx';
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const statusColor = (s) => {
    if (s === 'accepted') return 'status-green';
    if (s === 'rejected') return 'status-red';
    return 'status-blue';
  };

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Billing</h1>
        <button className="btn btn-green" onClick={handleExport}>Export Excel</button>
      </div>

      {/* Filters */}
      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
          <input
            placeholder="Search by Campaign ID (e.g. CAMP-0001)"
            value={campaignId} onChange={(e) => setCampaignId(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #d1d5db', minWidth: '200px' }}
          />
          <button type="submit" className="btn btn-primary btn-small">Search</button>
        </form>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #d1d5db' }}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card">
          <h3>Total Invoices</h3>
          <span className="stat-number">{invoices.length}</span>
        </div>
        <div className="stat-card">
          <h3>Total Amount</h3>
          <span className="stat-number">₹{totalAmount.toLocaleString()}</span>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        {loading ? <p className="empty">Loading...</p> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign ID</th>
                <th>Campaign Title</th>
                <th>Client</th>
                <th>Vendor</th>
                <th>Amount (₹)</th>
                <th>Status</th>
                <th>Date</th>
                <th>Invoice File</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#888' }}>No invoices found</td></tr>}
              {invoices.map((inv) => (
                <tr key={inv._id}>
                  <td><strong>{inv.campaignId?.campaignId || '—'}</strong></td>
                  <td>{inv.campaignId?.title || '—'}</td>
                  <td>{inv.campaignId?.clientId?.name || '—'}</td>
                  <td>{inv.vendorId?.name || '—'}</td>
                  <td>₹{inv.amount?.toLocaleString()}</td>
                  <td><span className={`status-badge ${statusColor(inv.status)}`}>{inv.status}</span></td>
                  <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td>{inv.invoiceFileUrl ? <a href={inv.invoiceFileUrl} target="_blank" rel="noreferrer" className="btn btn-small">View</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
