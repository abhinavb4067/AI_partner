import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import brand from '../../config/brand';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/characters', label: 'Characters', icon: '💃' },
  { to: '/admin/plans', label: 'Plans', icon: '💎' },
  { to: '/admin/payments', label: 'Payments', icon: '💳' },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const adminInfo = JSON.parse(localStorage.getItem('admin_info') || '{}');

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    navigate('/admin/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0f', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        .nav-link { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:8px;
          color:#888; text-decoration:none; font-size:14px; font-weight:500; transition:all 0.15s; }
        .nav-link:hover { background:rgba(233,30,140,0.1); color:#e91e8c; }
        .nav-link.active { background:linear-gradient(135deg,rgba(233,30,140,0.15),rgba(156,39,176,0.15));
          color:#e91e8c; border-left:3px solid #e91e8c; }
        ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#2a2a3a; border-radius:3px; }
      `}</style>

      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 64 : 220, transition: 'width 0.25s',
        background: '#12121a', borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#e91e8c,#9c27b0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🛡️</div>
          {!collapsed && <span style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 14 }}>{brand.shortName} Admin</span>}
          <button onClick={() => setCollapsed(!collapsed)} style={{
            marginLeft: 'auto', background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16,
          }}>{collapsed ? '→' : '←'}</button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
              <span style={{ fontSize: 17 }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {!collapsed && (
            <p style={{ color: '#555', fontSize: 11, marginBottom: 8, padding: '0 6px' }}>
              {adminInfo.full_name || 'Admin'} ({adminInfo.role || 'superadmin'})
            </p>
          )}
          <button onClick={logout} style={{
            width: '100%', padding: '9px 12px', background: 'rgba(233,30,140,0.1)',
            border: '1px solid rgba(233,30,140,0.2)', borderRadius: 8,
            color: '#e91e8c', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 8, justifyContent: collapsed ? 'center' : 'flex-start',
          }}>
            🚪 {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
        <Outlet />
      </main>
    </div>
  );
}
