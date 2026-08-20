import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import brand from '../config/brand';
import API, { broadcastAuthEvent } from '../api/api';

export default function Register() {
  const [step, setStep] = useState(1); // 1: form, 2: otp
  const [form, setForm] = useState({ name: '', username: '', email: '', age: '', password: '', confirm: '' });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(300); // 5 minutes

  const navigate = useNavigate();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── 5-Minute Countdown Timer ──────────────────────────────────────────────
  useEffect(() => {
    let timer;
    if (step === 2 && expirySeconds > 0) {
      timer = setInterval(() => {
        setExpirySeconds(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, expirySeconds]);

  // ── 60-Second Resend Cooldown Timer ───────────────────────────────────────
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

  // Step 1: Send OTP to email
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (Number(form.age) < 18) {
      setError('You must be at least 18 years old to join.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await API.post('/api/auth/send-register-otp', {
        email: form.email,
        username: form.username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
      });
      setSuccessMsg(res.data.message || 'Verification code sent to your email.');
      setCooldown(res.data.cooldown_seconds || 60);
      setExpirySeconds(res.data.expires_in_seconds || 300);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send verification code. Please check your details.');
    }
    setLoading(false);
  };

  // Step 2: Resend OTP
  const handleResendOTP = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await API.post('/api/auth/send-register-otp', {
        email: form.email,
        username: form.username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
      });
      setSuccessMsg('A fresh verification code has been sent!');
      setCooldown(res.data.cooldown_seconds || 60);
      setExpirySeconds(res.data.expires_in_seconds || 300);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend code.');
    }
    setLoading(false);
  };

  // Step 2: Submit OTP & complete registration
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (expirySeconds <= 0) {
      setError('Verification code has expired. Please click "Resend Code".');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await API.post('/api/auth/register', {
        name: form.name,
        username: form.username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
        email: form.email,
        age: Number(form.age),
        password: form.password,
        otp: otp.trim(),
      });
      const d = res.data;
      localStorage.setItem('token', d.access_token);
      localStorage.setItem('user_id', d.user_id);
      localStorage.setItem('user_name', d.name);
      localStorage.setItem('user_info', JSON.stringify({
        email: d.email, name: d.name, plan_name: d.plan_name,
        credits_remaining: d.credits_remaining, is_unlimited: d.is_unlimited,
      }));
      broadcastAuthEvent('NEW_LOGIN', { user_id: d.user_id });
      navigate('/select-character');
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed. Please check the code.');
    }
    setLoading(false);
  };

  const inputStyle = {
    width: '100%', padding: '12px 15px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#f0f0f0',
    fontSize: 14, outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#0a0a0f,#12091a,#0a0a0f)', fontFamily: "'Inter', system-ui, sans-serif", padding: 20
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💕</div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>
            {step === 1 ? 'Create your account' : 'Verify Your Email'}
          </h2>
          <p style={{ color: '#888', fontSize: 14 }}>
            {step === 1 ? `Join ${brand.name} — it's free to start` : `We sent a 6-digit code to ${form.email}`}
          </p>
        </div>

        {step === 1 ? (
          /* ── STEP 1: Registration Form ── */
          <form onSubmit={handleSendOTP} style={{
            display: 'flex', flexDirection: 'column', gap: 12,
            background: '#12121a', borderRadius: 18, padding: 28, border: '1px solid rgba(255,255,255,0.06)'
          }}>
            {[
              { id: 'reg-name', k: 'name', label: 'Full Name', type: 'text', placeholder: 'Your name' },
              { id: 'reg-username', k: 'username', label: 'Username (Unique)', type: 'text', placeholder: 'cool_user99' },
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
                    <div style={{
                      width: `${(pw.score / 4) * 100}%`, height: '100%', borderRadius: 2,
                      background: pw.color, transition: 'all 0.3s'
                    }} />
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
              <div style={{
                background: 'rgba(233,30,140,0.1)', border: '1px solid rgba(233,30,140,0.3)',
                borderRadius: 8, padding: '11px 14px', color: '#e91e8c', fontSize: 13
              }}>{error}</div>
            )}

            <button id="reg-btn" type="submit" disabled={loading} style={{
              marginTop: 4, padding: '13px',
              background: 'linear-gradient(135deg,#e91e8c,#9c27b0)', border: 'none', borderRadius: 10,
              color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1
            }}>
              {loading ? 'Sending verification code...' : 'Continue & Verify Email →'}
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
        ) : (
          /* ── STEP 2: OTP Verification ── */
          <form onSubmit={handleVerifyAndRegister} style={{
            display: 'flex', flexDirection: 'column', gap: 16,
            background: '#12121a', borderRadius: 18, padding: 28, border: '1px solid rgba(255,255,255,0.06)'
          }}>
            {/* 5-Minute Countdown Timer Badge */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: expirySeconds > 60 ? 'rgba(33, 150, 243, 0.08)' : 'rgba(244, 67, 54, 0.1)',
              border: `1px solid ${expirySeconds > 60 ? 'rgba(33, 150, 243, 0.25)' : 'rgba(244, 67, 54, 0.3)'}`,
              borderRadius: 10, padding: '10px 14px'
            }}>
              <span style={{ color: '#a0a0a0', fontSize: 13 }}>⏱️ Code Expires In:</span>
              <span style={{
                color: expirySeconds > 60 ? '#64b5f6' : '#ff5252',
                fontFamily: "'Courier New', monospace",
                fontWeight: 700, fontSize: 16
              }}>
                {formatTimer(expirySeconds)}
              </span>
            </div>

            <div>
              <label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 8, fontWeight: 500 }}>
                Enter 6-Digit Verification Code
              </label>
              <input
                id="reg-otp"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                required
                autoFocus
                style={{
                  ...inputStyle,
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: 8,
                  textAlign: 'center',
                  padding: '14px',
                  fontFamily: "'Courier New', monospace",
                  border: '1px solid rgba(233, 30, 140, 0.4)',
                }}
              />
            </div>

            {successMsg && (
              <div style={{
                background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)',
                borderRadius: 8, padding: '10px 14px', color: '#4caf50', fontSize: 13
              }}>
                ✅ {successMsg}
              </div>
            )}

            {error && (
              <div style={{
                background: 'rgba(233,30,140,0.1)', border: '1px solid rgba(233,30,140,0.3)',
                borderRadius: 8, padding: '10px 14px', color: '#e91e8c', fontSize: 13
              }}>
                ❌ {error}
              </div>
            )}

            <button type="submit" disabled={loading || expirySeconds <= 0} style={{
              padding: '14px',
              background: expirySeconds > 0 ? 'linear-gradient(135deg,#e91e8c,#9c27b0)' : '#333',
              border: 'none', borderRadius: 10,
              color: '#fff', fontSize: 15, fontWeight: 600, cursor: expirySeconds > 0 ? 'pointer' : 'not-allowed',
              opacity: loading ? 0.6 : 1
            }}>
              {loading ? 'Verifying...' : 'Verify & Create Account ✨'}
            </button>

            {/* Resend button with 60s cooldown */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); setSuccessMsg(''); }}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', padding: 0 }}
              >
                ← Edit email / details
              </button>

              <button
                type="button"
                onClick={handleResendOTP}
                disabled={cooldown > 0 || loading}
                style={{
                  background: 'none', border: 'none',
                  color: cooldown > 0 ? '#555' : '#e91e8c',
                  fontSize: 13, fontWeight: 600,
                  cursor: cooldown > 0 ? 'default' : 'pointer',
                  padding: 0
                }}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        <p style={{ textAlign: 'center', color: '#444', fontSize: 11, marginTop: 16 }}>
          By creating an account, you confirm you are 18+ years old.
        </p>
      </div>
    </div>
  );
}