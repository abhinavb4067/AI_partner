import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const KPI_CARDS = [
  { key: 'total_users', label: 'Total Users', icon: '👥', color: '#e91e8c' },
  { key: 'active_users', label: 'Active Users', icon: '✅', color: '#4caf50' },
  { key: 'total_revenue', label: 'Total Revenue', icon: '💰', color: '#ffd700', prefix: '₹' },
  { key: 'messages_today', label: "Messages Today", icon: '💬', color: '#2196f3' },
  { key: 'new_users_today', label: 'New Today', icon: '🆕', color: '#9c27b0' },
  { key: 'active_subscriptions', label: 'Paid Subs', icon: '💎', color: '#ff9800' },
];

const PLAN_COLORS = ['#888', '#2196f3', '#9c27b0', '#ffd700'];
const MOCK_LINE = Array.from({ length: 7 }, (_, i) => ({
  day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
  messages: Math.floor(Math.random() * 200) + 50,
}));
const MOCK_PIE = [
  { name: 'Free', value: 60 }, { name: 'Starter', value: 20 },
  { name: 'Pro', value: 15 }, { name: 'Elite', value: 5 },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.get('/api/admin/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cardStyle = {
    background: '#12121a', borderRadius: 14, padding: '20px 22px',
    border: '1px solid rgba(255,255,255,0.06)',
  };

  return (
    <div style={{ color: '#f0f0f0' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Dashboard</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 28 }}>Welcome back, Admin 👋</p>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
        {KPI_CARDS.map((card) => (
          <div key={card.key} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ color: '#666', fontSize: 12, marginBottom: 6 }}>{card.label}</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: card.color, margin: 0 }}>
                  {loading ? '—' : `${card.prefix || ''}${stats?.[card.key] ?? 0}`}
                </p>
              </div>
              <span style={{ fontSize: 24 }}>{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: '#ccc' }}>Messages (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={MOCK_LINE}>
              <XAxis dataKey="day" stroke="#444" tick={{ fontSize: 12 }} />
              <YAxis stroke="#444" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#1a1a26', border: '1px solid #333', borderRadius: 8 }} />
              <Line type="monotone" dataKey="messages" stroke="#e91e8c" strokeWidth={2} dot={{ fill: '#e91e8c' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: '#ccc' }}>Plan Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={MOCK_PIE} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {MOCK_PIE.map((_, i) => <Cell key={i} fill={PLAN_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a26', border: '1px solid #333', borderRadius: 8 }} />
              <Legend iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
