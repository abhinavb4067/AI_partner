import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, Video, Image as ImageIcon, Send, X, Mic, MicOff, VideoOff, PhoneOff, Check, CheckCheck } from 'lucide-react';
import API, { getMediaUrl } from '../../api/api';

export default function HumanChat() {
  const { targetId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [targetUser, setTargetUser] = useState(null);
  const [isDpOpen, setIsDpOpen] = useState(false);

  // WebSocket
  const ws = useRef(null);

  // WebRTC
  const [callState, setCallState] = useState('idle'); // idle, ringing, incoming, active
  const [hasVideo, setHasVideo] = useState(false);
  const hasVideoRef = useRef(false);
  const pc = useRef(null);
  const localStream = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const iceCandidateQueue = useRef([]);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useEffect(() => {
    // 1. Fetch Target User Info
    const fetchUser = () => {
      API.get(`/api/social/user/${targetId}`)
        .then(res => setTargetUser(res.data))
        .catch(() => {});
    };
    
    fetchUser();
    
    // Live polling for online/offline status
    const statusInterval = setInterval(fetchUser, 10000);

    // 2. Fetch History
    API.get(`/api/ws/chat/history/${targetId}`)
      .then(res => setMessages(res.data))
      .catch(console.error);

    // 3. Connect WebSocket
    const token = localStorage.getItem('token');

    let wsUrl = '';
    if (import.meta.env.VITE_API_URL) {
      // Replace http with ws, and https with wss safely
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
        setMessages(prev => [...prev, data.message]);
        
        // If it's from the target, instantly mark it as read since we are viewing the chat
        if (data.message.sender_id === targetId) {
          ws.current.send(JSON.stringify({ type: 'read', message_id: data.message.id }));
        }
      }
      else if (data.type === 'message_viewed' || data.type === 'message_read') {
        setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, is_viewed: true, content: data.type === 'message_viewed' ? '[VIEWED]' : m.content } : m));
      }
      // WebRTC Signaling
      else if (data.type === 'call_request') {
        setHasVideo(data.video);
        hasVideoRef.current = data.video;
        setCallState('incoming');
      }
      else if (data.type === 'call_reject' || data.type === 'call_end') {
        endCall(false);
      }
      else if (data.type === 'call_accept') {
        setCallState('active');
        setTimeout(() => startWebRTC(true), 100); // Wait for DOM to render <video>
      }
      else if (data.type === 'offer') {
        setCallState('active');
        setTimeout(async () => {
          if (!pc.current) {
            await startWebRTC(false); // Initial call setup
          }
          await pc.current.setRemoteDescription(new RTCSessionDescription(data.sdp));

          // Drain queued ICE candidates
          while (iceCandidateQueue.current.length > 0) {
            const cand = iceCandidateQueue.current.shift();
            await pc.current.addIceCandidate(new RTCIceCandidate(cand));
          }

          const answer = await pc.current.createAnswer();
          await pc.current.setLocalDescription(answer);
          ws.current.send(JSON.stringify({ type: 'answer', target_id: targetId, sdp: answer }));
        }, 100);
      }
      else if (data.type === 'answer') {
        await pc.current.setRemoteDescription(new RTCSessionDescription(data.sdp));

        // Drain queued ICE candidates
        while (iceCandidateQueue.current.length > 0) {
          const cand = iceCandidateQueue.current.shift();
          await pc.current.addIceCandidate(new RTCIceCandidate(cand));
        }
      }
      else if (data.type === 'ice_candidate') {
        if (pc.current && pc.current.remoteDescription && pc.current.remoteDescription.type) {
          await pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          iceCandidateQueue.current.push(data.candidate);
        }
      }
    };

    return () => {
      if (ws.current) ws.current.close();
      endCall();
      clearInterval(statusInterval);
    };
  }, [targetId]);

  // Send read receipts for any unread messages loaded from history
  useEffect(() => {
    let changed = false;
    const updatedMessages = messages.map(m => {
      if (m.sender_id === targetId && !m.is_viewed) {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'read', message_id: m.id }));
          changed = true;
          return { ...m, is_viewed: true };
        }
      }
      return m;
    });
    
    if (changed) {
      setMessages(updatedMessages);
    }
  }, [messages, targetId]);

  // Scroll to bottom
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Chat Functions ---
  const sendMessage = () => {
    if (!input.trim() || !ws.current) return;
    ws.current.send(JSON.stringify({ type: 'text', target_id: targetId, content: input.trim() }));
    setInput('');
  };

  const sendViewOnce = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Instead of sending base64, we upload to GCS first for massive performance gains
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await API.post(`/api/social/chat-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (ws.current && res.data.url) {
        ws.current.send(JSON.stringify({ type: 'view_once', target_id: targetId, content: res.data.url }));
      }
    } catch (err) {
      console.error("Failed to upload image", err);
      alert("Failed to send image.");
    }
  };

  const markViewed = (msgId) => {
    if (ws.current) {
      ws.current.send(JSON.stringify({ type: 'viewed', message_id: msgId }));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_viewed: true, content: '[VIEWED]' } : m));
    }
  };

  // --- WebRTC Functions ---
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
    try {
      setIsMuted(false);
      setIsCameraOff(!hasVideoRef.current);
      
      localStream.current = await navigator.mediaDevices.getUserMedia({ 
        video: hasVideoRef.current ? {
           width: { ideal: 640, max: 1280 },
           height: { ideal: 480, max: 720 },
           frameRate: { ideal: 24, max: 30 }
        } : false, 
        audio: {
           echoCancellation: true,
           noiseSuppression: true,
           autoGainControl: true,
           sampleRate: { ideal: 48000 }
        } 
      });
      if (localVideoRef.current) {
         localVideoRef.current.srcObject = localStream.current;
      }

      pc.current = new RTCPeerConnection({ 
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { 
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          { 
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          { 
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ] 
      });

      localStream.current.getTracks().forEach(track => pc.current.addTrack(track, localStream.current));

      pc.current.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
        if (event.track.kind === 'video') {
          hasVideoRef.current = true;
          setHasVideo(true);
        }
      };

      pc.current.onicecandidate = (event) => {
        if (event.candidate) {
          ws.current.send(JSON.stringify({ type: 'ice_candidate', target_id: targetId, candidate: event.candidate }));
        }
      };

      if (isCaller) {
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        ws.current.send(JSON.stringify({ type: 'offer', target_id: targetId, sdp: offer }));
      }
    } catch (e) {
      console.error("WebRTC Error", e);
      alert("Failed to access camera/mic");
      endCall(true);
    }
  };

  const endCall = (sendSignal = false) => {
    if (sendSignal && ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'call_end', target_id: targetId }));
    }
    setCallState('idle');
    iceCandidateQueue.current = [];
    if (pc.current) { pc.current.close(); pc.current = null; }
    if (localStream.current) { localStream.current.getTracks().forEach(t => t.stop()); localStream.current = null; }
  };

  const toggleMute = () => {
    if (!localStream.current) return;
    const audioTrack = localStream.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = async () => {
    if (!localStream.current) return;
    const videoTrack = localStream.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = stream.getVideoTracks()[0];
        localStream.current.addTrack(newVideoTrack);
        
        if (pc.current) {
          pc.current.addTrack(newVideoTrack, localStream.current);
          const offer = await pc.current.createOffer();
          await pc.current.setLocalDescription(offer);
          if (ws.current) ws.current.send(JSON.stringify({ type: 'offer', target_id: targetId, sdp: offer }));
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
          localVideoRef.current.srcObject = localStream.current;
        }
        hasVideoRef.current = true;
        setHasVideo(true);
        setIsCameraOff(false);
      } catch (err) {
        alert("Camera permission denied or camera not available.");
      }
    }
  };

  // --- Renders ---
  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <button onClick={() => navigate('/matches')} style={styles.backBtn}>←</button>
          {targetUser?.avatar_url ? (
            <img 
              src={getMediaUrl(targetUser.avatar_url)} 
              alt="Profile" 
              onClick={() => setIsDpOpen(true)}
              style={{ width: 40, height: 40, borderRadius: '50%', marginLeft: 10, objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }} 
            />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#444', marginLeft: 10, flexShrink: 0 }} />
          )}
          <div style={{ marginLeft: 10, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <h2 style={{ margin: 0, fontSize: 16, textOverflow: 'ellipsis', overflow: 'hidden' }}>{targetUser?.name || targetUser?.username || 'Match'}</h2>
            <p style={{ margin: 0, fontSize: 12, color: targetUser?.is_online ? '#00a884' : '#8696a0', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {targetUser?.is_online 
                ? 'Online' 
                : (targetUser?.last_seen 
                    ? `Last seen at ${new Date(targetUser.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}` 
                    : 'Offline')
              }
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 15, flexShrink: 0, marginLeft: 10 }}>
          <button onClick={() => initiateCall(false)} style={styles.iconBtn}><Phone size={20} /></button>
          <button onClick={() => initiateCall(true)} style={styles.iconBtn}><Video size={20} /></button>
        </div>
      </div>

      {/* CALL UI OVERLAY */}
      {callState !== 'idle' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ flex: 1, objectFit: 'cover', display: (hasVideoRef.current && callState === 'active') ? 'block' : 'none' }} />
          <video ref={localVideoRef} autoPlay playsInline muted style={{ position: 'absolute', top: 20, right: 20, width: 120, height: 160, backgroundColor: '#222', borderRadius: 10, objectFit: 'cover', display: (hasVideoRef.current && !isCameraOff && callState === 'active') ? 'block' : 'none' }} />
          
          {callState === 'ringing' && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <p style={{ fontSize: 24, marginBottom: 10 }}>Calling {targetUser?.name || 'User'}...</p>
              <button onClick={() => endCall(true)} style={{ ...styles.iconBtn, background: '#e91e8c', borderRadius: '50%', padding: 20 }}><PhoneOff size={32} color="#fff" /></button>
            </div>
          )}
          
          {callState === 'incoming' && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <p style={{ fontSize: 24, marginBottom: 20 }}>{targetUser?.name || 'User'} is calling...</p>
              <div style={{ display: 'flex', gap: 30 }}>
                <button onClick={acceptCall} style={{ ...styles.iconBtn, background: '#4caf50', borderRadius: '50%', padding: 20 }}><Phone size={32} color="#fff" /></button>
                <button onClick={rejectCall} style={{ ...styles.iconBtn, background: '#e91e8c', borderRadius: '50%', padding: 20 }}><PhoneOff size={32} color="#fff" /></button>
              </div>
            </div>
          )}
          
          {callState === 'active' && (
            <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 20, background: 'rgba(0,0,0,0.5)', padding: '10px 20px', borderRadius: 30 }}>
              <button onClick={toggleMute} style={{ ...styles.iconBtn, color: isMuted ? '#e91e8c' : '#fff' }}>
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>
              <button onClick={toggleVideo} style={{ ...styles.iconBtn, color: isCameraOff ? '#e91e8c' : '#fff' }}>
                {isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}
              </button>
              <button onClick={() => endCall(true)} style={{ ...styles.iconBtn, background: '#e91e8c', borderRadius: '50%', padding: 10, color: '#fff' }}><PhoneOff size={24} /></button>
            </div>
          )}
        </div>
      )}

      {/* CHAT AREA */}
      <div style={styles.chatArea}>
        {messages.map((m, i) => {
          const isMine = m.sender_id !== targetId;

          return (
            <div key={i} style={{ ...styles.msgBubble, alignSelf: isMine ? 'flex-end' : 'flex-start', background: isMine ? '#005c4b' : '#202c33' }}>
              {m.message_type === 'view_once' && m.content !== '[VIEWED]' ? (
                isMine ? (
                  <p style={{ margin: 0, fontStyle: 'italic', color: '#8696a0' }}>📷 View Once Photo Sent</p>
                ) : (
                  <ViewOnceImage src={m.content} onHoldComplete={() => markViewed(m.id)} />
                )
              ) : (
                <p style={{ margin: 0 }}>{m.content}</p>
              )}
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', alignSelf: 'flex-end', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                {isMine && (
                  m.is_viewed ? <CheckCheck size={14} color="#53bdeb" /> : 
                  (m.is_delivered !== false ? <CheckCheck size={14} color="#8696a0" /> : <Check size={14} color="#8696a0" />)
                )}
              </span>
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
          placeholder="Type a message..."
          style={styles.input}
        />
        <button onClick={sendMessage} style={styles.iconBtn}><Send size={24} /></button>
      </div>

      {/* DP VIEWER MODAL */}
      {isDpOpen && targetUser?.avatar_url && (
        <div 
          onClick={() => setIsDpOpen(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img 
            src={getMediaUrl(targetUser.avatar_url)} 
            alt="DP" 
            style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: 8 }} 
            onClick={(e) => e.stopPropagation()} 
          />
          <button 
            onClick={() => setIsDpOpen(false)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            <X size={32} />
          </button>
        </div>
      )}
    </div>
  );
}

// Anti-Screenshot Component
function ViewOnceImage({ src, onHoldComplete }) {
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  return (
    <div
      onMouseDown={() => setHolding(true)}
      onMouseUp={() => { setHolding(false); onHoldComplete(); }}
      onMouseLeave={() => setHolding(false)}
      onTouchStart={() => setHolding(true)}
      onTouchEnd={() => { setHolding(false); onHoldComplete(); }}
      style={{
        width: 200, height: 250,
        background: holding ? `url(${src}) center/cover` : '#333',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 10, cursor: 'pointer',
        userSelect: 'none', WebkitUserDrag: 'none',
        filter: holding ? 'none' : 'blur(10px)',
        transition: 'filter 0.3s'
      }}
    >
      {!holding && <p style={{ filter: 'none', margin: 0, fontWeight: 'bold', textAlign: 'center' }}>Hold to View<br /><span style={{ fontSize: 10 }}>Will disappear when released</span></p>}
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0b141a', color: '#e9edef', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', padding: '15px 20px', background: '#202c33', alignItems: 'center', zIndex: 10 },
  backBtn: { background: 'none', border: 'none', color: '#8696a0', fontSize: 24, cursor: 'pointer' },
  iconBtn: { background: 'none', border: 'none', color: '#8696a0', cursor: 'pointer', padding: 10 },
  chatArea: { flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10, backgroundImage: 'url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png)', backgroundSize: 'contain' },
  msgBubble: { padding: '8px 12px', borderRadius: 12, maxWidth: '70%', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' },
  inputArea: { display: 'flex', padding: 15, background: '#202c33', alignItems: 'center', gap: 10 },
  input: { flex: 1, background: '#2a3942', border: 'none', borderRadius: 20, padding: '12px 20px', color: '#e9edef', outline: 'none' },

  // Call Styles
  callOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  callBox: { background: '#202c33', padding: 40, borderRadius: 20, textAlign: 'center' },
  callBtn: { padding: '15px 30px', border: 'none', borderRadius: 30, color: '#fff', fontSize: 16, fontWeight: 'bold', cursor: 'pointer' },
  activeCallBox: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  remoteVideo: { width: '100%', height: '100%', objectFit: 'cover' },
  localVideo: { position: 'absolute', top: 20, right: 20, width: 120, height: 160, objectFit: 'cover', borderRadius: 10, border: '2px solid #fff', zIndex: 5 },
  voiceCallAvatar: { fontSize: 24, color: '#00a884' },
  callControls: { position: 'absolute', bottom: 40, display: 'flex', gap: 25, zIndex: 10 },
  controlBtn: { width: 60, height: 60, borderRadius: 30, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(5px)', transition: 'all 0.2s ease', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }
};
