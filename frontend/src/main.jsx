import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id.apps.googleusercontent.com'

// Mobile-app checkout bridge: the Flutter app's in-app WebView (see
// mobile_app/lib/screens/pricing/payment_webview_screen.dart) opens
// /pricing?mobile_token=...&mobile_uid=... so the same logged-in user can
// complete checkout through this existing web payment flow instead of a
// native re-implementation. Must run here — before React's first render —
// not in a useEffect inside a component: several pages (Pricing.jsx) read
// localStorage synchronously during render to decide `isLoggedIn`, and a
// useEffect firing after that first render wouldn't change what they
// already rendered without an explicit reload. Doing it here means
// localStorage is correct before App() ever mounts.
function seedMobileTokenIfPresent() {
  const params = new URLSearchParams(window.location.search);
  const mobileToken = params.get('mobile_token');
  if (!mobileToken) return;
  localStorage.setItem('token', mobileToken);
  const mobileUid = params.get('mobile_uid');
  if (mobileUid) localStorage.setItem('user_id', mobileUid);
  params.delete('mobile_token');
  params.delete('mobile_uid');
  const rest = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
}
seedMobileTokenIfPresent();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
