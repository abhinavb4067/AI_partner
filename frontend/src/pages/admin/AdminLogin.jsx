import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import brand from '../../config/brand';
import { adminAPI } from '../../api/api';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await adminAPI.post('/api/admin/auth/login', { email, password });
      localStorage.setItem('admin_token', res.data.access_token);
      localStorage.setItem('admin_info', JSON.stringify({
        email: res.data.email,
        full_name: res.data.full_name,
        role: res.data.role,
      }));
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0f', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        .admin-input { width:100%; padding:12px 14px; background:#1a1a26; border:1px solid rgba(255,255,255,0.1);
          border-radius:8px; color:#f0f0f0; font-size:14px; outline:none; transition:border 0.2s; box-sizing:border-box; }
        .admin-input:focus { border-color:#e91e8c; }
        .admin-btn { width:100%; padding:13px; background:linear-gradient(135deg,#e91e8c,#9c27b0);
          border:none; border-radius:8px; color:#fff; font-size:15px; font-weight:600;
          cursor:pointer; transition:opacity 0.2s; }
        .admin-btn:hover:not(:disabled) { opacity:0.9; }
        .admin-btn:disabled { opacity:0.6; cursor:not-allowed; }
      `}</style>

      <div style={{
        width: 380, background: '#12121a', borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.06)', padding: 40,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg,#e91e8c,#9c27b0)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, marginBottom: 12,
          }}>🛡️</div>
          <h1 style={{ color: '#f0f0f0', fontSize: 20, fontWeight: 700, margin: 0 }}>Admin Portal</h1>
          <p style={{ color: '#666', fontSize: 13, margin: '6px 0 0' }}>{brand.name}</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ color: '#888', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Admin Email
            </label>
            <input id="admin-email" className="admin-input" type="email" placeholder="admin@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ color: '#888', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input id="admin-password" className="admin-input" type="password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error && (
            <div style={{ background: 'rgba(233,30,140,0.1)', border: '1px solid rgba(233,30,140,0.3)',
              borderRadius: 8, padding: '10px 14px', color: '#e91e8c', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button id="admin-login-btn" className="admin-btn" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Authenticating...' : 'Sign In to Admin'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#444', fontSize: 12, marginTop: 24 }}>
          Authorized personnel only
        </p>
      </div>
    </div>
  );
}
