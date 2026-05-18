import { useState } from 'react';
import api from '../api/axios';

export default function Settings() {
  const [templateFile, setTemplateFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

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
    } catch {
      setError('Failed to download template');
    }
  };

  const handleUploadTemplate = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (!templateFile) { setError('Please select a file'); return; }
    try {
      const formData = new FormData();
      formData.append('template', templateFile);
      await api.post('/campaigns/template', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMsg('Template uploaded successfully. All new campaigns will use this template.');
      setTemplateFile(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload template');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="card">
        <h3>Campaign Document Template</h3>
        <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1rem' }}>
          This is the global Excel template that clients are required to download, fill out, and re-upload when they submit a new campaign.
          You can update this template at any time — the latest version will be available for all future campaigns.
        </p>

        {msg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{msg}</div>}
        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <button className="btn btn-primary" onClick={handleDownloadTemplate}>📥 Download Current Template</button>
        </div>

        <h4 style={{ marginBottom: '0.5rem', color: '#374151' }}>Upload New Template</h4>
        <form onSubmit={handleUploadTemplate} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setTemplateFile(e.target.files[0])} />
          <button type="submit" className="btn btn-green" disabled={!templateFile}>📤 Upload</button>
        </form>
      </div>
    </div>
  );
}
