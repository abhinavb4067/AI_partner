import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api/api';

const KPI_CARDS = [
  { key: 'total_users', label: 'Total Users', icon: '👥', color: '#e91e8c' },
  { key: 'active_users', label: 'Active Users', icon: '✅', color: '#4caf50' },
  { key: 'total_revenue', label: 'Total Revenue', icon: '💰', color: '#ffd700', prefix: '₹' },
  { key: 'messages_today', label: 'Messages Today', icon: '💬', color: '#2196f3' },
  { key: 'new_users_today', label: 'New Today', icon: '🆕', color: '#9c27b0' },
  { key: 'active_subscriptions', label: 'Paid Subs', icon: '💎', color: '#ff9800' },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.get('/api/admin/stats')
      .then((r) => setStats(r.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const cardStyle = {
    background: '#12121a',
    borderRadius: 14,
    padding: '20px 22px',
    border: '1px solid rgba(255,255,255,0.06)',
  };

  return (
    <div style={{ color: '#f0f0f0' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
        Dashboard
      </h1>

      <p style={{ color: '#666', fontSize: 14, marginBottom: 28 }}>
        Welcome back, Admin 👋
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {KPI_CARDS.map((card) => (
          <div key={card.key} style={cardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <p
                  style={{
                    color: '#666',
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  {card.label}
                </p>

                <p
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: card.color,
                    margin: 0,
                  }}
                >
                  {loading
                    ? '—'
                    : `${card.prefix || ''}${stats?.[card.key] ?? 0}`}
                </p>
              </div>

              <span style={{ fontSize: 24 }}>{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: '#12121a',
          borderRadius: 14,
          padding: 24,
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <h3 style={{ marginBottom: 15 }}>System Status</h3>

        <p style={{ color: '#4caf50' }}>
          ✅ Dashboard loaded successfully
        </p>

        <p style={{ color: '#888' }}>
          Charts are temporarily disabled.
        </p>
      </div>
    </div>
  );
}