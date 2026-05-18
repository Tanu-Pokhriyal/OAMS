import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'client',
    gstNo: '', address: '', contact: '', dateOfBirth: '', dateOfRegistration: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => {
    const params = {};
    if (roleFilter) params.role = roleFilter;
    if (search) params.search = search;
    api.get('/users', { params }).then(({ data }) => setUsers(data)).catch(() => {});
  };
  useEffect(() => { load(); }, [roleFilter, search]);

  const resetForm = () => {
    setForm({ name: '', email: '', password: '', role: 'client', gstNo: '', address: '', contact: '', dateOfBirth: '', dateOfRegistration: '' });
    setEditingUser(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser._id}`, form);
        setSuccess('User updated successfully');
      } else {
        await api.post('/users', form);
        setSuccess('User created successfully');
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed');
    }
  };

  const startEdit = (u) => {
    setEditingUser(u);
    setForm({
      name: u.name, email: u.email, password: '', role: u.role,
      gstNo: u.gstNo || '', address: u.address || '', contact: u.contact || '',
      dateOfBirth: u.dateOfBirth ? u.dateOfBirth.split('T')[0] : '',
      dateOfRegistration: u.dateOfRegistration ? u.dateOfRegistration.split('T')[0] : '',
    });
    setShowForm(true);
    setError(''); setSuccess('');
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (search) params.search = search;
      const resp = await api.get('/users/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'users.xlsx';
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(!showForm); }}>
            {showForm ? 'Cancel' : '+ Create User'}
          </button>
          <button className="btn btn-green" onClick={handleExport}>Export Excel</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #d1d5db' }}>
          <option value="">All Roles</option>
          <option value="client">Client</option>
          <option value="vendor">Vendor</option>
          <option value="admin">Admin</option>
        </select>
        <input
          placeholder="Search by name, email, GST, contact..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #d1d5db', minWidth: '200px' }}
        />
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="card form-card">
          <h3>{editingUser ? 'Edit User' : 'Create New User'}</h3>
          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}
          <form onSubmit={handleCreate}>
            <input name="name" placeholder="Full Name" value={form.name} onChange={onChange} required />
            {!editingUser && (
              <>
                <input name="email" type="email" placeholder="Email" value={form.email} onChange={onChange} required />
                <input name="password" type="password" placeholder="Password (min 6 chars)" value={form.password} onChange={onChange} required minLength={6} />
                <select name="role" value={form.role} onChange={onChange}>
                  <option value="client">Client</option>
                  <option value="vendor">Vendor</option>
                </select>
              </>
            )}
            <input name="gstNo" placeholder="GST No." value={form.gstNo} onChange={onChange} />
            <input name="address" placeholder="Address" value={form.address} onChange={onChange} />
            <input name="contact" placeholder="Contact Number" value={form.contact} onChange={onChange} />
            {(form.role === 'client' || (editingUser && editingUser.role === 'client')) && (
              <label>Date of Birth: <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={onChange} /></label>
            )}
            {(form.role === 'vendor' || (editingUser && editingUser.role === 'vendor')) && (
              <label>Date of Registration: <input name="dateOfRegistration" type="date" value={form.dateOfRegistration} onChange={onChange} /></label>
            )}
            <button type="submit" className="btn btn-primary">{editingUser ? 'Update' : 'Create User'}</button>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>GST No.</th>
              <th>Contact</th>
              <th>Address</th>
              <th>{roleFilter === 'vendor' ? 'Reg. Date' : 'DOB / Reg. Date'}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#888' }}>No users found</td></tr>}
            {users.map((u) => (
              <tr key={u._id}>
                <td>
                  <span className="user-link" onClick={() => navigate(`/profile/${u._id}`)}>{u.name}</span>
                </td>
                <td>{u.email}</td>
                <td><span className={`status-badge ${u.role === 'admin' ? 'status-red' : u.role === 'client' ? 'status-blue' : 'status-green'}`}>{u.role}</span></td>
                <td>{u.gstNo || '—'}</td>
                <td>{u.contact || '—'}</td>
                <td>{u.address || '—'}</td>
                <td>
                  {u.role === 'client' && u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString() : ''}
                  {u.role === 'vendor' && u.dateOfRegistration ? new Date(u.dateOfRegistration).toLocaleDateString() : ''}
                  {!u.dateOfBirth && !u.dateOfRegistration ? '—' : ''}
                </td>
                <td><button className="btn btn-small" onClick={() => startEdit(u)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
