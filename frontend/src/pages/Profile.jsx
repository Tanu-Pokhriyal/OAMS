import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const TABS = [
  { key: 'details', label: 'Profile Details' },
  { key: 'password', label: 'Change Password' },
];

export default function Profile() {
  const { id: paramId } = useParams();
  const { user } = useAuth();
  const isOwnProfile = !paramId || paramId === user?._id;
  const [activeTab, setActiveTab] = useState('details');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Profile form
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dateOfRegistration, setDateOfRegistration] = useState('');
  const [editing, setEditing] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const loadProfile = async () => {
    try {
      setLoading(true);
      let u;
      if (isOwnProfile) {
        const { data } = await api.get('/auth/me');
        u = data.user;
      } else {
        const { data } = await api.get(`/users/${paramId}`);
        u = data;
      }
      setProfile(u);
      setName(u.name || '');
      setContact(u.contact || '');
      setAddress(u.address || '');
      setGstNo(u.gstNo || '');
      setDateOfBirth(u.dateOfBirth ? u.dateOfBirth.slice(0, 10) : '');
      setDateOfRegistration(u.dateOfRegistration ? u.dateOfRegistration.slice(0, 10) : '');
    } catch {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, [paramId]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      const payload = { name, contact, address, gstNo };
      if (profile?.role === 'client') payload.dateOfBirth = dateOfBirth || null;
      if (profile?.role === 'vendor') payload.dateOfRegistration = dateOfRegistration || null;
      let data;
      if (isOwnProfile) {
        ({ data } = await api.put('/auth/profile', payload));
        data = data.user;
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, name: data.name }));
      } else {
        ({ data } = await api.put(`/users/${paramId}`, payload));
      }
      setProfile(data);
      setEditing(false);
      setMsg('Profile updated successfully');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    try {
      const { data } = await api.put('/auth/change-password', { currentPassword, newPassword });
      setMsg(data.message);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '—';

  if (loading) return <p style={{ padding: '2rem', color: '#888' }}>Loading profile...</p>;

  return (
    <div>
      <div className="page-header">
        <h1>{isOwnProfile ? 'My Profile' : `${profile?.name}'s Profile`}</h1>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {isOwnProfile ? (
        <div className="ops-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`ops-tab ${activeTab === t.key ? 'ops-tab-active' : ''}`}
              onClick={() => { setActiveTab(t.key); setMsg(''); setError(''); }}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="ops-tabs">
          <button className="ops-tab ops-tab-active">Profile Details</button>
        </div>
      )}

      {activeTab === 'details' && (
        <div className="card" style={{ marginTop: '1rem' }}>
          {!editing ? (
            <div className="profile-details">
              <div className="profile-avatar">
                {profile?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="profile-info">
                <div className="profile-row"><span className="profile-label">Name</span><span>{profile?.name}</span></div>
                <div className="profile-row"><span className="profile-label">Email</span><span>{profile?.email}</span></div>
                <div className="profile-row"><span className="profile-label">Role</span><span className="role-badge" style={{ margin: 0, color: '#fff' }}>{profile?.role}</span></div>
                <div className="profile-row"><span className="profile-label">Contact</span><span>{profile?.contact || '—'}</span></div>
                <div className="profile-row"><span className="profile-label">Address</span><span>{profile?.address || '—'}</span></div>
                <div className="profile-row"><span className="profile-label">GST No.</span><span>{profile?.gstNo || '—'}</span></div>
                {profile?.role === 'client' && (
                  <div className="profile-row"><span className="profile-label">Date of Birth</span><span>{fmtDate(profile?.dateOfBirth)}</span></div>
                )}
                {profile?.role === 'vendor' && (
                  <div className="profile-row"><span className="profile-label">Registration Date</span><span>{fmtDate(profile?.dateOfRegistration)}</span></div>
                )}
                <div className="profile-row"><span className="profile-label">Joined</span><span>{fmtDate(profile?.createdAt)}</span></div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => setEditing(true)}>
                {isOwnProfile ? 'Edit Profile' : 'Edit User'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleProfileSave} className="profile-form">
              <div className="form-group">
                <label>Name</label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input className="form-input" value={profile?.email || ''} disabled style={{ opacity: 0.6 }} />
              </div>
              <div className="form-group">
                <label>Contact</label>
                <input className="form-input" value={contact} onChange={e => setContact(e.target.value)} placeholder="Phone number" />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input className="form-input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" />
              </div>
              <div className="form-group">
                <label>GST No.</label>
                <input className="form-input" value={gstNo} onChange={e => setGstNo(e.target.value)} placeholder="GST Number" />
              </div>
              {user.role === 'client' && isOwnProfile && (
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input type="date" className="form-input" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
                </div>
              )}
              {user.role === 'vendor' && isOwnProfile && (
                <div className="form-group">
                  <label>Registration Date</label>
                  <input type="date" className="form-input" value={dateOfRegistration} onChange={e => setDateOfRegistration(e.target.value)} />
                </div>
              )}
              {!isOwnProfile && profile?.role === 'client' && (
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input type="date" className="form-input" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
                </div>
              )}
              {!isOwnProfile && profile?.role === 'vendor' && (
                <div className="form-group">
                  <label>Registration Date</label>
                  <input type="date" className="form-input" value={dateOfRegistration} onChange={e => setDateOfRegistration(e.target.value)} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">Save Changes</button>
                <button type="button" className="btn" onClick={() => { setEditing(false); loadProfile(); }}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {activeTab === 'password' && isOwnProfile && (
        <div className="card" style={{ marginTop: '1rem', maxWidth: '450px' }}>
          <h3 style={{ marginBottom: '1rem', color: '#1e3a5f' }}>Change Password</h3>
          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" className="form-input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" className="form-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" className="form-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Update Password</button>
          </form>
        </div>
      )}
    </div>
  );
}
