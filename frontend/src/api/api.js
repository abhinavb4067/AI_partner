import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export const getMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${BASE_URL || 'https://avoigabackend.ectama.com'}${url}`;
};

// ── User API instance ──────────────────────────────────────────────────────
const API = axios.create({ baseURL: BASE_URL });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Broadcast channel for multi-tab auth synchronization
export const authChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('auth_sync_channel')
  : null;

export const broadcastAuthEvent = (type, data = {}) => {
  if (authChannel) {
    try {
      authChannel.postMessage({ type, ...data });
    } catch (e) {
      console.warn('BroadcastChannel error', e);
    }
  }
};

API.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginOrRegister = window.location.pathname.includes('/login') || window.location.pathname.includes('/register');
      if (!isLoginOrRegister) {
        const detail = error.response?.data?.detail || '';
        const isSessionExpired = detail.toLowerCase().includes('session') || detail.toLowerCase().includes('expired');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        broadcastAuthEvent('SESSION_TERMINATED', { reason: 'session_expired' });
        window.location.href = isSessionExpired ? '/login?session_expired=true' : '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Admin API instance ─────────────────────────────────────────────────────
export const adminAPI = axios.create({ baseURL: BASE_URL });

adminAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminAPI.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_info');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default API;