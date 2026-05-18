import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import MapPicker from '../components/MapPicker';
import MapView from '../components/MapView';

export default function CampaignDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState(null);
  const [survey, setSurvey] = useState(null);
  const [creatives, setCreatives] = useState([]);
  const [workOrder, setWorkOrder] = useState(null);
  const [installation, setInstallation] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { data: c } = await api.get(`/campaigns/${id}`);
      setCampaign(c);
      try { const { data: s } = await api.get(`/site-surveys/campaign/${id}`); setSurvey(s); } catch {}
      try { const { data: cr } = await api.get(`/creatives/campaign/${id}`); setCreatives(cr); } catch {}
      try { const { data: wo } = await api.get(`/work-orders/campaign/${id}`); setWorkOrder(wo); } catch {}
      try { const { data: inst } = await api.get(`/installations/campaign/${id}`); setInstallation(inst); } catch {}
      try { const { data: inv } = await api.get(`/invoices/campaign/${id}`); setInvoice(inv); } catch {}
      if (user.role === 'admin') {
        try { const { data: v } = await api.get('/auth/vendors'); setVendors(v); } catch {}
      }
    } catch { setError('Failed to load campaign'); }
  };

  const [searchParams] = useSearchParams();
  const sectionOnly = searchParams.get('section');

  useEffect(() => { load(); }, [id]);

  const action = async (fn) => {
    setError(''); setMsg('');
    try { await fn(); setMsg('Action completed'); load(); }
    catch (err) { setError(err.response?.data?.message || 'Action failed'); }
  };

  if (!campaign) return <p>Loading...</p>;

  const SECTION_LABELS = {
    'vendor-allocation': 'Vendor Allocation',
    'site-survey': 'Site Survey',
    'creatives': 'Creatives',
    'work-order': 'Work Order',
    'installation': 'Installation',
    'invoice': 'Invoice',
  };

  const renderSection = () => {
    switch (sectionOnly) {
      case 'vendor-allocation':
        return <VendorAllocation campaign={campaign} user={user} vendors={vendors} action={action} />;
      case 'site-survey':
        return <SiteSurveySection campaign={campaign} user={user} survey={survey} action={action} />;
      case 'creatives':
        return <CreativesSection campaign={campaign} user={user} survey={survey} creatives={creatives} action={action} load={load} />;
      case 'work-order':
        return <WorkOrderSection campaign={campaign} user={user} workOrder={workOrder} action={action} />;
      case 'installation':
        return <InstallationSection campaign={campaign} user={user} workOrder={workOrder} installation={installation} action={action} />;
      case 'invoice':
        return <InvoiceSection campaign={campaign} user={user} workOrder={workOrder} invoice={invoice} action={action} />;
      default:
        return <p>Unknown section.</p>;
    }
  };

  /* Section-only view (from Operations page) */
  if (sectionOnly) {
    return (
      <div>
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to={`/campaigns/${id}`} className="btn btn-primary" style={{ textDecoration: 'none' }}>← View Full Campaign</Link>
          <Link to="/operations" className="btn" style={{ textDecoration: 'none' }}>← Back to Operations</Link>
        </div>
        <h1>
          {campaign.campaignId && <span className="campaign-id">{campaign.campaignId}</span>}{' '}
          {campaign.title} — {SECTION_LABELS[sectionOnly] || sectionOnly}
        </h1>
        {msg && <div className="success">{msg}</div>}
        {error && <div className="error">{error}</div>}

        {/* Compact campaign info */}
        <div className="card">
          <div className="detail-grid">
            <div><strong>Status:</strong> <span className="status-badge status-blue">{campaign.status.replace(/_/g, ' ')}</span></div>
            <div><strong>Category:</strong> {campaign.category}</div>
            <div><strong>Budget:</strong> ₹{campaign.budget?.toLocaleString()}</div>
            {campaign.clientId && <div><strong>Client:</strong> {campaign.clientId.name}</div>}
            {campaign.vendorId && <div><strong>Vendor:</strong> {campaign.vendorId.name}</div>}
          </div>
        </div>

        {renderSection()}
      </div>
    );
  }

  /* Full campaign view (from My Campaigns / direct link) */

  return (
    <div>
      <h1>{campaign.campaignId && <span className="campaign-id">{campaign.campaignId}</span>} {campaign.title}</h1>
      {msg && <div className="success">{msg}</div>}
      {error && <div className="error">{error}</div>}

      {/* Campaign Info */}
      <div className="card">
        <h3>Campaign Details</h3>
        <div className="detail-grid">
          <div><strong>Status:</strong> <span className="status-badge status-blue">{campaign.status.replace(/_/g, ' ')}</span></div>
          <div><strong>Category:</strong> {campaign.category}{campaign.category === 'Others' && campaign.categoryOther ? ` — ${campaign.categoryOther}` : ''}</div>
          <div><strong>Budget:</strong> ₹{campaign.budget?.toLocaleString()}</div>
          <div><strong>Start:</strong> {new Date(campaign.startDate).toLocaleDateString()}</div>
          <div><strong>End:</strong> {new Date(campaign.endDate).toLocaleDateString()}</div>
          {campaign.clientId && <div><strong>Client:</strong> {campaign.clientId.name}</div>}
          {campaign.vendorId && <div><strong>Vendor:</strong> {campaign.vendorId.name}</div>}
          {campaign.adminRemarks && <div><strong>Admin Remarks:</strong> {campaign.adminRemarks}</div>}
        </div>
        {campaign.preferredLocations?.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <strong>Preferred Locations:</strong>
            <ul style={{ margin: '0.25rem 0 0 1.25rem' }}>
              {campaign.preferredLocations.map((loc, i) => (
                <li key={i}>{loc.city}, {loc.state}</li>
              ))}
            </ul>
          </div>
        )}
        <p style={{ marginTop: '1rem' }}><strong>Brief:</strong> {campaign.brief}</p>
      </div>

      {/* Additional Documents */}
      <DocumentSection campaign={campaign} user={user} action={action} load={load} />

      {/* PHASE 1: Admin Review */}
      <AdminReview campaign={campaign} user={user} action={action} />

      {/* Client Resubmit */}
      <ClientResubmit campaign={campaign} user={user} action={action} />

      {/* PHASE 2: Vendor Allocation */}
      <VendorAllocation campaign={campaign} user={user} vendors={vendors} action={action} />

      {/* PHASE 2: Site Survey */}
      <SiteSurveySection campaign={campaign} user={user} survey={survey} action={action} />

      {/* PHASE 3: Image Selection & Creatives */}
      <CreativesSection campaign={campaign} user={user} survey={survey} creatives={creatives} action={action} load={load} />

      {/* PHASE 4: Work Order */}
      <WorkOrderSection campaign={campaign} user={user} workOrder={workOrder} action={action} />

      {/* PHASE 4: Installation */}
      <InstallationSection campaign={campaign} user={user} workOrder={workOrder} installation={installation} action={action} />

      {/* PHASE 5: Send Report & Client Verify */}
      <VerificationSection campaign={campaign} user={user} installation={installation} action={action} />

      {/* PHASE 6: Invoice */}
      <InvoiceSection campaign={campaign} user={user} workOrder={workOrder} invoice={invoice} action={action} />

      {/* Close Work Order */}
      <CloseSection campaign={campaign} user={user} workOrder={workOrder} action={action} />
    </div>
  );
}

/* ---------- Additional Documents ---------- */
function DocumentSection({ campaign, user, action, load }) {
  const [file, setFile] = useState(null);

  const handleDownloadTemplate = async () => {
    try {
      const resp = await api.get('/campaigns/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'campaign_additional_details_template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const handleUploadDoc = () => action(async () => {
    if (!file) throw new Error('Please select a file');
    const formData = new FormData();
    formData.append('additionalDoc', file);
    await api.post(`/campaigns/${campaign._id}/upload-document`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    setFile(null);
  });

  // Show uploaded document info for all users
  const docInfo = campaign.additionalDocUrl && (
    <div className="card">
      <h3>Additional Documents</h3>
      <p>
        <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ Document uploaded</span>
        {' — '}
        <a href={`http://localhost:5001${campaign.additionalDocUrl}`} target="_blank" rel="noreferrer">Download uploaded document</a>
      </p>
    </div>
  );

  // Client: awaiting documents state — show download template + upload form
  if (user.role === 'client' && campaign.status === 'awaiting_documents') {
    return (
      <>
        <div className="card action-card">
          <h3>📋 Upload Required Documents</h3>
          <p style={{ marginBottom: '0.75rem', color: '#92400e', background: '#fef3c7', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
            Your campaign has been submitted. Please download the template below, fill in the additional details, and upload it to proceed with approval.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <button className="btn btn-primary" onClick={handleDownloadTemplate}>📥 Download Template</button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files[0])} />
            {file && <button className="btn btn-green" onClick={handleUploadDoc}>📤 Upload Filled Document</button>}
          </div>
        </div>
        {docInfo}
      </>
    );
  }

  // Admin viewing awaiting_documents campaign
  if (user.role === 'admin' && campaign.status === 'awaiting_documents') {
    return (
      <div className="card">
        <h3>Additional Documents</h3>
        <p style={{ color: '#dc2626', fontWeight: 600 }}>⏳ Awaiting client to upload required documents</p>
      </div>
    );
  }

  // All users: show doc info if uploaded
  return docInfo || null;
}

/* ---------- PHASE 1: Admin Review ---------- */
function AdminReview({ campaign, user, action }) {
  const [remarks, setRemarks] = useState('');
  if (user.role !== 'admin' || campaign.status !== 'pending_approval') return null;
  const hasDoc = !!campaign.additionalDocUrl;
  return (
    <div className="card action-card">
      <h3>Review Campaign</h3>
      {!hasDoc && (
        <p style={{ color: '#dc2626', fontWeight: 600, marginBottom: '0.5rem' }}>
          ⚠ Client has not uploaded required documents. Cannot approve.
        </p>
      )}
      <textarea placeholder="Remarks (for reject/rework)" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
      <div className="btn-group">
        <button className="btn btn-green" disabled={!hasDoc} title={!hasDoc ? 'Awaiting client documents' : ''} onClick={() => action(() => api.patch(`/campaigns/${campaign._id}/review`, { action: 'approve' }))}>Approve</button>
        <button className="btn btn-red" onClick={() => action(() => api.patch(`/campaigns/${campaign._id}/review`, { action: 'reject', remarks }))}>Reject</button>
        <button className="btn btn-orange" onClick={() => action(() => api.patch(`/campaigns/${campaign._id}/review`, { action: 'rework', remarks }))}>Rework</button>
      </div>
    </div>
  );
}

/* ---------- Client Resubmit ---------- */
function ClientResubmit({ campaign, user, action }) {
  const [form, setForm] = useState(null);
  const [locations, setLocations] = useState([]);
  if (user.role !== 'client' || campaign.status !== 'rework_required') return null;
  if (!form) {
    return (
      <div className="card action-card">
        <h3>Rework Required</h3>
        <p>Admin remarks: <em>{campaign.adminRemarks}</em></p>
        <button className="btn btn-primary" onClick={() => {
          setForm({
            title: campaign.title, brief: campaign.brief, budget: campaign.budget,
            category: campaign.category || '', categoryOther: campaign.categoryOther || '',
            startDate: campaign.startDate?.substring(0,10), endDate: campaign.endDate?.substring(0,10),
          });
          setLocations(campaign.preferredLocations?.length > 0
            ? campaign.preferredLocations.map(l => ({ state: l.state, city: l.city }))
            : [{ state: '', city: '' }, { state: '', city: '' }, { state: '', city: '' }]
          );
        }}>Edit & Resubmit</button>
      </div>
    );
  }
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  return (
    <div className="card action-card">
      <h3>Resubmit Campaign</h3>
      <form onSubmit={(e) => { e.preventDefault(); action(() => api.put(`/campaigns/${campaign._id}`, {
        ...form, budget: Number(form.budget),
        preferredLocations: locations.filter(l => l.state && l.city),
      })); setForm(null); }}>
        <input name="title" value={form.title} onChange={onChange} required />
        <textarea name="brief" value={form.brief} onChange={onChange} required rows={3} />
        <input name="budget" type="number" value={form.budget} onChange={onChange} required />
        <div className="form-row">
          <label>Start: <input name="startDate" type="date" value={form.startDate} onChange={onChange} required /></label>
          <label>End: <input name="endDate" type="date" value={form.endDate} onChange={onChange} required /></label>
        </div>
        <button type="submit" className="btn btn-primary">Resubmit</button>
      </form>
    </div>
  );
}

/* ---------- PHASE 2: Vendor Allocation ---------- */
function VendorAllocation({ campaign, user, vendors, action }) {
  const [vendorId, setVendorId] = useState('');
  if (user.role !== 'admin' || campaign.status !== 'approved') return null;
  return (
    <div className="card action-card">
      <h3>Allocate Vendor</h3>
      <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
        <option value="">Select vendor...</option>
        {vendors.map(v => <option key={v._id} value={v._id}>{v.name} ({v.email})</option>)}
      </select>
      <button className="btn btn-primary" disabled={!vendorId}
        onClick={() => action(() => api.patch(`/campaigns/${campaign._id}/allocate-vendor`, { vendorId }))}>
        Allocate
      </button>
    </div>
  );
}

/* ---------- PHASE 2: Site Survey ---------- */
function SiteSurveySection({ campaign, user, survey, action }) {
  const [files, setFiles] = useState([]);
  const [meta, setMeta] = useState([]);

  if (survey) {
    return (
      <div className="card">
        <h3>Site Survey {survey.pdfUrl && <a href={survey.pdfUrl} target="_blank" rel="noreferrer" className="btn btn-small">📄 PDF</a>}</h3>
        <div className="image-grid">
          {survey.images?.map((img, i) => (
            <div key={img._id} className={`survey-image-card ${img.selectedByAdmin ? 'selected' : ''}`}>
              <img src={img.imageUrl} alt={`Survey ${i+1}`} />
              <p><strong>{img.mediaType?.replace(/_/g, ' ')}</strong></p>
              <p>{img.description}</p>
              <p>Size: {img.size}</p>
              <MapView lat={img.location?.lat} lng={img.location?.lng} />
              <p>📍 {img.locationAddress || `${img.location?.lat}, ${img.location?.lng}`}</p>
              {img.selectedByAdmin && <span className="selected-badge">✓ Selected</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (user.role !== 'vendor' || !['vendor_allocated', 'survey_in_progress'].includes(campaign.status)) return null;

  const addImage = () => setMeta([...meta, { description: '', size: '', lat: '', lng: '', locationAddress: '', mediaType: 'vinyl' }]);
  const updateMeta = (i, field, val) => { const m = [...meta]; m[i][field] = val; setMeta(m); };

  const handleSubmit = async () => {
    // Validate all images have files selected
    for (let i = 0; i < meta.length; i++) {
      if (!files[i]) {
        throw new Error(`Please select a file for Image ${i + 1}`);
      }
      if (!meta[i].lat || !meta[i].lng) {
        throw new Error(`Please select a location on the map for Image ${i + 1}`);
      }
    }
    const formData = new FormData();
    formData.append('campaignId', campaign._id);
    formData.append('imagesMeta', JSON.stringify(meta));
    for (let i = 0; i < meta.length; i++) {
      formData.append('images', files[i]);
    }
    await api.post('/site-surveys', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  };

  return (
    <div className="card action-card">
      <h3>Upload Site Survey</h3>
      <button className="btn btn-small" onClick={addImage}>+ Add Billboard Image</button>
      {meta.map((m, i) => (
        <div key={i} className="survey-form-item">
          <h4>Image {i + 1}</h4>
          <input type="file" accept="image/*" onChange={(e) => { const f = [...files]; f[i] = e.target.files[0]; setFiles(f); }} />
          <input placeholder="Description" value={m.description} onChange={(e) => updateMeta(i, 'description', e.target.value)} />
          <input placeholder="Size (e.g., 20x10 ft)" value={m.size} onChange={(e) => updateMeta(i, 'size', e.target.value)} />
          <MapPicker
            lat={m.lat}
            lng={m.lng}
            onLocationSelect={(lat, lng, address) => {
              const updated = [...meta];
              updated[i] = { ...updated[i], lat, lng, locationAddress: address };
              setMeta(updated);
            }}
          />
          {m.lat && m.lng && (
            <p className="selected-location">
              📍 {m.locationAddress || `${m.lat}, ${m.lng}`}
            </p>
          )}
          <select value={m.mediaType} onChange={(e) => updateMeta(i, 'mediaType', e.target.value)}>
            <option value="vinyl">Vinyl</option>
            <option value="one_way">One Way</option>
            <option value="sunboard">Sunboard</option>
            <option value="no_lit_board">No-Lit Board</option>
            <option value="glow_sign_board">Glow Sign Board</option>
            <option value="acrylic_board">Acrylic Board</option>
          </select>
        </div>
      ))}
      {meta.length > 0 && (
        <button className="btn btn-primary" onClick={() => action(handleSubmit)}>Submit Survey</button>
      )}
    </div>
  );
}

/* ---------- PHASE 3: Image Selection & Creatives ---------- */
function CreativesSection({ campaign, user, survey, creatives, action, load }) {
  const [selectedIds, setSelectedIds] = useState([]);

  const canSelect = user.role === 'admin' && survey && campaign.status === 'survey_completed';
  const canCreateCreative = user.role === 'admin' && ['creatives_in_progress'].includes(campaign.status);

  const toggleSelect = (imgId) => {
    setSelectedIds(prev => prev.includes(imgId) ? prev.filter(id => id !== imgId) : [...prev, imgId]);
  };

  const handleSelect = () => action(() =>
    api.patch(`/site-surveys/${survey._id}/select-images`, { selectedImageIds: selectedIds })
  );

  const handleCreateCreative = async (surveyImageId) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'image/*';
    fileInput.onchange = async (e) => {
      const formData = new FormData();
      formData.append('campaignId', campaign._id);
      formData.append('surveyImageId', surveyImageId);
      formData.append('creativeImage', e.target.files[0]);
      formData.append('description', 'Creative for billboard');
      await action(async () => { await api.post('/creatives', formData, { headers: { 'Content-Type': 'multipart/form-data' } }); });
    };
    fileInput.click();
  };

  const handleMarkProcessed = (creativeId) => action(() =>
    api.patch(`/creatives/${creativeId}`, { status: 'processed' })
  );

  return (
    <>
      {canSelect && (
        <div className="card action-card">
          <h3>Select Images for Creatives</h3>
          <div className="image-grid">
            {survey.images?.map((img) => (
              <div key={img._id} className={`survey-image-card selectable ${selectedIds.includes(img._id) ? 'selected' : ''}`}
                onClick={() => toggleSelect(img._id)}>
                <img src={img.imageUrl} alt="" />
                <p>{img.mediaType?.replace(/_/g, ' ')} — {img.size}</p>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" disabled={selectedIds.length === 0} onClick={handleSelect}>
            Confirm Selection ({selectedIds.length})
          </button>
        </div>
      )}

      {canCreateCreative && survey && (
        <div className="card action-card">
          <h3>Create Creatives</h3>
          <p>Upload a creative for each selected billboard image:</p>
          <div className="image-grid">
            {survey.images?.filter(img => img.selectedByAdmin).map((img) => (
              <div key={img._id} className="survey-image-card">
                <img src={img.imageUrl} alt="" />
                <p>{img.mediaType?.replace(/_/g, ' ')}</p>
                <button className="btn btn-small btn-primary" onClick={() => handleCreateCreative(img._id)}>
                  Upload Creative
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {creatives.length > 0 && (
        <div className="card">
          <h3>Creatives</h3>
          <div className="image-grid">
            {creatives.map((c) => (
              <div key={c._id} className="survey-image-card">
                {c.creativeImageUrl && <img src={c.creativeImageUrl} alt="Creative" />}
                <p>Status: <strong>{c.status}</strong></p>
                <p>{c.description}</p>
                {user.role === 'admin' && c.status === 'pending' && (
                  <button className="btn btn-small btn-green" onClick={() => handleMarkProcessed(c._id)}>
                    Mark Processed
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- PHASE 4: Work Order ---------- */
function WorkOrderSection({ campaign, user, workOrder, action }) {
  if (workOrder) {
    return (
      <div className="card">
        <h3>Work Order {workOrder.pdfUrl && <a href={workOrder.pdfUrl} target="_blank" rel="noreferrer" className="btn btn-small">📄 Report</a>}</h3>
        <div className="detail-grid">
          <div><strong>Status:</strong> {workOrder.status}</div>
          <div><strong>Issued:</strong> {new Date(workOrder.issuedDate).toLocaleDateString()}</div>
          {workOrder.closedDate && <div><strong>Closed:</strong> {new Date(workOrder.closedDate).toLocaleDateString()}</div>}
        </div>
      </div>
    );
  }
  if (user.role !== 'admin' || campaign.status !== 'creatives_ready') return null;
  return (
    <div className="card action-card">
      <h3>Create Work Order</h3>
      <p>All creatives are ready. Create a work order to send to the vendor for installation.</p>
      <button className="btn btn-primary" onClick={() => action(() => api.post('/work-orders', { campaignId: campaign._id }))}>
        Create Work Order
      </button>
    </div>
  );
}

/* ---------- PHASE 4: Installation ---------- */
function InstallationSection({ campaign, user, workOrder, installation, action }) {
  const [files, setFiles] = useState([]);
  const [meta, setMeta] = useState([]);

  if (installation) {
    return (
      <div className="card">
        <h3>Installation {installation.reportPdfUrl && <a href={installation.reportPdfUrl} target="_blank" rel="noreferrer" className="btn btn-small">📄 Report</a>}</h3>
        <p>Status: <strong>{installation.status}</strong></p>
        {installation.clientRemarks && <p>Client Remarks: <em>{installation.clientRemarks}</em></p>}
        <div className="image-grid">
          {installation.images?.map((img, i) => (
            <div key={img._id} className="survey-image-card">
              <img src={img.imageUrl} alt={`Install ${i+1}`} />
              <p>{img.description}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (user.role !== 'vendor' || campaign.status !== 'work_order_issued' || !workOrder) return null;

  const addImage = () => setMeta([...meta, { creativeId: '', description: '' }]);
  const updateMeta = (i, field, val) => { const m = [...meta]; m[i][field] = val; setMeta(m); };

  const handleSubmit = async () => {
    const formData = new FormData();
    formData.append('workOrderId', workOrder._id);
    formData.append('imagesMeta', JSON.stringify(meta));
    for (let i = 0; i < meta.length; i++) {
      if (files[i]) formData.append('images', files[i]);
    }
    await api.post('/installations', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  };

  return (
    <div className="card action-card">
      <h3>Upload Installation Images</h3>
      <button className="btn btn-small" onClick={addImage}>+ Add Installation Image</button>
      {meta.map((m, i) => (
        <div key={i} className="survey-form-item">
          <input type="file" accept="image/*" onChange={(e) => { const f = [...files]; f[i] = e.target.files[0]; setFiles(f); }} />
          <input placeholder="Description" value={m.description} onChange={(e) => updateMeta(i, 'description', e.target.value)} />
        </div>
      ))}
      {meta.length > 0 && <button className="btn btn-primary" onClick={() => action(handleSubmit)}>Submit Installation</button>}
    </div>
  );
}

/* ---------- PHASE 5: Verification ---------- */
function VerificationSection({ campaign, user, installation, action }) {
  const [remarks, setRemarks] = useState('');

  if (user.role === 'admin' && installation && campaign.status === 'installation_completed') {
    return (
      <div className="card action-card">
        <h3>Send Report to Client</h3>
        <button className="btn btn-primary" onClick={() => action(() => api.patch(`/installations/${installation._id}/send-report`))}>
          Send Installation Report to Client
        </button>
      </div>
    );
  }

  if (user.role === 'client' && installation && campaign.status === 'installation_completed') {
    return (
      <div className="card action-card">
        <h3>Verify Installation</h3>
        <textarea placeholder="Remarks (for reject/rework)" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
        <div className="btn-group">
          <button className="btn btn-green" onClick={() => action(() => api.patch(`/installations/${installation._id}/verify`, { action: 'accept' }))}>Accept</button>
          <button className="btn btn-red" onClick={() => action(() => api.patch(`/installations/${installation._id}/verify`, { action: 'reject', remarks }))}>Reject</button>
          <button className="btn btn-orange" onClick={() => action(() => api.patch(`/installations/${installation._id}/verify`, { action: 'rework', remarks }))}>Rework</button>
        </div>
      </div>
    );
  }
  return null;
}

/* ---------- PHASE 6: Invoice ---------- */
function InvoiceSection({ campaign, user, workOrder, invoice, action }) {
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState(null);
  const [remarks, setRemarks] = useState('');

  if (invoice) {
    return (
      <div className="card">
        <h3>Invoice</h3>
        <div className="detail-grid">
          <div><strong>Amount:</strong> ₹{invoice.amount?.toLocaleString()}</div>
          <div><strong>Status:</strong> {invoice.status}</div>
          {invoice.invoiceFileUrl && <div><a href={invoice.invoiceFileUrl} target="_blank" rel="noreferrer">📄 View Invoice File</a></div>}
          {invoice.clientRemarks && <div><strong>Client Remarks:</strong> {invoice.clientRemarks}</div>}
        </div>

        {/* Admin: forward to client */}
        {user.role === 'admin' && invoice.status === 'pending' && campaign.status === 'invoiced' && (
          <button className="btn btn-primary" style={{ marginTop: '1rem' }}
            onClick={() => action(() => api.patch(`/invoices/${invoice._id}/send-to-client`))}>
            Send Invoice to Client
          </button>
        )}

        {/* Client: review */}
        {user.role === 'client' && invoice.status === 'pending' && campaign.status === 'invoiced' && (
          <div style={{ marginTop: '1rem' }}>
            <textarea placeholder="Remarks for rejection" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
            <div className="btn-group">
              <button className="btn btn-green" onClick={() => action(() => api.patch(`/invoices/${invoice._id}/review`, { action: 'accept' }))}>Accept</button>
              <button className="btn btn-red" onClick={() => action(() => api.patch(`/invoices/${invoice._id}/review`, { action: 'reject', remarks }))}>Reject</button>
            </div>
          </div>
        )}

        {/* Vendor: update rejected invoice */}
        {user.role === 'vendor' && invoice.status === 'rejected' && (
          <div style={{ marginTop: '1rem' }}>
            <h4>Update Invoice</h4>
            <input type="number" placeholder="New Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files[0])} />
            <button className="btn btn-primary" onClick={() => action(async () => {
              const formData = new FormData();
              if (amount) formData.append('amount', amount);
              if (file) formData.append('invoiceFile', file);
              await api.put(`/invoices/${invoice._id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            })}>Resubmit Invoice</button>
          </div>
        )}
      </div>
    );
  }

  if (user.role !== 'vendor' || campaign.status !== 'client_verified' || !workOrder) return null;
  return (
    <div className="card action-card">
      <h3>Submit Invoice</h3>
      <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files[0])} />
      <button className="btn btn-primary" onClick={() => action(async () => {
        const formData = new FormData();
        formData.append('campaignId', campaign._id);
        formData.append('workOrderId', workOrder._id);
        formData.append('amount', amount);
        if (file) formData.append('invoiceFile', file);
        await api.post('/invoices', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      })}>Submit Invoice</button>
    </div>
  );
}

/* ---------- Close Work Order ---------- */
function CloseSection({ campaign, user, workOrder, action }) {
  if (user.role !== 'admin' || campaign.status !== 'invoice_accepted' || !workOrder) return null;
  return (
    <div className="card action-card">
      <h3>Close Work Order</h3>
      <p>Invoice accepted. Close the work order to complete this campaign.</p>
      <button className="btn btn-green" onClick={() => action(() => api.patch(`/work-orders/${workOrder._id}/close`))}>
        Close Work Order
      </button>
    </div>
  );
}
