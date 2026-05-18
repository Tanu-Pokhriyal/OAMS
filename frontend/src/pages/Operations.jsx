import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const TABS = [
  { key: 'vendor-allocation', label: 'Vendor Allocation' },
  { key: 'site-survey', label: 'Site Survey' },
  { key: 'creatives', label: 'Creatives' },
  { key: 'work-order', label: 'Work Order' },
  { key: 'installation', label: 'Installation' },
  { key: 'invoice', label: 'Invoice' },
];

const SUB_URLS = {
  'site-survey': '/site-surveys',
  'creatives': '/creatives',
  'work-order': '/work-orders',
  'installation': '/installations',
  'invoice': '/invoices',
};

/* Campaign status order used to determine if a campaign has reached a particular phase */
const STATUS_ORDER = [
  'awaiting_documents', 'pending_approval', 'approved', 'rejected', 'rework_required',
  'vendor_allocated', 'survey_in_progress', 'survey_completed',
  'creatives_in_progress', 'creatives_ready',
  'work_order_issued', 'installation_in_progress', 'installation_completed',
  'client_verified', 'client_disputed',
  'invoiced', 'invoice_accepted', 'invoice_rejected', 'closed',
];

/* The first campaign status that marks a phase as "started" */
const PHASE_START = {
  'vendor-allocation': 'vendor_allocated',
  'site-survey': 'survey_in_progress',
  'creatives': 'creatives_in_progress',
  'work-order': 'work_order_issued',
  'installation': 'installation_in_progress',
  'invoice': 'invoiced',
};

const idx = (s) => { const i = STATUS_ORDER.indexOf(s); return i === -1 ? -1 : i; };

const phaseLabel = (campaignStatus, tab, hasRecord) => {
  if (hasRecord) return null; // use the sub-record's own status
  const ci = idx(campaignStatus);
  const si = idx(PHASE_START[tab]);
  if (ci >= si) return 'not started';
  return 'pending';
};

export default function Operations() {
  const [activeTab, setActiveTab] = useState('vendor-allocation');
  const [searchId, setSearchId] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [recordMap, setRecordMap] = useState({}); // campaignObjId -> latest sub-record
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = async (tab, search) => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.campaignId = search;

      const { data: camps } = await api.get('/campaigns', { params });
      setCampaigns(camps);

      if (SUB_URLS[tab]) {
        const { data: records } = await api.get(SUB_URLS[tab], { params });
        const arr = Array.isArray(records) ? records : [records];
        const map = {};
        arr.forEach(r => {
          const cId = r.campaignId?._id || r.campaignId;
          if (cId && (!map[cId] || new Date(r.createdAt) > new Date(map[cId].createdAt))) {
            map[cId] = r;
          }
        });
        setRecordMap(map);
      } else {
        setRecordMap({});
      }
    } catch {
      setCampaigns([]);
      setRecordMap({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(activeTab, searchId); }, [activeTab]);

  const handleSearch = (e) => {
    e.preventDefault();
    load(activeTab, searchId);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchId('');
    setCampaigns([]);
    setRecordMap({});
  };

  const statusColor = (s) => {
    if (!s) return 'status-blue';
    if (['approved', 'completed', 'verified', 'accepted', 'closed', 'survey_completed', 'creatives_ready', 'installation_completed', 'client_verified', 'invoice_accepted'].includes(s)) return 'status-green';
    if (['rejected', 'disputed', 'client_disputed', 'invoice_rejected'].includes(s)) return 'status-red';
    if (s === 'pending') return 'status-orange';
    return 'status-blue';
  };

  const fmtStatus = (s) => s?.replace(/_/g, ' ') || '—';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';
  const goToCampaign = (id) => navigate(`/campaigns/${id}?section=${activeTab}`);

  const renderTable = () => {
    if (loading) return <p style={{ padding: '1rem', color: '#888' }}>Loading...</p>;
    if (campaigns.length === 0) return <p style={{ padding: '1rem', color: '#888' }}>No records found.</p>;

    switch (activeTab) {
      case 'vendor-allocation':
        return (
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign ID</th>
                <th>Title</th>
                <th>Client</th>
                <th>Vendor</th>
                <th>Campaign Status</th>
                <th>Allocation Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const allocated = !!c.vendorId;
                return (
                  <tr key={c._id} onClick={() => goToCampaign(c._id)} style={{ cursor: 'pointer' }}>
                    <td><span className="campaign-id">{c.campaignId}</span></td>
                    <td>{c.title}</td>
                    <td>{c.clientId?.name || '—'}</td>
                    <td>{allocated ? c.vendorId?.name : '—'}</td>
                    <td><span className={statusColor(c.status)}>{fmtStatus(c.status)}</span></td>
                    <td><span className={allocated ? 'status-green' : 'status-orange'}>{allocated ? 'Allocated' : 'Not Allocated'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );

      case 'site-survey':
        return (
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign ID</th>
                <th>Campaign</th>
                <th>Vendor</th>
                <th>Images</th>
                <th>Campaign Status</th>
                <th>Survey Status</th>
                <th>PDF</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const r = recordMap[c._id];
                const label = phaseLabel(c.status, 'site-survey', !!r);
                return (
                  <tr key={c._id} onClick={() => goToCampaign(c._id)} style={{ cursor: 'pointer' }}>
                    <td><span className="campaign-id">{c.campaignId}</span></td>
                    <td>{c.title}</td>
                    <td>{r?.vendorId?.name || c.vendorId?.name || '—'}</td>
                    <td>{r ? (r.images?.length || 0) : '—'}</td>
                    <td><span className={statusColor(c.status)}>{fmtStatus(c.status)}</span></td>
                    <td><span className={statusColor(r?.status || label)}>{r ? fmtStatus(r.status) : label}</span></td>
                    <td>{r?.pdfUrl ? <a href={`http://localhost:5001${r.pdfUrl}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>View</a> : '—'}</td>
                    <td>{r ? fmtDate(r.createdAt) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );

      case 'creatives':
        return (
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign ID</th>
                <th>Campaign</th>
                <th>Description</th>
                <th>Campaign Status</th>
                <th>Creative Status</th>
                <th>Image</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const r = recordMap[c._id];
                const label = phaseLabel(c.status, 'creatives', !!r);
                return (
                  <tr key={c._id} onClick={() => goToCampaign(c._id)} style={{ cursor: 'pointer' }}>
                    <td><span className="campaign-id">{c.campaignId}</span></td>
                    <td>{c.title}</td>
                    <td>{r?.description || '—'}</td>
                    <td><span className={statusColor(c.status)}>{fmtStatus(c.status)}</span></td>
                    <td><span className={statusColor(r?.status || label)}>{r ? fmtStatus(r.status) : label}</span></td>
                    <td>{r?.creativeImageUrl ? <a href={`http://localhost:5001${r.creativeImageUrl}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>View</a> : '—'}</td>
                    <td>{r ? fmtDate(r.createdAt) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );

      case 'work-order':
        return (
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign ID</th>
                <th>Campaign</th>
                <th>Vendor</th>
                <th>Campaign Status</th>
                <th>Work Order Status</th>
                <th>PDF</th>
                <th>Issued</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const r = recordMap[c._id];
                const label = phaseLabel(c.status, 'work-order', !!r);
                return (
                  <tr key={c._id} onClick={() => goToCampaign(c._id)} style={{ cursor: 'pointer' }}>
                    <td><span className="campaign-id">{c.campaignId}</span></td>
                    <td>{c.title}</td>
                    <td>{r?.vendorId?.name || c.vendorId?.name || '—'}</td>
                    <td><span className={statusColor(c.status)}>{fmtStatus(c.status)}</span></td>
                    <td><span className={statusColor(r?.status || label)}>{r ? fmtStatus(r.status) : label}</span></td>
                    <td>{r?.pdfUrl ? <a href={`http://localhost:5001${r.pdfUrl}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>View</a> : '—'}</td>
                    <td>{r ? fmtDate(r.issuedDate) : '—'}</td>
                    <td>{r ? fmtDate(r.closedDate) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );

      case 'installation':
        return (
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign ID</th>
                <th>Campaign</th>
                <th>Vendor</th>
                <th>Images</th>
                <th>Campaign Status</th>
                <th>Installation Status</th>
                <th>PDF</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const r = recordMap[c._id];
                const label = phaseLabel(c.status, 'installation', !!r);
                return (
                  <tr key={c._id} onClick={() => goToCampaign(c._id)} style={{ cursor: 'pointer' }}>
                    <td><span className="campaign-id">{c.campaignId}</span></td>
                    <td>{c.title}</td>
                    <td>{r?.vendorId?.name || c.vendorId?.name || '—'}</td>
                    <td>{r ? (r.images?.length || 0) : '—'}</td>
                    <td><span className={statusColor(c.status)}>{fmtStatus(c.status)}</span></td>
                    <td><span className={statusColor(r?.status || label)}>{r ? fmtStatus(r.status) : label}</span></td>
                    <td>{r?.reportPdfUrl ? <a href={`http://localhost:5001${r.reportPdfUrl}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>View</a> : '—'}</td>
                    <td>{r ? fmtDate(r.createdAt) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );

      case 'invoice':
        return (
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign ID</th>
                <th>Campaign</th>
                <th>Vendor</th>
                <th>Amount</th>
                <th>Campaign Status</th>
                <th>Invoice Status</th>
                <th>File</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const r = recordMap[c._id];
                const label = phaseLabel(c.status, 'invoice', !!r);
                return (
                  <tr key={c._id} onClick={() => goToCampaign(c._id)} style={{ cursor: 'pointer' }}>
                    <td><span className="campaign-id">{c.campaignId}</span></td>
                    <td>{c.title}</td>
                    <td>{r?.vendorId?.name || c.vendorId?.name || '—'}</td>
                    <td>{r ? `₹${r.amount?.toLocaleString() || 0}` : '—'}</td>
                    <td><span className={statusColor(c.status)}>{fmtStatus(c.status)}</span></td>
                    <td><span className={statusColor(r?.status || label)}>{r ? fmtStatus(r.status) : label}</span></td>
                    <td>{r?.invoiceFileUrl ? <a href={`http://localhost:5001${r.invoiceFileUrl}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>View</a> : '—'}</td>
                    <td>{r ? fmtDate(r.createdAt) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Operations</h1>
      </div>

      <div className="ops-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`ops-tab ${activeTab === t.key ? 'ops-tab-active' : ''}`}
            onClick={() => handleTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by Campaign ID (e.g. CAMP-0001)"
            value={searchId}
            onChange={e => setSearchId(e.target.value)}
            className="form-input"
            style={{ flex: 1, maxWidth: '350px' }}
          />
          <button type="submit" className="btn btn-primary">Search</button>
          {searchId && (
            <button type="button" className="btn" onClick={() => { setSearchId(''); load(activeTab, ''); }}>Clear</button>
          )}
        </form>

        <div style={{ overflowX: 'auto' }}>
          {renderTable()}
        </div>

        <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>
          {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} found
        </div>
      </div>
    </div>
  );
}
