import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, MoreVertical, MessageSquarePlus, SlidersHorizontal, Sparkles, MessageCircle, Phone, CircleDashed, PhoneCall, Video } from 'lucide-react';
import API from '../api/api';
import InstallPWA from '../components/InstallPWA';

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
  const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'status', 'calls'
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentToast, setPaymentToast] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment') === 'success') {
      const plan = params.get('plan') || 'Premium';
      setPaymentToast(`🎉 Payment successful! You are now on the ${plan} plan.`);
      // Clean URL without reloading
      window.history.replaceState({}, '', '/select-character');
      setTimeout(() => setPaymentToast(null), 5000);
    }
  }, [location.search]);

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

      {/* ── Payment Success Toast ── */}
      {paymentToast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 99999, background: 'linear-gradient(135deg, #00a884, #00cf9d)',
          color: '#fff', padding: '14px 24px', borderRadius: 14,
          fontWeight: 600, fontSize: 15, boxShadow: '0 8px 32px rgba(0,168,132,0.4)',
          animation: 'slideDown 0.4s ease', whiteSpace: 'nowrap',
        }}>
          {paymentToast}
        </div>
      )}
      <style>{`@keyframes slideDown { from { opacity:0; transform: translateX(-50%) translateY(-20px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }`}</style>

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
            <button
              onClick={() => navigate('/profile')}
              title="My Profile"
              style={{
                background: 'none', border: 'none', color: '#8696a0', cursor: 'pointer',
                padding: 7, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e9edef'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#8696a0'; }}
            >
              <div style={{ fontSize: 16 }}>👤</div>
            </button>
            <button
              onClick={() => navigate('/discover')}
              title="Real Humans"
              style={{
                background: 'none', border: 'none', color: '#8696a0', cursor: 'pointer',
                padding: 7, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(233,30,140,0.15)'; e.currentTarget.style.color = '#e91e8c'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#8696a0'; }}
            >
              <div style={{ fontSize: 16 }}>❤️</div>
            </button>
          </div>
        </div>

        {/* ── Top Tabs (WhatsApp style) ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1f2c34', background: '#202c33' }}>
          {[
            { id: 'chats', label: 'Chats', icon: MessageCircle },
            { id: 'status', label: 'Status', icon: CircleDashed },
            { id: 'calls', label: 'Calls', icon: Phone },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, padding: '14px 0', border: 'none', background: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  color: isActive ? '#00a884' : '#8696a0',
                  borderBottom: isActive ? '3px solid #00a884' : '3px solid transparent',
                  transition: 'color 0.2s, border-color 0.2s',
                  position: 'relative'
                }}
              >
                <Icon size={20} />
                <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 500 }}>{tab.label}</span>
                {tab.id === 'status' && <span style={{ position: 'absolute', top: 12, right: '25%', width: 8, height: 8, borderRadius: '50%', background: '#00a884' }} />}
              </button>
            );
          })}
        </div>

        {activeTab === 'chats' && (
          <>
            {/* ── PWA Install Prompt ── */}
            <InstallPWA />

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

            {/* ── Character List (Chats Tab) ── */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#8696a0', fontSize: 14 }}>
                  <Search size={36} style={{ opacity: 0.3, marginBottom: 12, margin: '0 auto' }} />
                  No companions found.
                </div>
              ) : (
                filtered.map((char, idx) => (
                  <div
                    key={char.id}
                    onClick={() => navigate(`/chat/${char.id}`)}
                    style={{
                      display: 'flex', padding: '12px 16px', cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#202c33'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Avatar */}
                    <div 
                      onClick={(e) => { e.stopPropagation(); setSelectedAvatar(char); }}
                      style={{
                        width: 48, height: 48, borderRadius: '50%', flexShrink: 0, marginRight: 14,
                        overflow: 'hidden', background: getGradient(char.name),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
                        border: '2px solid transparent', cursor: 'zoom-in', transition: 'border-color 0.2s',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#00a884'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                    >
                      {char.photo_url ? (
                        <img src={`${import.meta.env.VITE_API_URL}${char.photo_url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={char.name} />
                      ) : (
                        char.name.charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid #1f2c34', paddingBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 400, color: '#e9edef', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {char.name}
                        </h3>
                        <span style={{ fontSize: 12, color: '#8696a0', flexShrink: 0, marginLeft: 10 }}>{formatTime()}</span>
                      </div>
                      <p style={{ fontSize: 14, color: '#8696a0', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {char.last_message_sender === 'user' && <span style={{ color: '#8696a0', marginRight: 4 }}>You:</span>}
                        {char.last_message || char.about || 'Available'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── Status Tab ── */}
        {activeTab === 'status' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
            <div style={{ display: 'flex', padding: '0 16px', alignItems: 'center', marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', background: '#202c33',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, position: 'relative'
              }}>
                <span style={{ fontSize: 20 }}>👤</span>
                <div style={{
                  position: 'absolute', bottom: 0, right: 0, background: '#00a884',
                  width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #111b21', color: '#111b21', fontSize: 14, fontWeight: 'bold'
                }}>+</div>
              </div>
              <div>
                <h3 style={{ fontSize: 16, color: '#e9edef', margin: 0 }}>My status</h3>
                <p style={{ fontSize: 14, color: '#8696a0', margin: 0 }}>Tap to add status update</p>
              </div>
            </div>

            <div style={{ padding: '8px 16px', fontSize: 14, color: '#00a884', fontWeight: 500 }}>
              Recent updates
            </div>
            
            <div style={{ padding: 40, textAlign: 'center', color: '#8696a0', fontSize: 14 }}>
              No recent updates
            </div>
          </div>
        )}

        {/* ── Calls Tab ── */}
        {activeTab === 'calls' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
            <div style={{ display: 'flex', padding: '0 16px', alignItems: 'center', marginBottom: 20, cursor: 'pointer' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', background: '#00a884',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14,
              }}>
                <span style={{ fontSize: 24, color: '#111b21', transform: 'rotate(45deg)' }}>🔗</span>
              </div>
              <div>
                <h3 style={{ fontSize: 16, color: '#e9edef', margin: 0 }}>Create call link</h3>
                <p style={{ fontSize: 14, color: '#8696a0', margin: 0 }}>Share a link for your WhatsApp call</p>
              </div>
            </div>

            <div style={{ padding: '8px 16px', fontSize: 14, color: '#8696a0', fontWeight: 500 }}>
              Recent
            </div>

            <div style={{ padding: 40, textAlign: 'center', color: '#8696a0', fontSize: 14 }}>
              No recent calls
            </div>
          </div>
        )}

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

      {/* ── Avatar Modal (WhatsApp style DP popup) ── */}
      {selectedAvatar && (
        <div 
          onClick={() => setSelectedAvatar(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              background: '#111b21', padding: '24px', borderRadius: '12px', 
              width: '90%', maxWidth: '360px', textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ width: 250, height: 250, margin: '0 auto 20px', borderRadius: '50%', overflow: 'hidden', border: '4px solid #1f2c34' }}>
              <img 
                src={selectedAvatar.photo_url ? `${import.meta.env.VITE_API_URL}${selectedAvatar.photo_url}` : `/avatars/${selectedAvatar.name}.jpg`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                alt={selectedAvatar.name}
              />
            </div>
            <h2 style={{ color: '#e9edef', fontSize: 24, margin: '0 0 8px 0', fontWeight: 600 }}>{selectedAvatar.name}</h2>
            <p style={{ color: '#8696a0', fontSize: 14, marginBottom: 24 }}>{selectedAvatar.about || "Available"}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button 
                onClick={() => navigate(`/chat/${selectedAvatar.id}`)}
                style={{
                  background: '#00a884', color: '#111b21', border: 'none', 
                  padding: '12px 24px', borderRadius: '8px', fontWeight: 700, 
                  cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#00cf9d'}
                onMouseLeave={e => e.currentTarget.style.background = '#00a884'}
              >
                <MessageSquarePlus size={18} />
                Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterSelection;