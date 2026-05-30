import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/api';

const TABS = ['My Profile', 'Change Password', 'Subscription', 'Danger Zone'];

export default function Profile() {
  const [tab, setTab] = useState(0);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/api/profile/me').then(r => setProfile(r.data)).catch(() => navigate('/login')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e91e8c', fontFamily: 'Inter, sans-serif' }}>Loading...</div>;

  const card = { background: '#12121a', borderRadius: 16, padding: 28, border: '1px solid rgba(255,255,255,0.06)' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: "'Inter', system-ui, sans-serif", color: '#f0f0f0' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .inp{width:100%;padding:12px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f0f0f0;font-size:14px;outline:none;box-sizing:border-box;}
        .inp:focus{border-color:#e91e8c;} .btn-primary{padding:12px 24px;background:linear-gradient(135deg,#e91e8c,#9c27b0);border:none;border-radius:10px;color:#fff;font-weight:600;cursor:pointer;font-size:14px;}
        .btn-ghost{padding:12px 24px;border:1px solid rgba(255,255,255,0.1);background:none;border-radius:10px;color:#888;cursor:pointer;font-size:14px;}
      `}</style>

      {/* Header */}
      <div style={{ background: '#12121a', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate('/select-character')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }}>← Back</button>
        <h1 style={{ fontSize: 17, fontWeight: 700 }}>My Account</h1>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px', display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              padding: '11px 16px', textAlign: 'left', background: tab === i ? 'rgba(233,30,140,0.12)' : 'none',
              border: tab === i ? '1px solid rgba(233,30,140,0.25)' : '1px solid transparent',
              borderRadius: 10, color: tab === i ? '#e91e8c' : '#666', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            }}>{t}</button>
          ))}
        </div>

        {/* Content */}
        <div>
          {tab === 0 && <ProfileTab profile={profile} onUpdate={setProfile} card={card} />}
          {tab === 1 && <PasswordTab card={card} />}
          {tab === 2 && <SubscriptionTab profile={profile} card={card} navigate={navigate} />}
          {tab === 3 && <DangerTab card={card} navigate={navigate} />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ profile, onUpdate, card }) {
  const [name, setName] = useState(profile?.name || '');
  const [email, setEmail] = useState(profile?.email || profile?.user_id || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef();

  const save = async () => {
    setSaving(true);
    try {
      await API.put('/api/profile/update', { name, email });
      setMsg('✓ Profile updated!');
      onUpdate(p => ({ ...p, name, email }));
      localStorage.setItem('user_name', name);
    } catch (e) { setMsg('❌ ' + (e.response?.data?.detail || 'Update failed')); }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const uploadAvatar = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('file', f);
    try {
      const res = await API.post('/api/profile/upload-avatar', fd);
      onUpdate(p => ({ ...p, avatar_url: res.data.avatar_url }));
    } catch (e) { alert('Upload failed'); }
  };

  const avatarSrc = profile?.avatar_url ? `${import.meta.env.VITE_API_URL}${profile.avatar_url}` : null;

  return (
    <div style={card}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>My Profile</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#e91e8c,#9c27b0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, overflow: 'hidden' }}>
            {avatarSrc ? <img src={avatarSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" /> : '👤'}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#e91e8c', borderRadius: '50%',
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>📷</div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
        </div>
        <div>
          <p style={{ fontWeight: 600, fontSize: 16 }}>{profile?.name || 'No name set'}</p>
          <p style={{ color: '#666', fontSize: 13 }}>{profile?.email || profile?.user_id}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 7 }}>Display Name</label>
          <input className="inp" value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 7 }}>Email</label>
          <input className="inp" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
      </div>
      {msg && <p style={{ marginTop: 14, fontSize: 13, color: msg.startsWith('✓') ? '#4caf50' : '#e91e8c' }}>{msg}</p>}
      <button className="btn-primary" onClick={save} disabled={saving} style={{ marginTop: 20 }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function PasswordTab({ card }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await API.put('/api/profile/change-password', form);
      setMsg('✓ Password updated successfully!');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e) { setMsg('❌ ' + (e.response?.data?.detail || 'Update failed')); }
    setSaving(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const strength = (p) => {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s += 25; if (/\d/.test(p)) s += 25;
    if (/[!@#$%^&*]/.test(p)) s += 25; if (p.length >= 12) s += 25;
    return s;
  };
  const sw = strength(form.new_password);

  return (
    <div style={card}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>Change Password</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[['current_password', 'Current Password'], ['new_password', 'New Password'], ['confirm_password', 'Confirm New Password']].map(([k, label]) => (
          <div key={k}><label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 7 }}>{label}</label>
            <input className="inp" type="password" value={form[k]} onChange={e => set(k, e.target.value)} /></div>
        ))}
        {form.new_password && (
          <div>
            <div style={{ height: 4, borderRadius: 2, background: '#1a1a26', overflow: 'hidden' }}>
              <div style={{ width: `${sw}%`, height: '100%', background: sw < 50 ? '#e91e8c' : sw < 75 ? '#ff9800' : '#4caf50', transition: 'all 0.3s' }} />
            </div>
            <p style={{ fontSize: 11, color: '#666', marginTop: 5 }}>
              {sw < 50 ? 'Weak' : sw < 75 ? 'Good' : 'Strong'} — min 8 chars, 1 number, 1 special char
            </p>
          </div>
        )}
      </div>
      {msg && <p style={{ marginTop: 14, fontSize: 13, color: msg.startsWith('✓') ? '#4caf50' : '#e91e8c' }}>{msg}</p>}
      <button className="btn-primary" onClick={save} disabled={saving} style={{ marginTop: 20 }}>
        {saving ? 'Updating...' : 'Update Password'}
      </button>
    </div>
  );
}

function SubscriptionTab({ profile, card, navigate }) {
  const PLAN_COLORS = { free: '#888', starter: '#2196f3', pro: '#9c27b0', elite: '#ffd700' };
  const plan = profile?.plan || {};
  const color = PLAN_COLORS[plan.name] || '#888';
  const used = plan.monthly_credits - (profile?.credits_remaining || 0);
  const pct = plan.is_unlimited || profile?.is_unlimited ? 100 : Math.max(0, ((profile?.credits_remaining || 0) / (plan.monthly_credits || 1)) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Subscription & Credits</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: `${color}22`, color, border: `1px solid ${color}44` }}>
              {plan.display_name || 'Free'} Plan
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 36, fontWeight: 800, color: profile?.is_unlimited || plan.is_unlimited ? '#ffd700' : '#f0f0f0', margin: 0 }}>
              {profile?.is_unlimited || plan.is_unlimited ? '∞' : (profile?.credits_remaining ?? 0)}
            </p>
            <p style={{ color: '#666', fontSize: 12, margin: 0 }}>credits remaining</p>
          </div>
        </div>
        {!profile?.is_unlimited && !plan.is_unlimited && (
          <>
            <div style={{ height: 8, borderRadius: 4, background: '#1a1a26', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${color},${color}99)`, transition: 'width 0.5s' }} />
            </div>
            <p style={{ fontSize: 12, color: '#666' }}>{profile?.credits_remaining} of {plan.monthly_credits} credits remaining this month</p>
          </>
        )}
        {profile?.credits_reset_at && (
          <p style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
            Resets on {new Date(profile.credits_reset_at).toLocaleDateString()}
          </p>
        )}
        <button className="btn-primary" onClick={() => navigate('/pricing')} style={{ marginTop: 20 }}>
          Upgrade Plan ↗
        </button>
      </div>

      {profile?.recent_payments?.length > 0 && (
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Recent Payments</h3>
          {profile.recent_payments.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
              <span style={{ color: '#ccc' }}>₹{p.amount}</span>
              <span style={{ color: p.status === 'success' ? '#4caf50' : '#ff9800' }}>{p.status}</span>
              <span style={{ color: '#555' }}>{new Date(p.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DangerTab({ card, navigate }) {
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const deleteAccount = async () => {
    if (confirm !== 'DELETE') { alert('Type DELETE to confirm'); return; }
    setLoading(true);
    try {
      await API.delete('/api/profile/delete-account', { data: { password } });
      localStorage.clear();
      navigate('/');
    } catch (e) { alert(e.response?.data?.detail || 'Failed to delete account'); }
    setLoading(false);
  };

  return (
    <div style={{ ...card, border: '1px solid rgba(233,30,140,0.2)' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#e91e8c' }}>⚠️ Danger Zone</h2>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>Deleting your account is permanent and cannot be undone. All your conversations and data will be lost.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 7 }}>Your Password</label>
          <input className="inp" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Confirm your password" /></div>
        <div><label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 7 }}>Type <strong style={{ color: '#e91e8c' }}>DELETE</strong> to confirm</label>
          <input className="inp" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="DELETE" /></div>
      </div>
      <button onClick={deleteAccount} disabled={loading || confirm !== 'DELETE'}
        style={{ marginTop: 20, padding: '12px 24px', background: confirm === 'DELETE' ? '#c62828' : '#1a1a26',
          border: 'none', borderRadius: 10, color: confirm === 'DELETE' ? '#fff' : '#555', cursor: confirm === 'DELETE' ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 14 }}>
        {loading ? 'Deleting...' : 'Delete My Account'}
      </button>
      <style>{`.inp{width:100%;padding:12px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f0f0f0;font-size:14px;outline:none;box-sizing:border-box;} .inp:focus{border-color:#e91e8c;}`}</style>
    </div>
  );
}
