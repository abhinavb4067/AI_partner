import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Phone, Video, Image as ImageIcon, Send, X } from 'lucide-react';
import API from '../../api/api';

export default function HumanChat() {
  const { targetId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [targetUser, setTargetUser] = useState(null);
  
  // WebSocket
  const ws = useRef(null);
  
  // WebRTC
  const [callState, setCallState] = useState('idle'); // idle, ringing, incoming, active
  const [hasVideo, setHasVideo] = useState(false);
  const pc = useRef(null);
  const localStream = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    // 1. Fetch Target User Info
    API.get(`/api/social/search/${targetId}`) // Actually we might need a direct ID fetch, but for now we rely on history or matches
      .then(res => setTargetUser(res.data))
      .catch(() => {
        // Fallback: we just fetch history and assume it's fine
      });

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
      } 
      else if (data.type === 'message_viewed') {
        setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, is_viewed: true, content: '[VIEWED]' } : m));
      }
      // WebRTC Signaling
      else if (data.type === 'call_request') {
        setHasVideo(data.video);
        setCallState('incoming');
      }
      else if (data.type === 'call_reject') {
        endCall();
        alert("Call declined");
      }
      else if (data.type === 'call_accept') {
        setCallState('active');
        await startWebRTC(true); // I am the caller, I create the offer
      }
      else if (data.type === 'offer') {
        await startWebRTC(false); // I am the callee
        await pc.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        ws.current.send(JSON.stringify({ type: 'answer', target_id: targetId, sdp: answer }));
      }
      else if (data.type === 'answer') {
        await pc.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }
      else if (data.type === 'ice_candidate') {
        if (pc.current) {
          await pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      }
    };

    return () => {
      if (ws.current) ws.current.close();
      endCall();
    };
  }, [targetId]);

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

  const sendViewOnce = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      ws.current.send(JSON.stringify({ type: 'view_once', target_id: targetId, content: ev.target.result }));
    };
    reader.readAsDataURL(file);
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
      localStream.current = await navigator.mediaDevices.getUserMedia({ video: hasVideo, audio: true });
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream.current;

      pc.current = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      
      localStream.current.getTracks().forEach(track => pc.current.addTrack(track, localStream.current));

      pc.current.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
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
      endCall();
    }
  };

  const endCall = () => {
    setCallState('idle');
    if (pc.current) { pc.current.close(); pc.current = null; }
    if (localStream.current) { localStream.current.getTracks().forEach(t => t.stop()); localStream.current = null; }
  };

  // --- Renders ---
  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={{display: 'flex', alignItems: 'center'}}>
          <button onClick={() => navigate('/matches')} style={styles.backBtn}>←</button>
          <div style={{marginLeft: 15}}>
            <h2 style={{margin: 0, fontSize: 18}}>{targetUser?.name || 'Match'}</h2>
            <p style={{margin: 0, fontSize: 12, color: '#00a884'}}>Online</p>
          </div>
        </div>
        <div style={{display: 'flex', gap: 15}}>
          <button onClick={() => initiateCall(false)} style={styles.iconBtn}><Phone size={20} /></button>
          <button onClick={() => initiateCall(true)} style={styles.iconBtn}><Video size={20} /></button>
        </div>
      </div>

      {/* CALL UI OVERLAYS */}
      {callState === 'ringing' && (
        <div style={styles.callOverlay}>
          <div style={styles.callBox}>
            <h3>Calling...</h3>
            <button onClick={endCall} style={{...styles.callBtn, background: '#f44336'}}>End</button>
          </div>
        </div>
      )}

      {callState === 'incoming' && (
        <div style={styles.callOverlay}>
          <div style={styles.callBox}>
            <h3>Incoming {hasVideo ? 'Video' : 'Voice'} Call</h3>
            <div style={{display: 'flex', gap: 20}}>
              <button onClick={acceptCall} style={{...styles.callBtn, background: '#4caf50'}}>Accept</button>
              <button onClick={rejectCall} style={{...styles.callBtn, background: '#f44336'}}>Decline</button>
            </div>
          </div>
        </div>
      )}

      {callState === 'active' && (
        <div style={styles.callOverlay}>
          <div style={styles.activeCallBox}>
            {hasVideo ? (
              <>
                <video ref={remoteVideoRef} autoPlay playsInline style={styles.remoteVideo} />
                <video ref={localVideoRef} autoPlay playsInline muted style={styles.localVideo} />
              </>
            ) : (
              <div style={styles.voiceCallAvatar}>Voice Call in Progress...</div>
            )}
            <button onClick={endCall} style={{...styles.callBtn, background: '#f44336', position: 'absolute', bottom: 30}}>Hang Up</button>
          </div>
        </div>
      )}

      {/* CHAT AREA */}
      <div style={styles.chatArea}>
        {messages.map((m, i) => {
          const isMine = m.sender_id !== targetId;
          
          return (
            <div key={i} style={{...styles.msgBubble, alignSelf: isMine ? 'flex-end' : 'flex-start', background: isMine ? '#005c4b' : '#202c33'}}>
              {m.message_type === 'view_once' && m.content !== '[VIEWED]' ? (
                isMine ? (
                  <p style={{margin: 0, fontStyle: 'italic', color: '#8696a0'}}>📷 View Once Photo Sent</p>
                ) : (
                  <ViewOnceImage src={m.content} onHoldComplete={() => markViewed(m.id)} />
                )
              ) : (
                <p style={{margin: 0}}>{m.content}</p>
              )}
              <span style={{fontSize: 10, color: 'rgba(255,255,255,0.5)', alignSelf: 'flex-end', marginTop: 4}}>
                {new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
          <input type="file" accept="image/*" style={{display: 'none'}} onChange={sendViewOnce} />
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
      {!holding && <p style={{filter: 'none', margin:0, fontWeight:'bold', textAlign:'center'}}>Hold to View<br/><span style={{fontSize: 10}}>Will disappear when released</span></p>}
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
  localVideo: { position: 'absolute', bottom: 20, right: 20, width: 120, height: 160, objectFit: 'cover', borderRadius: 10, border: '2px solid #fff' },
  voiceCallAvatar: { fontSize: 24, color: '#00a884' }
};
