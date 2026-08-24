import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Phone, PhoneOff, Video, Sparkles } from 'lucide-react';
import { ringtone } from '../utils/ringtone';
import { setupMessageListener } from '../firebase';
import { showSystemNotification } from '../utils/systemNotify';
import API, { getMediaUrl } from '../api/api';

const CALL_ACTIONS = [
  { action: 'answer', title: '📞 Answer' },
  { action: 'decline', title: '❌ Decline' },
];

export default function GlobalCallManager() {
  const [incomingCall, setIncomingCall] = useState(null);
  const [callerUser, setCallerUser] = useState(null);
  const ws = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  // Effects below only depend on [token, isAuthPage] and don't re-subscribe on route change,
  // so they'd otherwise see a stale `location` from mount time. Keep a ref that's always current.
  const pathRef = useRef(location.pathname);
  useEffect(() => { pathRef.current = location.pathname; }, [location.pathname]);

  const token = localStorage.getItem('token');
  const isAuthPage = location.pathname.includes('/login') || location.pathname.includes('/register');

  // ── 1. Persistent Global WebSocket for Calls & Notifications ──────────────
  useEffect(() => {
    if (!token || isAuthPage) {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      return;
    }

    let socket;
    let reconnectTimer;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/ws/chat/${token}`;

        socket = new WebSocket(wsUrl);
        ws.current = socket;

        socket.onopen = () => {
          console.log('🟢 [GlobalCallManager] WebSocket connected');
        };

        socket.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'call_request') {
              const callerId = data.sender_id;
              const isVideo = Boolean(data.video);

              // If already on the chat screen with this caller, let HumanChat handle UI
              const isCurrentChat = pathRef.current.includes(callerId);

              // Fetch caller info
              let name = data.caller_name || 'Someone';
              let avatar = null;
              try {
                const res = await API.get(`/api/social/user/${callerId}`);
                if (res.data) {
                  name = res.data.name || res.data.username || name;
                  avatar = res.data.avatar_url;
                  setCallerUser(res.data);
                }
              } catch (e) {
                console.warn('Could not fetch caller details', e);
              }

              setIncomingCall({
                callerId,
                callerName: name,
                callerAvatar: avatar,
                isVideo,
                isCurrentChat,
              });

              ringtone.start();
              showSystemNotification(
                `Incoming ${isVideo ? 'Video' : 'Voice'} Call`,
                `${name} is calling you...`,
                {
                  tag: `incoming_call_${callerId}`,
                  renotify: true,
                  requireInteraction: true,
                  vibrate: [500, 250, 500, 250, 500, 250, 500, 250, 500, 250, 1000],
                  actions: CALL_ACTIONS,
                  data: { type: 'call', caller_id: callerId, caller_name: name, video: String(isVideo) },
                }
              );
            } else if (data.type === 'call_end' || data.type === 'call_reject' || data.type === 'call_cancel' || data.type === 'missed_call') {
              ringtone.stop();
              setIncomingCall(null);
              setCallerUser(null);
            }
          } catch (err) {
            console.error('[GlobalCallManager] Message parse error:', err);
          }
        };

        socket.onclose = () => {
          console.log('🔴 [GlobalCallManager] WebSocket closed. Reconnecting...');
          reconnectTimer = setTimeout(connectWebSocket, 4000);
        };

        socket.onerror = (e) => {
          console.warn('[GlobalCallManager] WebSocket error:', e);
        };
      } catch (err) {
        console.error('[GlobalCallManager] Connect failed:', err);
        reconnectTimer = setTimeout(connectWebSocket, 4000);
      }
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      ringtone.stop();
    };
  }, [token, isAuthPage]);

  // ── 2. Firebase Foreground Message Listener ────────────────────────────────
  useEffect(() => {
    if (!token || isAuthPage) return;

    const unsubscribe = setupMessageListener(async (payload) => {
      const data = payload.data || {};
      if (data.type === 'call') {
        const callerId = data.caller_id;
        const isVideo = data.video === 'True' || data.video === 'true';

        let name = data.caller_name || 'Someone';
        let avatar = null;
        try {
          const res = await API.get(`/api/social/user/${callerId}`);
          if (res.data) {
            name = res.data.name || res.data.username || name;
            avatar = res.data.avatar_url;
            setCallerUser(res.data);
          }
        } catch (e) {}

        setIncomingCall({
          callerId,
          callerName: name,
          callerAvatar: avatar,
          isVideo,
        });
        ringtone.start();
        showSystemNotification(
          `Incoming ${isVideo ? 'Video' : 'Voice'} Call`,
          `${name} is calling you...`,
          {
            tag: `incoming_call_${callerId}`,
            renotify: true,
            requireInteraction: true,
            vibrate: [500, 250, 500, 250, 500, 250, 500, 250, 500, 250, 1000],
            actions: CALL_ACTIONS,
            data: { type: 'call', caller_id: callerId, caller_name: name, video: String(isVideo) },
          }
        );
      } else if (data.type === 'missed_call') {
        ringtone.stop();
        setIncomingCall(null);
      } else if (data.type === 'chat') {
        // Foreground chat message push. Only surface it as a system-tray notification when
        // the user isn't already looking at that exact conversation.
        const senderId = data.sender_id;
        const isCurrentChat = senderId && pathRef.current.includes(senderId);
        if (!isCurrentChat) {
          showSystemNotification(
            data.sender_name || payload.notification?.title || 'New message',
            payload.notification?.body || data.body || 'You have a new message',
            {
              tag: `chat_${senderId}`,
              renotify: true,
              vibrate: [200, 100, 200],
              data: { type: 'chat', sender_id: senderId },
            }
          );
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [token, isAuthPage]);

  // ── 3. Service Worker Broadcast Message Listener ───────────────────────────
  useEffect(() => {
    const onSwMessage = async (event) => {
      if (event.data?.type === 'INCOMING_CALL') {
        const data = event.data?.payload?.data || {};
        const callerId = data.caller_id;
        const isVideo = data.video === 'True' || data.video === 'true';

        let name = data.caller_name || 'Someone';
        let avatar = null;
        try {
          const res = await API.get(`/api/social/user/${callerId}`);
          if (res.data) {
            name = res.data.name || res.data.username || name;
            avatar = res.data.avatar_url;
            setCallerUser(res.data);
          }
        } catch (e) {}

        setIncomingCall({
          callerId,
          callerName: name,
          callerAvatar: avatar,
          isVideo,
        });
        ringtone.start();
      } else if (event.data?.type === 'MISSED_CALL') {
        ringtone.stop();
        setIncomingCall(null);
      } else if (event.data?.type === 'CALL_DECLINE_FROM_NOTIFICATION') {
        // User tapped "Decline" on the system notification while a tab was open - reject
        // over the live socket (fast path); the SW also hits the REST fallback regardless,
        // in case this is the only open tab and it closes before the send completes.
        const callerId = event.data?.payload?.caller_id;
        ringtone.stop();
        if (callerId && ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'call_reject', target_id: callerId }));
        }
        setIncomingCall(null);
        setCallerUser(null);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
      return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
    }
  }, []);

  // ── Call Actions ────────────────────────────────────────────────────────────
  const handleAnswer = () => {
    ringtone.stop();
    if (incomingCall) {
      const callerId = incomingCall.callerId;
      setIncomingCall(null);
      navigate(`/human-chat/${callerId}?auto_accept=true`);
    }
  };

  const handleDecline = () => {
    ringtone.stop();
    if (incomingCall && ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'call_reject',
        target_id: incomingCall.callerId,
      }));
    }
    setIncomingCall(null);
    setCallerUser(null);
  };

  // If user is already on the chat screen with this caller, let HumanChat handle the in-chat overlay
  if (!incomingCall || (incomingCall.isCurrentChat && location.pathname.includes(incomingCall.callerId))) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(10, 10, 15, 0.92)',
      backdropFilter: 'blur(12px)',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: 24,
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 168, 132, 0.6); }
          50% { box-shadow: 0 0 0 24px rgba(0, 168, 132, 0); }
        }
        @keyframes bounceGlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      {/* Caller Avatar with Pulse */}
      <div style={{
        position: 'relative',
        marginBottom: 28,
        animation: 'bounceGlow 2s infinite ease-in-out',
      }}>
        <div style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #e91e8c, #9c27b0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
          fontWeight: 700,
          color: '#fff',
          border: '4px solid #00a884',
          animation: 'pulseGlow 2s infinite',
        }}>
          {incomingCall.callerAvatar ? (
            <img src={getMediaUrl(incomingCall.callerAvatar)} alt="Caller" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            (incomingCall.callerName || 'U').charAt(0).toUpperCase()
          )}
        </div>
      </div>

      {/* Caller Details */}
      <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px 0', textAlign: 'center', letterSpacing: '-0.5px' }}>
        {incomingCall.callerName}
      </h2>
      <p style={{
        fontSize: 15,
        color: '#00a884',
        margin: '0 0 36px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontWeight: 500,
      }}>
        {incomingCall.isVideo ? <Video size={18} /> : <Phone size={18} />}
        Incoming {incomingCall.isVideo ? 'Video' : 'Voice'} Call...
      </p>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
        {/* Decline Button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleDecline}
            style={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: '#ef4444',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
              transition: 'transform 0.15s, background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <PhoneOff size={32} />
          </button>
          <span style={{ fontSize: 13, color: '#f87171', fontWeight: 500 }}>Decline</span>
        </div>

        {/* Answer Button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleAnswer}
            style={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: '#22c55e',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4)',
              transition: 'transform 0.15s, background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Phone size={32} />
          </button>
          <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 500 }}>Answer</span>
        </div>
      </div>
    </div>
  );
}
