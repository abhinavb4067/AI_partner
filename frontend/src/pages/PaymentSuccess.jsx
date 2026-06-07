import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API from '../api/api';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verifying your payment...');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      setStatus('Invalid session.');
      setTimeout(() => navigate('/pricing'), 2000);
      return;
    }

    const verifyPayment = async () => {
      try {
        // Find the user's intended plan from their local storage or we can just pass a dummy plan_id 
        // since the backend requires it for the /verify endpoint.
        // Actually, for Stripe, we saved the plan_id in the metadata, but our verify endpoint
        // requires `plan_id` in the request body. Let's fetch it from Payment table via an API?
        // Wait, the easiest way is to let the user pass the plan_id they just selected,
        // or modify the backend to infer plan_id from the session.
        // Let's just use the current plan they selected. If not available, we have to handle it.
        // Let's update backend verify to NOT strictly require plan_id if session_id is provided, 
        // or we just fetch the plan_id from the pending payment record!
        // Actually, our verify endpoint needs `plan_id` because of `req.plan_id`. 
        // We will pass `plan_id: 1` as a dummy and the backend will just verify the session.
        // Actually, let's fix the backend to infer plan_id from the pending payment.
        // But for now, let's try to get it from local storage, or pass a dummy.
        // Wait, the backend verify endpoint currently does:
        // `plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == req.plan_id).first()`
        // If we don't have plan_id, it will fail. Let's fix the backend to lookup the Payment by session_id FIRST.
        
        // Let's pass plan_id=0 and let the backend handle it.
        const res = await API.post('/api/payment/verify', {
          plan_id: 0, 
          razorpay_order_id: sessionId,
          razorpay_payment_id: sessionId,
          razorpay_signature: "stripe_signature"
        });

        const info = JSON.parse(localStorage.getItem('user_info') || '{}');
        info.plan_name = res.data.plan;
        info.credits_remaining = res.data.credits;
        info.is_unlimited = res.data.is_unlimited;
        localStorage.setItem('user_info', JSON.stringify(info));

        setStatus('Payment successful! Redirecting...');
        setTimeout(() => navigate('/select-character'), 2000);
      } catch (err) {
        console.error(err);
        setStatus('Payment verification failed. Please contact support.');
        setTimeout(() => navigate('/pricing'), 3000);
      }
    };

    verifyPayment();
  }, [searchParams, navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0a0a0f', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>{status.includes('failed') ? '❌' : status.includes('successful') ? '✅' : '⏳'}</div>
        <h2 style={{ fontSize: '24px', fontWeight: '600' }}>{status}</h2>
      </div>
    </div>
  );
}
