import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import brand from '../config/brand';
import API from '../api/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await API.post('/api/auth/forgot-password', { email });
      setMessage(res.data.message || 'If that email is in our system, we sent a reset link.');
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0f, #12091a, #0a0a0f)', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 440, padding: 40, background: '#12121a', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>Reset Password</h2>
          <p style={{ color: '#888', fontSize: 14 }}>Enter your email to receive a password reset link.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ color: '#888', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 8 }}>Email Address</label>
            <input 
              type="email" 
              placeholder="you@example.com"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required
              style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#f0f0f0', fontSize: 15, boxSizing: 'border-box' }}
            />
          </div>

          {message && (
            <div style={{ background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)', borderRadius: 8, padding: '12px 16px', color: '#4caf50', fontSize: 13, lineHeight: 1.5 }}>
              ✅ {message}
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(233,30,140,0.1)', border: '1px solid rgba(233,30,140,0.3)', borderRadius: 8, padding: '12px 16px', color: '#e91e8c', fontSize: 13, lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading} 
            style={{ padding: '14px', background: 'linear-gradient(135deg,#e91e8c,#9c27b0)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1, marginTop: 8 }}
          >
            {loading ? 'Sending link...' : 'Send Reset Link'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link to="/login" style={{ color: '#888', fontSize: 14, textDecoration: 'none' }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
