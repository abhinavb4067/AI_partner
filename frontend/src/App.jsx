import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import brand from './config/brand';

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

function App() {
  return (
    <Router>
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