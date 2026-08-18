/**
 * PaymentModal — Ectama/Avoiga branded checkout confirmation.
 * Uses rzp.open() with ALL fields pre-filled so Razorpay SKIPS the
 * "Contact Details" form and goes straight to the payment screen.
 * hide_topbar removes the pink Razorpay header entirely.
 */
import React, { useState, useEffect } from 'react';
import API from '../api/api';
import brand from '../config/brand';

const C = brand.colors;

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export default function PaymentModal({ plan, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Escape key to close
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && !loading) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [loading, onClose]);

  const handlePay = async () => {
    setError('');
    setLoading(true);

    try {
      // 1. Create Razorpay order via backend
      const orderRes = await API.post('/api/payment/create-order', { plan_id: plan.id });
      const orderData = orderRes.data;

      // 2. Load SDK
      const ok = await loadRazorpay();
      if (!ok) throw new Error('Payment SDK failed to load. Please check your internet.');

      // 3. Open Razorpay with ALL prefill fields so contact-form is skipped
      //    hide_topbar removes the pink branded header
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.order_id,
        name: 'Ectama',
        description: `${plan.display_name} Plan Subscription`,
        image: `${window.location.origin}/ectama-logo.png`,
        theme: {
          color: C.primary,
          hide_topbar: true,           // ← removes the pink Razorpay header
        },
        prefill: {
          name:    userInfo.full_name  || 'User',
          email:   userInfo.email      || 'user@avoiga.com',
          contact: userInfo.phone      || '9000000000', // dummy — skips contact form
        },
        modal: {
          backdropclose: false,
          escape: false,
          animation: true,
          ondismiss: () => {
            setLoading(false);
          },
        },
        handler: async (response) => {
          try {
            const verifyRes = await API.post('/api/payment/verify', {
              plan_id: plan.id,
              razorpay_order_id:  response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            });

            const info = JSON.parse(localStorage.getItem('user_info') || '{}');
            info.plan_name        = verifyRes.data.plan;
            info.credits_remaining = verifyRes.data.credits;
            info.is_unlimited     = verifyRes.data.is_unlimited;
            localStorage.setItem('user_info', JSON.stringify(info));

            onSuccess(verifyRes.data.plan);
          } catch (err) {
            setError('Payment received but verification failed. Contact support.');
            setLoading(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        setError(resp.error?.description || 'Payment failed. Please try again.');
        setLoading(false);
      });

      rzp.open();

    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes pmIn  { from { opacity:0; transform: translateY(24px) scale(0.96); } to { opacity:1; transform: none; } }
        @keyframes pmSpin { to { transform: rotate(360deg); } }
        @keyframes pmShimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        .pm-pay-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px ${C.primary}66 !important;
        }
        .pm-pay-btn:active:not(:disabled) { transform: translateY(0); }
        .pm-feature { transition: background 0.15s; }
        .pm-feature:hover { background: rgba(255,255,255,0.04) !important; }
      `}</style>

      <div style={{
        background: 'linear-gradient(160deg, #0f0f1a 0%, #0a0a12 100%)',
        borderRadius: 24,
        width: '100%', maxWidth: 400,
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: `0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px ${C.primary}15`,
        animation: 'pmIn 0.35s cubic-bezier(.22,1,.36,1)',
        overflow: 'hidden',
      }}>

        {/* ── Brand header ── */}
        <div style={{
          background: `linear-gradient(135deg, ${C.primary}18, ${C.accent}10)`,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          padding: '24px 24px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Ectama logo area */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, ${C.primary}, ${C.accent})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, boxShadow: `0 4px 12px ${C.primary}44`,
              }}>💜</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, letterSpacing: '-0.2px' }}>Ectama</div>
                <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.3px' }}>Secure Checkout</div>
              </div>
            </div>

            {/* Close */}
            {!loading && (
              <button onClick={onClose} style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)',
                color: '#555', cursor: 'pointer', width: 30, height: 30,
                borderRadius: '50%', fontSize: 16, display: 'flex',
                alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
              >×</button>
            )}
          </div>
        </div>

        {/* ── Plan summary ── */}
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: C.text }}>{plan.display_name} Plan</div>
                <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>Monthly subscription</div>
              </div>
              <div style={{
                fontWeight: 900, fontSize: 26, color: C.primary,
                lineHeight: 1,
              }}>₹{plan.price_monthly}</div>
            </div>

            {/* Features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                plan.is_unlimited ? '∞ Unlimited Credits' : `${plan.monthly_credits?.toLocaleString()} Credits / month`,
                plan.can_use_voice   && '🎤 Voice Messages',
                plan.can_use_images  && '📸 Image Generation',
                plan.can_access_premium_chars && '👑 Premium Characters',
              ].filter(Boolean).map((f, i) => (
                <div key={i} className="pm-feature" style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12.5, color: '#888', padding: '4px 6px', borderRadius: 6,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.primary, flexShrink: 0 }} />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Who is paying */}
          <div style={{
            marginTop: 12, padding: '10px 14px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.primary}33, ${C.accent}33)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: C.primary, fontWeight: 700,
            }}>
              {(userInfo.full_name || userInfo.email || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>
                {userInfo.full_name || 'User'}
              </div>
              <div style={{ fontSize: 11, color: '#555' }}>{userInfo.email}</div>
            </div>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{
            margin: '12px 24px 0',
            background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.2)',
            borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ff6b6b',
            display: 'flex', gap: 8,
          }}>
            <span>⚠️</span><span>{error}</span>
          </div>
        )}

        {/* ── Pay button ── */}
        <div style={{ padding: '20px 24px 24px' }}>
          <button
            className="pm-pay-btn"
            onClick={handlePay}
            disabled={loading}
            style={{
              width: '100%', padding: '15px',
              borderRadius: 13, border: 'none',
              background: loading
                ? 'rgba(255,255,255,0.05)'
                : `linear-gradient(135deg, ${C.primary}, ${C.accent})`,
              color: loading ? '#555' : '#fff',
              fontWeight: 700, fontSize: 16,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'all 0.2s', fontFamily: 'inherit',
              boxShadow: loading ? 'none' : `0 6px 24px ${C.primary}44`,
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: '2px solid #444', borderTopColor: '#aaa',
                  animation: 'pmSpin 0.7s linear infinite',
                }} />
                Opening secure payment…
              </>
            ) : (
              <>🔒 Pay ₹{plan.price_monthly} Securely</>
            )}
          </button>

          {/* Minimal security note */}
          <div style={{
            marginTop: 14, textAlign: 'center',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ fontSize: 11, color: '#333', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
              <span>🔒</span>
              <span>256-bit SSL · PCI DSS Certified · Encrypted</span>
            </div>
            <div style={{ fontSize: 10, color: '#222' }}>Secured by Razorpay</div>
          </div>
        </div>
      </div>
    </div>
  );
}
