import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import brand from '../config/brand';
import API from '../api/api';

export default function Login() {
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
      const res = await API.post('/api/auth/login', { email, password });
      const d = res.data;
      localStorage.setItem('token', d.access_token);
      localStorage.setItem('user_id', d.user_id);
      localStorage.setItem('user_name', d.name);
      localStorage.setItem('user_info', JSON.stringify({
        email: d.email, name: d.name, plan_name: d.plan_name,
        credits_remaining: d.credits_remaining, is_unlimited: d.is_unlimited,
      }));
      navigate('/select-character');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Inter', system-ui, sans-serif",
      background: 'linear-gradient(135deg, #0a0a0f 0%, #12091a 50%, #0a0a0f 100%)' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        .auth-input { width:100%;padding:13px 16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
          border-radius:10px;color:#f0f0f0;font-size:15px;outline:none;transition:border 0.2s;box-sizing:border-box; }
        .auth-input:focus{border-color:#e91e8c;background:rgba(233,30,140,0.05);}
        .auth-btn{width:100%;padding:14px;background:linear-gradient(135deg,#e91e8c,#9c27b0);border:none;border-radius:10px;
          color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:opacity 0.2s;}
        .auth-btn:hover:not(:disabled){opacity:0.9;} .auth-btn:disabled{opacity:0.6;cursor:not-allowed;}
      `}</style>

      {/* Left — Branding */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 48, background: 'rgba(233,30,140,0.03)', borderRight: '1px solid rgba(255,255,255,0.05)' }}
        className="hidden-mobile">
        <div style={{ maxWidth: 380, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>💕</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, background: 'linear-gradient(135deg,#e91e8c,#9c27b0)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 16 }}>{brand.name}</h1>
          <p style={{ color: '#888', fontSize: 17, lineHeight: 1.7 }}>{brand.tagline}</p>
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['💬 Intelligent AI conversations', '📸 Share & receive photos', '🎤 Voice messages', '🧠 She remembers everything'].map(f => (
              <div key={f} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 18px',
                color: '#ccc', fontSize: 14, textAlign: 'left', border: '1px solid rgba(255,255,255,0.06)' }}>{f}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div style={{ width: 440, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>Welcome back</h2>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 32 }}>Sign in to continue your conversations</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ color: '#888', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 7 }}>Email</label>
              <input id="login-email" className="auth-input" type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label style={{ color: '#888', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 7 }}>Password</label>
              <input id="login-password" className="auth-input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>

            {error && (
              <div style={{ background: 'rgba(233,30,140,0.1)', border: '1px solid rgba(233,30,140,0.3)',
                borderRadius: 8, padding: '11px 14px', color: '#e91e8c', fontSize: 13 }}>{error}</div>
            )}

            <button id="login-btn" className="auth-btn" type="submit" disabled={loading} style={{ marginTop: 6 }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: '#555', fontSize: 14, marginTop: 24 }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#e91e8c', textDecoration: 'none', fontWeight: 600 }}>Sign Up Free</Link>
          </p>
          <p style={{ textAlign: 'center', color: '#333', fontSize: 12, marginTop: 16 }}>
            <Link to="/" style={{ color: '#444', textDecoration: 'none' }}>← Back to Home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}