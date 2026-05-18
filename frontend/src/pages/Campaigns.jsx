import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import INDIA_LOCATIONS from '../data/indiaLocations';

const CATEGORIES = [
  'Billboard Advertising',
  'Transit Advertising',
  'Retail Branding',
  'Digital OOH (DOOH)',
  'Mall & Multiplex Advertising',
  'Event / Road Shows',
  'Others',
];

const states = Object.keys(INDIA_LOCATIONS).sort();

const emptyLocation = { state: '', city: '' };

export default function Campaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', brief: '', budget: '', startDate: '', endDate: '',
    category: '', categoryOther: '',
  });
  const [locations, setLocations] = useState([{ ...emptyLocation }, { ...emptyLocation }, { ...emptyLocation }]);
  const [error, setError] = useState('');

  const load = () => api.get('/campaigns').then(({ data }) => setCampaigns(data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().split('T')[0];

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (form.startDate < today) return setError('Start date cannot be in the past');
    if (form.endDate <= form.startDate) return setError('End date must be after the start date');
    if (!form.category) return setError('Please select a campaign category');
    if (form.category === 'Others' && !form.categoryOther.trim()) return setError('Please specify the category');
    const validLocations = locations.filter(l => l.state && l.city);
    if (validLocations.length === 0) return setError('Please select at least one preferred location');
    try {
      await api.post('/campaigns', {
        ...form,
        budget: Number(form.budget),
        preferredLocations: validLocations,
      });
      setShowForm(false);
      setForm({ title: '', brief: '', budget: '', startDate: '', endDate: '', category: '', categoryOther: '' });
      setLocations([{ ...emptyLocation }, { ...emptyLocation }, { ...emptyLocation }]);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create campaign');
    }
  };

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const updateLocation = (index, field, value) => {
    const updated = [...locations];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'state') updated[index].city = '';
    setLocations(updated);
  };

  const statusColor = (status) => {
    if (['approved', 'client_verified', 'invoice_accepted', 'closed'].includes(status)) return 'status-green';
    if (['rejected', 'client_disputed', 'invoice_rejected'].includes(status)) return 'status-red';
    if (['rework_required', 'awaiting_documents'].includes(status)) return 'status-orange';
    return 'status-blue';
  };

  return (
    <div>
      <div className="page-header">
        <h1>Campaigns</h1>
        {user?.role === 'client' && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Campaign'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="card form-card" style={{ maxWidth: '700px' }}>
          <h3>Create New Campaign</h3>
          {error && <div className="error">{error}</div>}
          <form onSubmit={handleCreate}>
            <input name="title" placeholder="Campaign Title" value={form.title} onChange={onChange} required />
            <textarea name="brief" placeholder="Campaign Brief" value={form.brief} onChange={onChange} required rows={3} />

            {/* Category */}
            <label>Campaign Category:
              <select name="category" value={form.category} onChange={onChange} required>
                <option value="">Select Category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {form.category === 'Others' && (
              <input name="categoryOther" placeholder="Specify category..." value={form.categoryOther} onChange={onChange} required />
            )}

            <input name="budget" type="number" placeholder="Budget (₹)" value={form.budget} onChange={onChange} required min={0} />

            <div className="form-row">
              <label>Start: <input name="startDate" type="date" value={form.startDate} onChange={onChange} required min={today} /></label>
              <label>End: <input name="endDate" type="date" value={form.endDate} onChange={onChange} required min={form.startDate ? new Date(new Date(form.startDate).getTime() + 86400000).toISOString().split('T')[0] : today} /></label>
            </div>

            {/* Preferred Locations */}
            <fieldset style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '1rem' }}>
              <legend style={{ fontWeight: 600, padding: '0 0.5rem' }}>Preferred Locations (India)</legend>
              {locations.map((loc, i) => (
                <div key={i} className="form-row" style={{ marginBottom: '0.5rem' }}>
                  <label style={{ flex: 1 }}>
                    Location {i + 1} — State:
                    <select value={loc.state} onChange={(e) => updateLocation(i, 'state', e.target.value)}>
                      <option value="">Select State...</option>
                      {states.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label style={{ flex: 1 }}>
                    City:
                    <select value={loc.city} onChange={(e) => updateLocation(i, 'city', e.target.value)} disabled={!loc.state}>
                      <option value="">Select City...</option>
                      {(INDIA_LOCATIONS[loc.state] || []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
              ))}
            </fieldset>

            <button type="submit" className="btn btn-primary">Submit Campaign</button>
          </form>
        </div>
      )}

      <div className="campaign-list">
        {campaigns.length === 0 && <p className="empty">No campaigns found</p>}
        {campaigns.map((c) => (
          <Link to={`/campaigns/${c._id}`} key={c._id} className="card campaign-card">
            <div className="campaign-card-header">
              <h3>{c.campaignId && <span className="campaign-id">{c.campaignId} — </span>}{c.title}</h3>
              <span className={`status-badge ${statusColor(c.status)}`}>{c.status.replace(/_/g, ' ')}</span>
            </div>
            <p className="brief">{c.brief?.substring(0, 100)}...</p>
            <div className="campaign-meta">
              <span>Budget: ₹{c.budget?.toLocaleString()}</span>
              {c.category && <span>{c.category}{c.category === 'Others' && c.categoryOther ? `: ${c.categoryOther}` : ''}</span>}
              {c.clientId && <span>Client: {c.clientId.name}</span>}
              {c.vendorId && <span>Vendor: {c.vendorId.name}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
