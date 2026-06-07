import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import brand from '../config/brand';
import API from '../api/api';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', age: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const strength = (p) => {
    if (!p) return { score: 0, label: '', color: '#333' };
    let s = 0;
    if (p.length >= 8) s++;
    if (/\d/.test(p)) s++;
    if (/[!@#$%^&*]/.test(p)) s++;
    if (p.length >= 12) s++;
    const levels = [
      { score: 1, label: 'Weak', color: '#e91e8c' },
      { score: 2, label: 'Fair', color: '#ff9800' },
      { score: 3, label: 'Good', color: '#2196f3' },
      { score: 4, label: 'Strong', color: '#4caf50' },
    ];
    return levels.find(l => l.score >= s) || levels[3];
  };

  const pw = strength(form.password);

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const res = await API.post('/api/auth/google-login', { credential: credentialResponse.credential });
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
      setError(err.response?.data?.detail || 'Google Login failed');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await API.post('/api/auth/register', {
        name: form.name, email: form.email, age: Number(form.age), password: form.password,
      });
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
      setError(err.response?.data?.detail || 'Registration failed');
    }
    setLoading(false);
  };

  const inputStyle = { width: '100%', padding: '12px 15px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#f0f0f0',
    fontSize: 14, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#0a0a0f,#12091a,#0a0a0f)', fontFamily: "'Inter', system-ui, sans-serif", padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💕</div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>Create your account</h2>
          <p style={{ color: '#666', fontSize: 14 }}>Join {brand.name} — it's free to start</p>
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12,
          background: '#12121a', borderRadius: 18, padding: 28, border: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { id: 'reg-name', k: 'name', label: 'Full Name', type: 'text', placeholder: 'Your name' },
            { id: 'reg-email', k: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
            { id: 'reg-age', k: 'age', label: 'Age', type: 'number', placeholder: '18' },
          ].map(({ id, k, label, type, placeholder }) => (
            <div key={k}>
              <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 6, fontWeight: 500 }}>{label}</label>
              <input id={id} type={type} placeholder={placeholder} style={inputStyle} value={form[k]}
                onChange={e => set(k, e.target.value)} required />
            </div>
          ))}

          <div>
            <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 6, fontWeight: 500 }}>Password</label>
            <input id="reg-password" type="password" placeholder="Min 8 chars, 1 number" style={inputStyle}
              value={form.password} onChange={e => set('password', e.target.value)} required />
            {form.password && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#1a1a26' }}>
                  <div style={{ width: `${(pw.score / 4) * 100}%`, height: '100%', borderRadius: 2,
                    background: pw.color, transition: 'all 0.3s' }} />
                </div>
                <span style={{ color: pw.color, fontSize: 11, fontWeight: 600, minWidth: 40 }}>{pw.label}</span>
              </div>
            )}
          </div>

          <div>
            <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 6, fontWeight: 500 }}>Confirm Password</label>
            <input id="reg-confirm" type="password" placeholder="Repeat password" style={inputStyle}
              value={form.confirm} onChange={e => set('confirm', e.target.value)} required />
          </div>

          {error && (
            <div style={{ background: 'rgba(233,30,140,0.1)', border: '1px solid rgba(233,30,140,0.3)',
              borderRadius: 8, padding: '11px 14px', color: '#e91e8c', fontSize: 13 }}>{error}</div>
          )}

          <button id="reg-btn" type="submit" disabled={loading} style={{ marginTop: 4, padding: '13px',
            background: 'linear-gradient(135deg,#e91e8c,#9c27b0)', border: 'none', borderRadius: 10,
            color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Creating account...' : 'Create Free Account'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
            <span style={{ padding: '0 12px', color: '#555', fontSize: 12 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Login Failed')}
              theme="filled_black"
              shape="rectangular"
              text="signup_with"
            />
          </div>

          <p style={{ textAlign: 'center', color: '#555', fontSize: 13, marginTop: 4 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#e91e8c', textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
          </p>
        </form>

        <p style={{ textAlign: 'center', color: '#333', fontSize: 11, marginTop: 16 }}>
          By creating an account, you confirm you are 18+ years old.
        </p>
      </div>
    </div>
  );
}