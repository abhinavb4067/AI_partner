import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import brand from '../config/brand';
import API from '../api/api';

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1: enter email, 2: enter otp & new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(300); // 5 minutes
  const navigate = useNavigate();

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

  // ── 60-Second Cooldown Timer ──────────────────────────────────────────────
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

  const pw = strength(newPassword);

  // Step 1: Request Password Reset OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await API.post('/api/auth/forgot-password', { email });
      setMessage(res.data.message || 'Verification code sent to your email.');
      setCooldown(res.data.cooldown_seconds || 60);
      setExpirySeconds(res.data.expires_in_seconds || 300);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send reset code. Please try again.');
    }
    setLoading(false);
  };

  // Step 2: Resend Code
  const handleResendOTP = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await API.post('/api/auth/forgot-password', { email });
      setMessage('A fresh 6-digit code has been sent!');
      setCooldown(res.data.cooldown_seconds || 60);
      setExpirySeconds(res.data.expires_in_seconds || 300);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend code.');
    }
    setLoading(false);
  };

  // Step 2: Verify OTP & Set New Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (expirySeconds <= 0) {
      setError('Verification code has expired. Please click "Resend Code".');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await API.post('/api/auth/reset-password', {
        email: email.trim(),
        otp: otp.trim(),
        new_password: newPassword,
      });
      setMessage(res.data.message || 'Password has been reset successfully!');
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password. Please check the code.');
    }
    setLoading(false);
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#f0f0f0',
    fontSize: 15, boxSizing: 'border-box', outline: 'none'
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0f, #12091a, #0a0a0f)', fontFamily: "'Inter', system-ui, sans-serif", padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 440, padding: 36, background: '#12121a',
        borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔒</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>
            {step === 1 ? 'Reset Password' : 'Enter 6-Digit Code'}
          </h2>
          <p style={{ color: '#888', fontSize: 14 }}>
            {step === 1 ? 'Enter your email to receive a 5-minute reset code.' : `Code sent to ${email}`}
          </p>
        </div>

        {step === 1 ? (
          /* ── STEP 1: Enter Email ── */
          <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ color: '#888', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 8 }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(233,30,140,0.1)', border: '1px solid rgba(233,30,140,0.3)',
                borderRadius: 8, padding: '12px 16px', color: '#e91e8c', fontSize: 13, lineHeight: 1.5
              }}>
                ❌ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '14px', background: 'linear-gradient(135deg,#e91e8c,#9c27b0)',
                border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600,
                cursor: 'pointer', opacity: loading ? 0.7 : 1, marginTop: 4
              }}
            >
              {loading ? 'Sending code...' : 'Send Reset Code →'}
            </button>
          </form>
        ) : (
          /* ── STEP 2: OTP & New Password ── */
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 5-Minute Countdown Timer */}
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
              <label style={{ color: '#888', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 8 }}>
                6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                required
                autoFocus
                style={{
                  ...inputStyle,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 8,
                  textAlign: 'center',
                  fontFamily: "'Courier New', monospace",
                  border: '1px solid rgba(233, 30, 140, 0.4)',
                }}
              />
            </div>

            <div>
              <label style={{ color: '#888', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 8 }}>
                New Password
              </label>
              <input
                type="password"
                placeholder="Min 8 chars, 1 number"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                style={inputStyle}
              />
              {newPassword && (
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
              <label style={{ color: '#888', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 8 }}>
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            {message && (
              <div style={{
                background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)',
                borderRadius: 8, padding: '12px 16px', color: '#4caf50', fontSize: 13, lineHeight: 1.5
              }}>
                ✅ {message}
              </div>
            )}

            {error && (
              <div style={{
                background: 'rgba(233,30,140,0.1)', border: '1px solid rgba(233,30,140,0.3)',
                borderRadius: 8, padding: '12px 16px', color: '#e91e8c', fontSize: 13, lineHeight: 1.5
              }}>
                ❌ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || expirySeconds <= 0}
              style={{
                padding: '14px',
                background: expirySeconds > 0 ? 'linear-gradient(135deg,#e91e8c,#9c27b0)' : '#333',
                border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600,
                cursor: expirySeconds > 0 ? 'pointer' : 'not-allowed',
                opacity: loading ? 0.7 : 1, marginTop: 4
              }}
            >
              {loading ? 'Resetting...' : 'Set New Password ✨'}
            </button>

            {/* Actions: Back to Step 1 and Resend Code */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); setMessage(''); }}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', padding: 0 }}
              >
                ← Change email
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

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link to="/login" style={{ color: '#888', fontSize: 14, textDecoration: 'none' }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
