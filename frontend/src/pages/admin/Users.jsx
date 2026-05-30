import React, { useEffect, useState, useCallback } from 'react';
import { adminAPI } from '../../api/api';

const PLAN_COLORS = { free: '#888', starter: '#2196f3', pro: '#9c27b0', elite: '#ffd700' };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null); // user being edited

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (search) params.search = search;
      if (planFilter) params.plan = planFilter;
      const res = await adminAPI.get('/api/admin/users', { params });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (e) {}
    setLoading(false);
  }, [page, search, planFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    adminAPI.get('/api/admin/plans').then(r => setPlans(r.data)).catch(() => {});
  }, []);

  const updateUser = async (userId, data) => {
    await adminAPI.put(`/api/admin/users/${userId}`, data);
    fetchUsers();
    setEditing(null);
  };

  const cellStyle = { padding: '12px 16px', fontSize: 13, color: '#ccc', borderBottom: '1px solid rgba(255,255,255,0.05)' };
  const thStyle = { ...cellStyle, color: '#666', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' };

  return (
    <div style={{ color: '#f0f0f0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Users</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>{total} total users</p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input placeholder="Search name or email..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: '10px 14px', background: '#12121a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, color: '#f0f0f0', fontSize: 14, width: 260, outline: 'none' }} />
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
          style={{ padding: '10px 14px', background: '#12121a', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, color: '#f0f0f0', fontSize: 14, outline: 'none' }}>
          <option value="">All Plans</option>
          {plans.map(p => <option key={p.id} value={p.plan_name}>{p.display_name || p.plan_name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: '#12121a', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['User', 'Plan', 'Credits', 'Unlimited', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ ...cellStyle, textAlign: 'center', padding: 40, color: '#555' }}>Loading...</td></tr>
            ) : users.map(u => (
              <tr key={u.id} style={{ transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 500, color: '#f0f0f0', fontSize: 14 }}>{u.name || '—'}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>{u.email}</div>
                </td>
                <td style={cellStyle}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: `${PLAN_COLORS[u.plan_name] || '#888'}22`,
                    color: PLAN_COLORS[u.plan_name] || '#888' }}>
                    {u.plan_name?.toUpperCase()}
                  </span>
                </td>
                <td style={cellStyle}>
                  <span style={{ color: u.is_unlimited ? '#ffd700' : '#ccc' }}>
                    {u.is_unlimited ? '∞' : u.credits_remaining}
                  </span>
                </td>
                <td style={cellStyle}>
                  <button onClick={() => updateUser(u.id, { is_unlimited: !u.is_unlimited })}
                    style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: u.is_unlimited ? '#ffd700' : 'rgba(255,255,255,0.1)',
                      color: u.is_unlimited ? '#000' : '#888' }}>
                    {u.is_unlimited ? '∞ ON' : 'OFF'}
                  </button>
                </td>
                <td style={cellStyle}>
                  <button onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                    style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
                      background: u.is_active ? 'rgba(76,175,80,0.2)' : 'rgba(233,30,140,0.2)',
                      color: u.is_active ? '#4caf50' : '#e91e8c' }}>
                    {u.is_active ? 'Active' : 'Banned'}
                  </button>
                </td>
                <td style={cellStyle}>
                  <span style={{ fontSize: 12 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</span>
                </td>
                <td style={cellStyle}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setEditing(u)}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                        background: 'none', color: '#ccc', cursor: 'pointer', fontSize: 12 }}>Edit</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'none', color: page === 1 ? '#444' : '#ccc', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>← Prev</button>
        <span style={{ padding: '8px 16px', color: '#666', fontSize: 13 }}>Page {page} of {Math.ceil(total / 20) || 1}</span>
        <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'none', color: page >= Math.ceil(total / 20) ? '#444' : '#ccc',
            cursor: page >= Math.ceil(total / 20) ? 'not-allowed' : 'pointer' }}>Next →</button>
      </div>

      {/* Edit Modal */}
      {editing && (
        <EditUserModal user={editing} plans={plans} onClose={() => setEditing(null)}
          onSave={(data) => updateUser(editing.id, data)} />
      )}
    </div>
  );
}

function EditUserModal({ user, plans, onClose, onSave }) {
  const [name, setName] = useState(user.name || '');
  const [planId, setPlanId] = useState(user.plan_id || '');
  const [credits, setCredits] = useState(user.credits_remaining || 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#12121a', borderRadius: 16, padding: 32, width: 380,
        border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ color: '#f0f0f0', marginBottom: 20 }}>Edit User: {user.email}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 6 }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: '#1a1a26', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#f0f0f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 6 }}>Plan</label>
            <select value={planId} onChange={e => setPlanId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: '#1a1a26', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#f0f0f0', fontSize: 14, outline: 'none' }}>
              {plans.map(p => <option key={p.id} value={p.id}>{p.display_name || p.plan_name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 6 }}>Credits</label>
            <input type="number" value={credits} onChange={e => setCredits(Number(e.target.value))}
              style={{ width: '100%', padding: '10px 12px', background: '#1a1a26', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#f0f0f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'none', color: '#888', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave({ name, plan_id: Number(planId), credits_remaining: credits })}
            style={{ flex: 1, padding: 11, borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg,#e91e8c,#9c27b0)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
