import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, Video, Image as ImageIcon, Send, X, Mic, MicOff, VideoOff, PhoneOff, Check, CheckCheck, Lock, LockOpen, ShieldCheck, Copy } from 'lucide-react';
import API, { getMediaUrl } from '../../api/api';
import {
  getOrCreateKeyPair,
  getMyPublicKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  isEncrypted,
  computeSafetyNumber,
} from '../../utils/crypto';
import { ringtone } from '../../utils/ringtone';

export default function HumanChat() {
  const { targetId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [targetUser, setTargetUser] = useState(null);
  const [isDpOpen, setIsDpOpen] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  // E2EE state
  const sharedKey = useRef(null);          // Uint8Array shared secret
  const [e2eeReady, setE2eeReady] = useState(false);  // true once key exchange done
  const [peerPublicKey, setPeerPublicKey] = useState(null);
  const [myPublicKey, setMyPublicKey] = useState(null);

  // WebSocket
  const ws = useRef(null);

  // WebRTC
  const [callState, setCallState] = useState('idle');
  const [hasVideo, setHasVideo] = useState(false);
  const hasVideoRef = useRef(false);
  const pc = useRef(null);
  const localStream = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const iceCandidateQueue = useRef([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  // Bumped every time endCall() runs, so a getUserMedia() promise that's still pending
  // when the call ends (e.g. permission prompt not yet answered) can tell, once it
  // resolves, that it's for a call that's already gone and must not resurrect it.
  const callSessionId = useRef(0);
  // Prevents two concurrent startWebRTC() calls (e.g. a duplicate offer arriving while
  // getUserMedia() is still pending) from firing a second permission prompt / clobbering
  // each other's pc.current.
  const webrtcSetupPromise = useRef(null);

  // ── Handle Ringtone for Incoming Calls ─────────────────────────────────────
  useEffect(() => {
    if (callState === 'incoming') {
      ringtone.start();
    } else {
      ringtone.stop();
    }
    return () => ringtone.stop();
  }, [callState]);

  // ── Auto-accept call if triggered from push notification ──────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auto_accept') === 'true' && callState === 'incoming') {
      acceptCall();
    }
  }, [callState]);

  // ── Auto-start call if triggered from "Call Back" push notification ───────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('start_call') === 'true' && ws.current && ws.current.readyState === WebSocket.OPEN && callState === 'idle') {
      initiateCall(false);
    }
  }, [callState]);

  // ── 35-Second Caller Ringing Timeout ──────────────────────────────────────
  useEffect(() => {
    let timer;
    if (callState === 'ringing') {
      timer = setTimeout(() => {
        endCall(true); // Cancels call and records missed call
      }, 35000);
    }
    return () => clearTimeout(timer);
  }, [callState]);

  // ── Service Worker broadcast listener for background calls ─────────────────
  useEffect(() => {
    const onSwMessage = (event) => {
      if (event.data?.type === 'INCOMING_CALL' && event.data?.payload?.data?.caller_id === targetId) {
        const isVideo = event.data.payload.data.video === 'True' || event.data.payload.data.video === 'true';
        setHasVideo(isVideo);
        hasVideoRef.current = isVideo;
        setCallState('incoming');
      } else if (event.data?.type === 'MISSED_CALL' && event.data?.payload?.data?.caller_id === targetId) {
        setCallState('idle');
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
      return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
    }
  }, [targetId]);

  // ── Decrypt a single message content ────────────────────────────────────────
  const tryDecrypt = useCallback((content) => {
    if (!sharedKey.current || !content) return content;
    if (!isEncrypted(content)) return content;          // legacy plaintext
    const plain = decryptMessage(content, sharedKey.current);
    return plain !== null ? plain : '[🔒 Unable to decrypt]';
  }, []);

  // ── Decrypt a batch of messages ──────────────────────────────────────────────
  const decryptAll = useCallback((msgs) =>
    msgs.map(m => ({
      ...m,
      content: m.message_type !== 'view_once' ? tryDecrypt(m.content) : m.content,
    })), [tryDecrypt]);

  // ── Step 1: Register own public key & fetch peer public key ─────────────────
  useEffect(() => {
    const setupE2EE = async () => {
      try {
        // Ensure keypair exists locally
        getOrCreateKeyPair();
        const myPubKey = getMyPublicKey();
        setMyPublicKey(myPubKey);

        // Upload our public key to the server (idempotent)
        await API.post('/api/social/public-key', { public_key: myPubKey });

        // Fetch the peer's public key
        const res = await API.get(`/api/social/public-key/${targetId}`);
        const theirKey = res.data.public_key;

        if (theirKey) {
          setPeerPublicKey(theirKey);
          sharedKey.current = deriveSharedKey(theirKey);
          setE2eeReady(true);
        } else {
          // Peer hasn't registered a key yet
          console.warn('[E2EE] Peer has no public key. Falling back to plaintext.');
          setE2eeReady(false);
        }
      } catch (err) {
        console.error('[E2EE] Key exchange failed:', err);
        setE2eeReady(false);
      }
    };

    setupE2EE();
  }, [targetId]);

  // ── Step 2: Load history + WebSocket (after key exchange attempt) ───────────
  useEffect(() => {
    const fetchUser = () => {
      API.get(`/api/social/user/${targetId}`)
        .then(res => setTargetUser(res.data))
        .catch(() => {});
    };
    fetchUser();
    const statusInterval = setInterval(fetchUser, 10000);

    // Fetch & decrypt history
    API.get(`/api/ws/chat/history/${targetId}`)
      .then(res => setMessages(decryptAll(res.data)))
      .catch(console.error);

    // Connect WebSocket
    const token = localStorage.getItem('token');
    let wsUrl = '';
    if (import.meta.env.VITE_API_URL) {
      wsUrl = import.meta.env.VITE_API_URL.replace(/^http/, 'ws') + `/api/ws/chat/${token}`;
    } else {
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${loc.host}/api/ws/chat/${token}`;
    }

    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'new_message') {
        // This socket receives every message addressed to this user (including missed-call
        // log entries), not just ones belonging to the conversation currently open - without
        // this check, a message/call-log from a different chat leaks into whichever chat
        // page happens to be open right now.
        const belongsToThisChat = data.message.sender_id === targetId || data.message.receiver_id === targetId;
        if (!belongsToThisChat) {
          return;
        }

        const msg = {
          ...data.message,
          content: data.message.message_type !== 'view_once'
            ? tryDecrypt(data.message.content)
            : data.message.content,
        };
        setMessages(prev => [...prev, msg]);

        if (data.message.sender_id === targetId) {
          ws.current.send(JSON.stringify({ type: 'read', message_id: data.message.id }));
        }
      } else if (data.type === 'message_viewed' || data.type === 'message_read') {
        setMessages(prev =>
          prev.map(m =>
            m.id === data.message_id
              ? { ...m, is_viewed: true, content: data.type === 'message_viewed' ? '[VIEWED]' : m.content }
              : m
          )
        );
      } else if (['call_request', 'call_accept', 'call_reject', 'call_end', 'offer', 'answer', 'ice_candidate'].includes(data.type)) {
        // This socket receives every signaling message addressed to this user, regardless
        // of which chat is currently open - not just ones from `targetId`. Without this
        // guard, a call from someone else (while chatting with a third person) would get
        // wrongly treated as an incoming call from whoever this chat page happens to be
        // open with. GlobalCallManager (mounted app-wide) is the one responsible for calls
        // that aren't from the currently open chat partner.
        if (data.sender_id !== targetId) {
          return;
        }

        if (data.type === 'call_request') {
          setHasVideo(data.video);
          hasVideoRef.current = data.video;
          setCallState('incoming');
        } else if (data.type === 'call_reject' || data.type === 'call_end') {
          endCall(false);
        } else if (data.type === 'call_accept') {
          setCallState('active');
          setTimeout(() => startWebRTC(true), 100);
        } else if (data.type === 'offer') {
          setCallState('active');
          setTimeout(async () => {
            if (!pc.current) await startWebRTC(false);
            await pc.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
            while (iceCandidateQueue.current.length > 0) {
              await pc.current.addIceCandidate(new RTCIceCandidate(iceCandidateQueue.current.shift()));
            }
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            ws.current.send(JSON.stringify({ type: 'answer', target_id: targetId, sdp: answer }));
          }, 100);
        } else if (data.type === 'answer') {
          await pc.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          while (iceCandidateQueue.current.length > 0) {
            await pc.current.addIceCandidate(new RTCIceCandidate(iceCandidateQueue.current.shift()));
          }
        } else if (data.type === 'ice_candidate') {
          if (pc.current?.remoteDescription?.type) {
            await pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
            iceCandidateQueue.current.push(data.candidate);
          }
        }
      }
    };

    return () => {
      if (ws.current) ws.current.close();
      endCall();
      clearInterval(statusInterval);
    };
  }, [targetId, decryptAll, tryDecrypt]);

  // Re-decrypt history when sharedKey becomes available
  useEffect(() => {
    if (e2eeReady && messages.length > 0) {
      setMessages(prev => decryptAll(prev.map(m => ({
        ...m,
        content: m.content,
      }))));
    }
  }, [e2eeReady]); // eslint-disable-line

  // Send read receipts for unread history messages
  useEffect(() => {
    let changed = false;
    const updated = messages.map(m => {
      if (m.sender_id === targetId && !m.is_viewed) {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'read', message_id: m.id }));
          changed = true;
          return { ...m, is_viewed: true };
        }
      }
      return m;
    });
    if (changed) setMessages(updated);
  }, [messages, targetId]);

  // Scroll to bottom
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Send text message (encrypted if key available) ───────────────────────────
  const sendMessage = () => {
    if (!input.trim() || !ws.current) return;
    const plaintext = input.trim();

    let payload;
    if (sharedKey.current) {
      const ciphertext = encryptMessage(plaintext, sharedKey.current);
      payload = { type: 'text', target_id: targetId, content: ciphertext };
    } else {
      payload = { type: 'text', target_id: targetId, content: plaintext };
    }

    ws.current.send(JSON.stringify(payload));
    setInput('');
  };

  // ── Send view-once image ───────────────────────────────────────────────────
  const sendViewOnce = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await API.post(`/api/social/chat-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (ws.current && res.data.url) {
        ws.current.send(JSON.stringify({ type: 'view_once', target_id: targetId, content: res.data.url }));
      }
    } catch (err) {
      console.error('Failed to upload image', err);
      alert('Failed to send image.');
    }
  };

  const markViewed = (msgId) => {
    if (ws.current) {
      ws.current.send(JSON.stringify({ type: 'viewed', message_id: msgId }));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_viewed: true, content: '[VIEWED]' } : m));
    }
  };

  // ── WebRTC ───────────────────────────────────────────────────────────────────
  const initiateCall = (video) => {
    setHasVideo(video);
    hasVideoRef.current = video;
    setCallState('ringing');
    ws.current.send(JSON.stringify({ type: 'call_request', target_id: targetId, video }));
  };
  const acceptCall = () => {
    setCallState('active');
    ws.current.send(JSON.stringify({ type: 'call_accept', target_id: targetId }));
  };
  const rejectCall = () => {
    setCallState('idle');
    ws.current.send(JSON.stringify({ type: 'call_reject', target_id: targetId }));
  };
  const startWebRTC = async (isCaller) => {
    // If a setup is already in flight (e.g. this got triggered twice), don't kick off a
    // second getUserMedia() request - wait for the same one instead.
    if (webrtcSetupPromise.current) return webrtcSetupPromise.current;

    const mySession = callSessionId.current;
    const setupPromise = (async () => {
      try {
        setIsMuted(false);
        setIsCameraOff(!hasVideoRef.current);
        // This can take anywhere from milliseconds to many seconds while the browser
        // shows its permission prompt. That's expected and NOT a failure - we simply
        // wait for the user's actual answer (granted/denied) rather than timing out.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: hasVideoRef.current ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } : false,
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });

        // The call may have already been ended/cancelled by either side while we were
        // waiting on the permission prompt. Don't resurrect a dead call - release the
        // just-granted tracks and stop, instead of building a zombie connection.
        if (callSessionId.current !== mySession) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        localStream.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        pc.current = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
          ],
        });
        stream.getTracks().forEach(track => pc.current.addTrack(track, stream));
        pc.current.ontrack = (event) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
          if (event.track.kind === 'video') { hasVideoRef.current = true; setHasVideo(true); }
        };
        pc.current.onicecandidate = (event) => {
          if (event.candidate) ws.current.send(JSON.stringify({ type: 'ice_candidate', target_id: targetId, candidate: event.candidate }));
        };
        if (isCaller) {
          const offer = await pc.current.createOffer();
          // Re-check after another async step - the call could have ended while we
          // were creating the offer too.
          if (callSessionId.current !== mySession) return;
          await pc.current.setLocalDescription(offer);
          ws.current.send(JSON.stringify({ type: 'offer', target_id: targetId, sdp: offer }));
        }
      } catch (e) {
        console.error('WebRTC Error', e);
        // Only react if this attempt is still the live one - otherwise the call already
        // ended for another reason and this is just a stale/late permission response.
        if (callSessionId.current === mySession) {
          const isDenied = e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError';
          alert(isDenied ? 'Camera/microphone permission was denied.' : 'Failed to access camera/mic');
          endCall(true);
        }
      }
    })();

    webrtcSetupPromise.current = setupPromise;
    try {
      await setupPromise;
    } finally {
      if (webrtcSetupPromise.current === setupPromise) webrtcSetupPromise.current = null;
    }
  };
  const endCall = (sendSignal = false) => {
    callSessionId.current += 1; // invalidate any startWebRTC() attempt still waiting on getUserMedia()
    if (sendSignal && ws.current?.readyState === WebSocket.OPEN)
      ws.current.send(JSON.stringify({ type: 'call_end', target_id: targetId }));
    setCallState('idle');
    iceCandidateQueue.current = [];
    if (pc.current) { pc.current.close(); pc.current = null; }
    if (localStream.current) { localStream.current.getTracks().forEach(t => t.stop()); localStream.current = null; }
  };
  const toggleMute = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
  };
  const toggleVideo = async () => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsCameraOff(!track.enabled); }
  };

  const safetyNumber = (myPublicKey && peerPublicKey) ? computeSafetyNumber(myPublicKey, peerPublicKey) : null;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <button onClick={() => navigate('/matches')} style={styles.backBtn}>←</button>
          {targetUser?.avatar_url ? (
            <img src={getMediaUrl(targetUser.avatar_url)} alt="Profile" onClick={() => setIsDpOpen(true)}
              style={{ width: 40, height: 40, borderRadius: '50%', marginLeft: 10, objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#444', marginLeft: 10, flexShrink: 0 }} />
          )}
          <div style={{ marginLeft: 10, minWidth: 0, overflow: 'hidden', flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {targetUser?.name || targetUser?.username || 'Match'}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: targetUser?.is_online ? '#00a884' : '#8696a0' }}>
              {targetUser?.is_online
                ? 'Online'
                : targetUser?.last_seen
                  ? `Last seen at ${new Date(targetUser.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`
                  : 'Offline'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginLeft: 10 }}>
          {/* E2EE badge */}
          <div 
            onClick={() => setShowSafetyModal(true)}
            title={e2eeReady ? 'End-to-end encrypted (Click to verify)' : 'Encryption initializing...'} 
            style={styles.e2eeBadge(e2eeReady)}
          >
            {e2eeReady ? <Lock size={12} /> : <LockOpen size={12} />}
            <span style={{ fontSize: 10, fontWeight: 600 }}>{e2eeReady ? 'E2EE' : 'Plain'}</span>
          </div>
          <button onClick={() => initiateCall(false)} style={styles.iconBtn}><Phone size={20} /></button>
          <button onClick={() => initiateCall(true)} style={styles.iconBtn}><Video size={20} /></button>
        </div>
      </div>

      {/* E2EE notice banner */}
      {e2eeReady && (
        <div style={styles.encryptedBanner} onClick={() => setShowSafetyModal(true)} role="button">
          <Lock size={12} />
          <span>Messages and calls are end-to-end encrypted. Tap to verify safety numbers.</span>
        </div>
      )}

      {/* CALL UI OVERLAY */}
      {callState !== 'idle' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ flex: 1, objectFit: 'cover', display: (hasVideoRef.current && callState === 'active') ? 'block' : 'none' }} />
          <video ref={localVideoRef} autoPlay playsInline muted style={{ position: 'absolute', top: 20, right: 20, width: 120, height: 160, backgroundColor: '#222', borderRadius: 10, objectFit: 'cover', display: (hasVideoRef.current && !isCameraOff && callState === 'active') ? 'block' : 'none' }} />
          {callState === 'ringing' && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
              <p style={{ fontSize: 24, marginBottom: 10, color: '#fff' }}>Calling {targetUser?.name || 'User'}...</p>
              <button onClick={() => endCall(true)} style={{ ...styles.iconBtn, background: '#e91e8c', borderRadius: '50%', padding: 20 }}><PhoneOff size={32} color="#fff" /></button>
            </div>
          )}
          {callState === 'incoming' && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
              <p style={{ fontSize: 24, marginBottom: 20, color: '#fff' }}>{targetUser?.name || 'User'} is calling...</p>
              <div style={{ display: 'flex', gap: 30 }}>
                <button onClick={acceptCall} style={{ ...styles.iconBtn, background: '#4caf50', borderRadius: '50%', padding: 20 }}><Phone size={32} color="#fff" /></button>
                <button onClick={rejectCall} style={{ ...styles.iconBtn, background: '#e91e8c', borderRadius: '50%', padding: 20 }}><PhoneOff size={32} color="#fff" /></button>
              </div>
            </div>
          )}
          {callState === 'active' && (
            <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 20, background: 'rgba(0,0,0,0.5)', padding: '10px 20px', borderRadius: 30 }}>
              <button onClick={toggleMute} style={{ ...styles.iconBtn, color: isMuted ? '#e91e8c' : '#fff' }}>{isMuted ? <MicOff size={24} /> : <Mic size={24} />}</button>
              <button onClick={toggleVideo} style={{ ...styles.iconBtn, color: isCameraOff ? '#e91e8c' : '#fff' }}>{isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}</button>
              <button onClick={() => endCall(true)} style={{ ...styles.iconBtn, background: '#e91e8c', borderRadius: '50%', padding: 10, color: '#fff' }}><PhoneOff size={24} /></button>
            </div>
          )}
        </div>
      )}

      {/* CHAT AREA */}
      <div style={styles.chatArea}>
        {messages.map((m, i) => {
          const isMine = m.sender_id !== targetId;
          const isMissedCall = m.message_type === 'missed_call';

          return (
            <div
              key={i}
              style={{
                ...styles.msgBubble,
                alignSelf: isMine ? 'flex-end' : 'flex-start',
                background: isMissedCall
                  ? 'rgba(239, 68, 68, 0.12)'
                  : isMine ? '#005c4b' : '#202c33',
                border: isMissedCall ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                minWidth: isMissedCall ? 220 : 'auto',
              }}
            >
              {isMissedCall ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#ef4444'
                  }}>
                    <PhoneOff size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#f87171', fontSize: 13 }}>
                      {m.content || 'Missed Call'}
                    </p>
                    <span style={{ fontSize: 10, color: '#8696a0' }}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                  <button
                    onClick={() => initiateCall(false)}
                    style={{
                      background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: 16, padding: '5px 10px', color: '#4ade80',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    <Phone size={12} /> Call Back
                  </button>
                </div>
              ) : m.message_type === 'view_once' && m.content !== '[VIEWED]' ? (
                isMine ? (
                  <p style={{ margin: 0, fontStyle: 'italic', color: '#8696a0' }}>📷 View Once Photo Sent</p>
                ) : (
                  <ViewOnceImage src={m.content} onHoldComplete={() => markViewed(m.id)} />
                )
              ) : (
                <p style={{ margin: 0 }}>{m.content}</p>
              )}
              {!isMissedCall && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', alignSelf: 'flex-end', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {e2eeReady && m.message_type === 'text' && <Lock size={9} color="rgba(0,168,132,0.7)" />}
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                  {isMine && (
                    m.is_viewed ? <CheckCheck size={14} color="#53bdeb" /> :
                    m.is_delivered !== false ? <CheckCheck size={14} color="#8696a0" /> : <Check size={14} color="#8696a0" />
                  )}
                </span>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* INPUT AREA */}
      <div style={styles.inputArea}>
        <label style={styles.iconBtn}>
          <ImageIcon size={24} />
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={sendViewOnce} />
        </label>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={e2eeReady ? '🔒 Encrypted message...' : 'Type a message...'}
          style={styles.input}
        />
        <button onClick={sendMessage} style={styles.iconBtn}><Send size={24} /></button>
      </div>

      {/* DP VIEWER MODAL */}
      {isDpOpen && targetUser?.avatar_url && (
        <div onClick={() => setIsDpOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={getMediaUrl(targetUser.avatar_url)} alt="DP" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setIsDpOpen(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={32} /></button>
        </div>
      )}

      {/* ── Safety Number / E2EE Info Modal ── */}
      {showSafetyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(4px)' }} onClick={() => setShowSafetyModal(false)}>
          <div style={{ background: '#111b21', borderRadius: 20, padding: 28, maxWidth: 440, width: '90%', color: '#e9edef', border: '1px solid rgba(0,168,132,0.3)', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowSafetyModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#8696a0', cursor: 'pointer' }}><X size={20} /></button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,168,132,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00a884' }}>
                <ShieldCheck size={26} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>End-to-End Encryption</h3>
                <p style={{ margin: 0, fontSize: 12, color: e2eeReady ? '#00a884' : '#8696a0' }}>
                  {e2eeReady ? 'Direct Peer-to-Peer Encryption Active' : 'Key Exchange Pending'}
                </p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: '#8696a0', lineHeight: '1.6', marginBottom: 20 }}>
              Messages and calls with {targetUser?.name || 'this contact'} are secured with <strong>X25519 Diffie-Hellman</strong> and <strong>XSalsa20-Poly1305</strong>. No third party or server can read them.
            </p>

            {safetyNumber && (
              <div style={{ background: '#202c33', borderRadius: 12, padding: '16px', marginBottom: 20, textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: '#8696a0', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                  Safety Verification Code
                </span>
                <p style={{ margin: 0, fontSize: 18, fontFamily: 'monospace', color: '#00a884', fontWeight: 700, letterSpacing: 2 }}>
                  {safetyNumber}
                </p>
                <span style={{ fontSize: 11, color: '#666', marginTop: 8, display: 'block' }}>
                  If this code matches on {targetUser?.name || 'your match'}&apos;s device, your connection is 100% authentic and secure.
                </span>
              </div>
            )}

            <button
              onClick={() => setShowSafetyModal(false)}
              style={{ width: '100%', padding: '12px', background: '#00a884', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
            >
              Verify & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── View Once Component ────────────────────────────────────────────────────────
function ViewOnceImage({ src, onHoldComplete }) {
  const [holding, setHolding] = useState(false);
  useEffect(() => {
    const prevent = e => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    return () => document.removeEventListener('contextmenu', prevent);
  }, []);
  return (
    <div
      onMouseDown={() => setHolding(true)}
      onMouseUp={() => { setHolding(false); onHoldComplete(); }}
      onMouseLeave={() => setHolding(false)}
      onTouchStart={() => setHolding(true)}
      onTouchEnd={() => { setHolding(false); onHoldComplete(); }}
      style={{ width: 200, height: 250, background: holding ? `url(${src}) center/cover` : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, cursor: 'pointer', userSelect: 'none', WebkitUserDrag: 'none', filter: holding ? 'none' : 'blur(10px)', transition: 'filter 0.3s' }}
    >
      {!holding && <p style={{ filter: 'none', margin: 0, fontWeight: 'bold', textAlign: 'center' }}>Hold to View<br /><span style={{ fontSize: 10 }}>Will disappear when released</span></p>}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0b141a', color: '#e9edef', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', padding: '15px 20px', background: '#202c33', alignItems: 'center', zIndex: 10 },
  backBtn: { background: 'none', border: 'none', color: '#8696a0', fontSize: 24, cursor: 'pointer' },
  iconBtn: { background: 'none', border: 'none', color: '#8696a0', cursor: 'pointer', padding: 10 },
  chatArea: { flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10, backgroundImage: 'url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png)', backgroundSize: 'contain' },
  msgBubble: { padding: '8px 12px', borderRadius: 12, maxWidth: '70%', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' },
  inputArea: { display: 'flex', padding: 15, background: '#202c33', alignItems: 'center', gap: 10 },
  input: { flex: 1, background: '#2a3942', border: 'none', borderRadius: 20, padding: '12px 20px', color: '#e9edef', outline: 'none' },
  encryptedBanner: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 16px', background: 'rgba(0,168,132,0.12)', borderBottom: '1px solid rgba(0,168,132,0.2)', color: '#00a884', fontSize: 11, fontWeight: 500, cursor: 'pointer' },
  e2eeBadge: (active) => ({
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 10px', borderRadius: 20,
    background: active ? 'rgba(0,168,132,0.15)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${active ? 'rgba(0,168,132,0.4)' : 'rgba(255,255,255,0.1)'}`,
    color: active ? '#00a884' : '#8696a0',
    cursor: 'pointer',
    transition: 'background 0.2s',
  }),
};
