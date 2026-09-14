import axios from 'axios';
import { idbSetToken, idbClearToken } from '../utils/tokenStore';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export const getMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const full = `${BASE_URL || 'https://avoigabackend.ectama.com'}${url}`;
  // AI-companion chat photos (/media/<char>/<user>/<file>) are auth-gated on
  // the backend now — an <img> tag can't send an Authorization header, so the
  // token rides along as a query param instead (verified server-side).
  const segments = url.split('/').filter(Boolean);
  if (segments[0] === 'media' && segments.length === 4) {
    const token = localStorage.getItem('token');
    if (token) return `${full}?token=${encodeURIComponent(token)}`;
  }
  return full;
};

// ── User API instance ──────────────────────────────────────────────────────
const API = axios.create({ baseURL: BASE_URL });

let lastSyncedToken = null;
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // Keep the service worker's copy of the token fresh so it can act on push-notification
    // actions (e.g. declining a call) even when no app tab is open. Cheap to call repeatedly.
    if (token !== lastSyncedToken) {
      lastSyncedToken = token;
      idbSetToken(token);
    }
  }
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

// Single source of truth for clearing a logged-in session. Login.jsx sets
// 'token'/'user_id'/'user_name'/'user_info' — any logout path (manual button,
// forced 401, multi-tab sync) must clear exactly these, or the session
// silently survives. This used to be duplicated ad-hoc at each call site;
// one of those copies (Profile.jsx's "Log Out" button) cleared a
// non-existent 'user_token' key instead of 'token' by mistake, so clicking
// Log Out never actually cleared the auth token — the "logged out" user
// stayed fully authenticated for any subsequent API call/page load.
export const clearSession = () => {
  // Best-effort: tell the backend to forget this device's push token so a
  // shared/resold device (or just anyone with physical access after you
  // leave) stops receiving your notifications post-logout. Fired with the
  // token captured *before* it's removed, via a bare axios call (not the
  // shared `API` instance) so a failure here can't re-trigger the 401
  // interceptor above and loop back into clearSession() again. Never
  // awaited — logout must not be delayed by this.
  const outgoingToken = localStorage.getItem('token');
  if (outgoingToken) {
    axios.delete(`${BASE_URL}/api/profile/fcm-token`, {
      headers: { Authorization: `Bearer ${outgoingToken}` },
    }).catch(() => {});
  }

  localStorage.removeItem('token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_name');
  localStorage.removeItem('user_info');
  localStorage.removeItem('user'); // legacy key, harmless if already absent
  idbClearToken();
};

API.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginOrRegister = window.location.pathname.includes('/login') || window.location.pathname.includes('/register');
      if (!isLoginOrRegister) {
        const detail = error.response?.data?.detail || '';
        const isSessionExpired = detail.toLowerCase().includes('session') || detail.toLowerCase().includes('expired');
        clearSession();
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