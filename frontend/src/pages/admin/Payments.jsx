import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api/api';

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const STATUS_COLORS = { success: '#4caf50', pending: '#ff9800', failed: '#e91e8c' };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = { page, per_page: 20 };
        if (statusFilter) params.status = statusFilter;
        const res = await adminAPI.get('/api/admin/payments', { params });
        setPayments(res.data.payments);
        setTotal(res.data.total);
      } catch (e) {}
      setLoading(false);
    };
    fetch();
  }, [page, statusFilter]);

  const cell = { padding: '14px 16px', fontSize: 13, color: '#ccc', borderBottom: '1px solid rgba(255,255,255,0.05)' };
  const th = { ...cell, color: '#666', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' };

  return (
    <div style={{ color: '#f0f0f0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Payments</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>{total} total transactions</p>
      <div style={{ marginBottom: 16 }}>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ padding: '10px 14px', background: '#12121a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0f0f0', fontSize: 14, outline: 'none' }}>
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div style={{ background: '#12121a', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['User', 'Plan', 'Amount', 'Status', 'Order ID', 'Payment ID', 'Date'].map(h => (
              <th key={h} style={th}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={7} style={{ ...cell, textAlign: 'center', padding: 40, color: '#555' }}>Loading...</td></tr>
              : payments.length === 0
              ? <tr><td colSpan={7} style={{ ...cell, textAlign: 'center', padding: 40, color: '#555' }}>No payments yet</td></tr>
              : payments.map(p => (
                <tr key={p.id}>
                  <td style={cell}>{p.user_email || '—'}</td>
                  <td style={cell} className="capitalize">{p.plan_name}</td>
                  <td style={{ ...cell, color: '#4caf50', fontWeight: 600 }}>₹{p.amount}</td>
                  <td style={cell}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: `${STATUS_COLORS[p.status] || '#888'}22`, color: STATUS_COLORS[p.status] || '#888' }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: 11, color: '#555' }}>{p.razorpay_order_id || '—'}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: 11, color: '#555' }}>{p.razorpay_payment_id || '—'}</td>
                  <td style={{ ...cell, fontSize: 12 }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: page === 1 ? '#444' : '#ccc', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>← Prev</button>
        <span style={{ padding: '8px 16px', color: '#666', fontSize: 13 }}>Page {page}</span>
        <button disabled={payments.length < 20} onClick={() => setPage(p => p + 1)}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: payments.length < 20 ? '#444' : '#ccc', cursor: payments.length < 20 ? 'not-allowed' : 'pointer' }}>Next →</button>
      </div>
    </div>
  );
}
