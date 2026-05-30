import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api/api';

export default function AdminPlans() {
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminAPI.get('/api/admin/plans').then(r => setPlans(r.data)).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await adminAPI.put(`/api/admin/plans/${editing.id}`, {
        display_name: editing.display_name,
        price_monthly: Number(editing.price_monthly),
        price_yearly: Number(editing.price_yearly),
        monthly_credits: Number(editing.monthly_credits),
        is_unlimited: editing.is_unlimited,
        can_use_voice: editing.can_use_voice,
        can_use_images: editing.can_use_images,
        can_access_premium_chars: editing.can_access_premium_chars,
      });
      const res = await adminAPI.get('/api/admin/plans');
      setPlans(res.data);
      setEditing(null);
    } catch (e) { alert('Save failed'); }
    setSaving(false);
  };

  const PLAN_COLORS = { free: '#888', starter: '#2196f3', pro: '#9c27b0', elite: '#ffd700' };
  const inputStyle = { width: '100%', padding: '9px 12px', background: '#1a1a26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0f0f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ color: '#f0f0f0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Subscription Plans</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>Manage credit limits and pricing</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {plans.map(plan => (
          <div key={plan.id} style={{ background: '#12121a', borderRadius: 16, padding: 22,
            border: `1px solid ${PLAN_COLORS[plan.plan_name] || '#888'}33` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 22, marginRight: 8 }}>
                  {plan.plan_name === 'free' ? '🆓' : plan.plan_name === 'starter' ? '⭐' : plan.plan_name === 'pro' ? '💜' : '👑'}
                </span>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{plan.display_name || plan.plan_name}</span>
              </div>
              <span style={{ color: PLAN_COLORS[plan.plan_name] || '#888', fontWeight: 700, fontSize: 18 }}>
                ₹{plan.price_monthly}
                <span style={{ fontSize: 11, color: '#666' }}>/mo</span>
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <Feature active={plan.is_unlimited} label={plan.is_unlimited ? 'Unlimited Credits' : `${plan.monthly_credits} credits/mo`} />
              <Feature active={plan.can_use_images} label="Image Generation" />
              <Feature active={plan.can_use_voice} label="Voice Messages" />
              <Feature active={plan.can_access_premium_chars} label="Premium Characters" />
            </div>
            <button onClick={() => setEditing({ ...plan })} style={{ width: '100%', padding: '9px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#ccc', cursor: 'pointer', fontSize: 13 }}>
              ✏️ Edit Plan
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#12121a', borderRadius: 20, padding: 32, width: 420,
            border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ color: '#f0f0f0', marginBottom: 20 }}>Edit: {editing.display_name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 5 }}>Display Name</label>
                <input style={inputStyle} value={editing.display_name || ''} onChange={e => setEditing(p => ({ ...p, display_name: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 5 }}>Monthly Price (₹)</label>
                  <input style={inputStyle} type="number" value={editing.price_monthly || 0} onChange={e => setEditing(p => ({ ...p, price_monthly: e.target.value }))} /></div>
                <div><label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 5 }}>Yearly Price (₹)</label>
                  <input style={inputStyle} type="number" value={editing.price_yearly || 0} onChange={e => setEditing(p => ({ ...p, price_yearly: e.target.value }))} /></div>
              </div>
              <div><label style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 5 }}>Credits/Month</label>
                <input style={inputStyle} type="number" value={editing.monthly_credits || 0} onChange={e => setEditing(p => ({ ...p, monthly_credits: e.target.value }))} /></div>
              {['is_unlimited', 'can_use_images', 'can_use_voice', 'can_access_premium_chars'].map(key => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={editing[key] || false} onChange={e => setEditing(p => ({ ...p, [key]: e.target.checked }))} />
                  <span style={{ color: '#ccc', fontSize: 13 }}>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => setEditing(null)} style={{ flex: 1, padding: 11, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#888', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: 11, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#e91e8c,#9c27b0)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Feature = ({ active, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
    <span style={{ color: active ? '#4caf50' : '#444' }}>{active ? '✓' : '✗'}</span>
    <span style={{ color: active ? '#ccc' : '#555' }}>{label}</span>
  </div>
);
