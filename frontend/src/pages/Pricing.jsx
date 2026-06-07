import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import brand from '../config/brand';
import API from '../api/api';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function Pricing() {
  const [plans, setPlans] = useState([]);
  const [gatewayConfig, setGatewayConfig] = useState({ gateway: 'stripe', public_key: '' });
  const [loadingPlanName, setLoadingPlanName] = useState(null);
  const navigate = useNavigate();
  const isLoggedIn = Boolean(localStorage.getItem('token'));

  useEffect(() => {
    API.get('/api/payment/plans').then(r => setPlans(r.data)).catch(() => {});
    API.get('/api/payment/config').then(r => setGatewayConfig(r.data)).catch(() => {});
  }, []);

  const handleSubscribe = async (plan) => {
    if (!isLoggedIn) { navigate('/login'); return; }
    if (plan.price_monthly === 0) { navigate('/select-character'); return; }
    setLoadingPlanName(plan.plan_name);

    try {
      const res = await API.post('/api/payment/create-order', { plan_id: plan.id });
      
      if (res.data.gateway === 'stripe') {
        // Stripe Flow
        window.location.href = res.data.checkout_url;
      } else {
        // Razorpay Flow
        const isLoaded = await loadRazorpayScript();
        if (!isLoaded) throw new Error("Razorpay SDK failed to load.");
        
        const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
        
        const options = {
          key: res.data.key_id,
          amount: res.data.amount,
          currency: res.data.currency,
          name: brand.name,
          description: `Subscription: ${res.data.plan_name}`,
          order_id: res.data.order_id,
          handler: async function (response) {
            try {
              const verifyRes = await API.post('/api/payment/verify', {
                plan_id: plan.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              
              const info = JSON.parse(localStorage.getItem('user_info') || '{}');
              info.plan_name = verifyRes.data.plan;
              info.credits_remaining = verifyRes.data.credits;
              info.is_unlimited = verifyRes.data.is_unlimited;
              localStorage.setItem('user_info', JSON.stringify(info));
              
              alert(verifyRes.data.message);
              navigate('/select-character');
            } catch (err) {
              alert(err.response?.data?.detail || 'Payment verification failed.');
            }
          },
          prefill: {
            name: userInfo.full_name || 'User',
            email: userInfo.email || '',
          },
          theme: { color: "#e91e8c" },
        };
        
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
          alert("Payment Failed: " + response.error.description);
        });
        rzp.open();
      }
    } catch (e) {
      alert(e.response?.data?.detail || e.message || 'Payment initiation failed.');
    }
    setLoadingPlanName(null);
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
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: '#888' }}>Loading plans...</div>
          ) : (
            plans.map(plan => <PlanCard key={plan.id} plan={plan} colors={PLAN_COLORS} icons={PLAN_ICONS} onSubscribe={handleSubscribe} loading={loadingPlanName === plan.plan_name} anyLoading={loadingPlanName !== null} />)
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#444', fontSize: 13, marginTop: 40 }}>
          Payments are secured by {gatewayConfig.gateway === 'stripe' ? 'Stripe' : 'Razorpay'} · Cancel anytime
        </p>
      </div>
    </div>
  );
}

function PlanCard({ plan, colors, icons, onSubscribe, loading, anyLoading }) {
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
      <button onClick={() => onSubscribe(plan)} disabled={anyLoading || isCurrent}
        style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', fontWeight: 700, cursor: isCurrent ? 'default' : 'pointer',
          background: isCurrent ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${color},${color}cc)`,
          color: isCurrent ? '#555' : plan.plan_name === 'elite' ? '#000' : '#fff', fontSize: 14 }}>
        {isCurrent ? 'Current Plan' : plan.price_monthly === 0 ? 'Start Free' : loading ? 'Processing...' : `Upgrade to ${plan.display_name}`}
      </button>
    </div>
  );
}
