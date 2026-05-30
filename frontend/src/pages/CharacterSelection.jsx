import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MoreVertical, MessageSquarePlus, SlidersHorizontal, Sparkles } from 'lucide-react';
import API from '../api/api';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #fda085, #f6d365)',
  'linear-gradient(135deg, #89f7fe, #66a6ff)',
  'linear-gradient(135deg, #fddb92, #d1fdff)',
  'linear-gradient(135deg, #96fbc4, #f9f586)',
  'linear-gradient(135deg, #fccb90, #d57eeb)',
];

const getGradient = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

const CharacterSelection = () => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const uid = localStorage.getItem('user_id');
        const res = await API.get('/api/chat/characters', {
          params: { user_id: uid }
        });
        setCharacters(res.data);
      } catch (err) {
        console.error('Failed to fetch characters:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCharacters();
  }, []);

  const filtered = characters.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b141a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 44, height: 44, border: '3px solid #1f2c34', borderTop: '3px solid #00a884', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0b141a', color: '#e9edef', overflow: 'hidden', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ══════════════ SIDEBAR ══════════════ */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        minWidth: '280px',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #1f2c34',
        background: '#111b21',
        flexShrink: 0,
      }}>

        {/* ── Header ── */}
        <div style={{ background: '#202c33', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #00a884, #00cf9d)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#e9edef', letterSpacing: '0.2px' }}>AI Companions</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[MessageSquarePlus, MoreVertical].map((Icon, i) => (
              <button key={i} style={{
                background: 'none', border: 'none', color: '#8696a0', cursor: 'pointer',
                padding: 7, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s, color 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e9edef'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#8696a0'; }}
              >
                <Icon size={19} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Search ── */}
        <div style={{ padding: '10px 12px 6px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', background: '#202c33',
            borderRadius: 10, padding: '9px 14px', gap: 10,
          }}>
            <Search size={15} color="#8696a0" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search companions…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'none', border: 'none', outline: 'none',
                color: '#e9edef', fontSize: 14, width: '100%',
              }}
            />
            <SlidersHorizontal size={15} color="#8696a0" style={{ flexShrink: 0, cursor: 'pointer' }} />
          </div>
        </div>

        {/* ── Filter Pills ── */}
        <div style={{ display: 'flex', gap: 8, padding: '4px 12px 10px', flexWrap: 'wrap' }}>
          {['All', 'Unread', 'Favourites'].map((label) => (
            <button key={label} onClick={() => setActiveFilter(label)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: activeFilter === label ? '#005c4b' : '#1f2c34',
              color: activeFilter === label ? '#e9edef' : '#8696a0',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Contact List ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#8696a0' }}>
              <Search size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ fontSize: 14 }}>No companions found</p>
            </div>
          ) : (
            filtered.map((char) => {
              const lastTime = char.last_message_time 
                ? new Date(char.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
                : 'now';

              return (
                <button
                  key={char.id}
                  onClick={() => navigate(`/chat/${char.id}`)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    padding: '12px 16px', cursor: 'pointer', background: 'none',
                    border: 'none', color: 'inherit', textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#202c33'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                    background: '#1a2632',
                    overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}>
                    <img 
                      src={`/avatars/${char.name}.jpg`} 
                      alt={char.name} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `<div style="font-size:18px;font-weight:600;color:#fff">${char.name[0].toUpperCase()}</div>`;
                      }}
                    />
                  </div>

                  {/* Text info */}
                  <div style={{ flex: 1, minWidth: 0, marginLeft: 13, borderBottom: '1px solid #1f2c34', paddingBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 16, fontWeight: 500, color: '#e9edef' }}>
                        {char.name}
                      </span>
                      <span style={{ fontSize: 12, color: '#00a884', fontWeight: 500 }}>{lastTime}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                      <p style={{ fontSize: 13.5, color: '#8696a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, marginRight: 8 }}>
                        {char.last_message}
                      </p>
                      <div style={{
                        minWidth: 20, height: 20, borderRadius: 10, background: '#00a884',
                        color: '#0b141a', fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px'
                      }}>
                        1
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1f2c34', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#3b4a54' }}>Your conversations are private</p>
        </div>
      </div>

      {/* ══════════════ RIGHT PANEL (md+) ══════════════ */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #1a2632 0%, #0d1e27 100%)',
        borderBottom: '4px solid #00a884',
        position: 'relative', overflow: 'hidden',
      }}
        className="hidden md:flex"
      >
        {/* Background decoration */}
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,168,132,0.06) 0%, transparent 70%)',
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />

        <div style={{ textAlign: 'center', zIndex: 1, padding: '0 32px', maxWidth: 400 }}>
          {/* Animated icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: '#1a2f3a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #00a88430', boxShadow: '0 0 40px rgba(0,168,132,0.1)',
            }}>
              <div style={{ position: 'relative', width: 44, height: 44 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTopColor: '#00a884',
                  borderRightColor: '#00a88460',
                  animation: 'spin 2.5s linear infinite',
                  position: 'absolute',
                }} />
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTopColor: '#00cf9d',
                  borderLeftColor: '#00cf9d60',
                  animation: 'spin 1.5s linear infinite reverse',
                  position: 'absolute', top: 7, left: 7,
                }} />
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 300, color: '#e9edef', marginBottom: 10, letterSpacing: '-0.3px' }}>
            Select a Companion
          </h2>
          <p style={{ fontSize: 13.5, color: '#8696a0', lineHeight: 1.6, marginBottom: 28 }}>
            Choose an AI companion from the left to start your personalized conversation.
          </p>

          {/* Bouncing dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
            {[0, 150, 300].map((delay) => (
              <span key={delay} style={{
                width: 7, height: 7, borderRadius: '50%', background: '#00a884',
                display: 'inline-block', animation: `bounce 1.2s ease-in-out ${delay}ms infinite`,
              }} />
            ))}
          </div>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes bounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
            40% { transform: translateY(-10px); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default CharacterSelection;