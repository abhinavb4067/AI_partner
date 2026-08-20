import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import brand from './config/brand';
import { authChannel } from './api/api';

// Public pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Pricing from './pages/Pricing';
import PaymentSuccess from './pages/PaymentSuccess';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// User pages (protected)
import CharacterSelection from './pages/CharacterSelection';
import Chat from './pages/Chat/Chat';
import Profile from './pages/Profile';
import Discover from './pages/Social/Discover';
import Matches from './pages/Social/Matches';
import HumanChat from './pages/Social/HumanChat';

// Admin pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Users from './pages/admin/Users';
import Characters from './pages/admin/Characters';
import Plans from './pages/admin/Plans';
import Payments from './pages/admin/Payments';

// Guards
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

// Set document title from brand config
document.title = brand.name;

// Global Multi-Tab Auth Synchronizer
function GlobalAuthSync() {
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        const currentPath = window.location.pathname;
        const isAuthPage = currentPath.includes('/login') || currentPath.includes('/register');
        if (!e.newValue && !isAuthPage) {
          // Token was cleared in another tab -> log out this tab too
          window.location.href = '/login?session_expired=true';
        } else if (e.newValue && isAuthPage) {
          // User logged in on another tab -> navigate away from login
          window.location.href = '/select-character';
        }
      }
    };

    const handleChannelMessage = (e) => {
      if (e.data?.type === 'SESSION_TERMINATED') {
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login?session_expired=true';
        }
      } else if (e.data?.type === 'NEW_LOGIN') {
        // If current tab is on login page, redirect to home/select-character
        if (window.location.pathname.includes('/login') || window.location.pathname.includes('/register')) {
          window.location.href = '/select-character';
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    if (authChannel) {
      authChannel.addEventListener('message', handleChannelMessage);
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (authChannel) {
        authChannel.removeEventListener('message', handleChannelMessage);
      }
    };
  }, []);

  return null;
}

import GlobalCallManager from './components/GlobalCallManager';

function App() {
  return (
    <Router>
      <GlobalAuthSync />
      <GlobalCallManager />
      <Routes>
        {/* ── Public ── */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ── User (protected) ── */}
        <Route path="/select-character" element={<ProtectedRoute><CharacterSelection /></ProtectedRoute>} />
        <Route path="/chat/:charId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
        <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
        <Route path="/human-chat/:targetId" element={<ProtectedRoute><HumanChat /></ProtectedRoute>} />
        <Route path="/social/chat/:targetId" element={<ProtectedRoute><HumanChat /></ProtectedRoute>} />

        {/* ── Admin ── */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="characters" element={<Characters />} />
          <Route path="plans" element={<Plans />} />
          <Route path="payments" element={<Payments />} />
        </Route>

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;