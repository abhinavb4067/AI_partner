import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import brand from '../config/brand';
import API from '../api/api';

export default function Pricing() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const isLoggedIn = Boolean(localStorage.getItem('token'));

  useEffect(() => {
    API.get('/api/admin/plans').then(r => setPlans(r.data.filter(p => p.is_active !== false))).catch(() => {});
  }, []);

  const handleSubscribe = async (plan) => {
    if (!isLoggedIn) { navigate('/login'); return; }
    if (plan.price_monthly === 0) { navigate('/select-character'); return; }
    setLoading(true);
    try {
      const res = await API.post('/api/payment/create-order', { plan_id: plan.id });
      const { order_id, amount, key_id } = res.data;

      if (key_id.includes('DUMMY')) {
        // Dev mode: simulate success
        const verify = await API.post('/api/payment/verify', {
          razorpay_order_id: order_id, razorpay_payment_id: 'pay_DUMMY_SUCCESS',
          razorpay_signature: 'dummy_signature', plan_id: plan.id,
        });
        const info = JSON.parse(localStorage.getItem('user_info') || '{}');
        info.plan_name = plan.plan_name;
        info.credits_remaining = plan.monthly_credits;
        info.is_unlimited = plan.is_unlimited;
        localStorage.setItem('user_info', JSON.stringify(info));
        alert(`✅ (Dev Mode) Upgraded to ${plan.display_name}!`);
        navigate('/select-character');
        return;
      }

      // Real Razorpay checkout
      const options = {
        key: key_id, amount, currency: res.data.currency,
        name: brand.name, description: `${plan.display_name} Plan`,
        order_id,
        handler: async (response) => {
          await API.post('/api/payment/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            plan_id: plan.id,
          });
          navigate('/select-character');
        },
        theme: { color: '#e91e8c' },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      alert(e.response?.data?.detail || 'Payment failed. Try again.');
    }
    setLoading(false);
  };

  const PLAN_COLORS = { free: '#888', starter: '#2196f3', pro: '#9c27b0', elite: '#ffd700' };
  const PLAN_ICONS = { free: '🆓', starter: '⭐', pro: '💜', elite: '👑' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f0f0f0', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .plan-card { transition: transform 0.25s, box-shadow 0.25s; }
        .plan-card:hover { transform: translateY(-8px); box-shadow: 0 24px 60px rgba(0,0,0,0.4); }
      `}</style>

      {/* Header */}
      <div style={{ background: '#12121a', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }}>← {brand.name}</button>
        <h1 style={{ fontSize: 17, fontWeight: 700 }}>Choose Your Plan</h1>
        <button onClick={() => navigate(isLoggedIn ? '/select-character' : '/login')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }}>
          {isLoggedIn ? 'My Account →' : 'Sign In →'}
        </button>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 42, fontWeight: 900, marginBottom: 12 }}>Simple, Transparent Pricing</h2>
          <p style={{ color: '#666', fontSize: 16 }}>Credit-based system. Upgrade, downgrade or cancel anytime.</p>
          <div style={{ marginTop: 20, background: 'rgba(233,30,140,0.08)', border: '1px solid rgba(233,30,140,0.2)',
            borderRadius: 12, padding: '12px 20px', display: 'inline-block', fontSize: 13, color: '#e91e8c' }}>
            💎 1 credit/message · 📸 5 credits/photo · 🎤 2 credits/voice
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
          {plans.length === 0 ? (
            [
              { id: 1, plan_name: 'free', display_name: 'Free', price_monthly: 0, monthly_credits: 50, is_unlimited: false },
              { id: 2, plan_name: 'starter', display_name: 'Starter', price_monthly: 199, monthly_credits: 500, is_unlimited: false },
              { id: 3, plan_name: 'pro', display_name: 'Pro', price_monthly: 499, monthly_credits: 2000, is_unlimited: false },
              { id: 4, plan_name: 'elite', display_name: 'Elite', price_monthly: 999, monthly_credits: 999999, is_unlimited: true },
            ].map(plan => <PlanCard key={plan.id} plan={plan} colors={PLAN_COLORS} icons={PLAN_ICONS} onSubscribe={handleSubscribe} loading={loading} />)
          ) : (
            plans.map(plan => <PlanCard key={plan.id} plan={plan} colors={PLAN_COLORS} icons={PLAN_ICONS} onSubscribe={handleSubscribe} loading={loading} />)
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#444', fontSize: 13, marginTop: 40 }}>
          Payments are secured by Razorpay · INR pricing · Cancel anytime
        </p>
      </div>
    </div>
  );
}

function PlanCard({ plan, colors, icons, onSubscribe, loading }) {
  const color = colors[plan.plan_name] || '#888';
  const icon = icons[plan.plan_name] || '💎';
  const currentPlan = JSON.parse(localStorage.getItem('user_info') || '{}')?.plan_name;
  const isCurrent = currentPlan === plan.plan_name;

  return (
    <div className="plan-card" style={{ background: '#12121a', borderRadius: 20, padding: 28,
      border: `1px solid ${isCurrent ? color : color + '33'}`,
      boxShadow: isCurrent ? `0 0 30px ${color}22` : 'none', position: 'relative', overflow: 'hidden' }}>
      {isCurrent && (
        <div style={{ position: 'absolute', top: 14, right: 14, background: `${color}22`,
          color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: `1px solid ${color}44` }}>
          Current Plan
        </div>
      )}
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      <h3 style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>{plan.display_name}</h3>
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 34, fontWeight: 900, color }}>{plan.price_monthly === 0 ? 'Free' : `₹${plan.price_monthly}`}</span>
        {plan.price_monthly > 0 && <span style={{ color: '#555', fontSize: 13 }}>/month</span>}
      </div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 4 }}>
          {plan.is_unlimited ? '∞' : plan.monthly_credits?.toLocaleString()}
        </div>
        <div style={{ color: '#555', fontSize: 12 }}>{plan.is_unlimited ? 'Unlimited credits' : 'credits per month'}</div>
      </div>
      <button onClick={() => onSubscribe(plan)} disabled={loading || isCurrent}
        style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', fontWeight: 700, cursor: isCurrent ? 'default' : 'pointer',
          background: isCurrent ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${color},${color}cc)`,
          color: isCurrent ? '#555' : plan.plan_name === 'elite' ? '#000' : '#fff', fontSize: 14 }}>
        {isCurrent ? 'Current Plan' : plan.price_monthly === 0 ? 'Start Free' : loading ? 'Processing...' : `Upgrade to ${plan.display_name}`}
      </button>
    </div>
  );
}
