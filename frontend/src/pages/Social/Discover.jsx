import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/api';

export default function Discover() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchPopup, setMatchPopup] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/api/social/discover')
      .then(res => setProfiles(res.data))
      .catch(err => {
        if(err.response?.status === 401) navigate('/login');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleSwipe = async (isLike) => {
    if (profiles.length === 0) return;
    const target = profiles[0];
    
    // Optimistically remove from list
    setProfiles(prev => prev.slice(1));
    
    try {
      const res = await API.post('/api/social/swipe', {
        target_id: target.id,
        is_like: isLike
      });
      
      if (res.data.is_match) {
        setMatchPopup(target);
      }
    } catch (e) {
      console.error("Swipe failed", e);
    }
  };

  if (loading) return <div style={styles.center}>Loading new people...</div>;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate('/select-character')} style={styles.backBtn}>← Back</button>
        <h1 style={styles.title}>Discover</h1>
        <button onClick={() => navigate('/matches')} style={styles.matchesBtn}>Matches 💬</button>
      </div>

      {/* Swipe Area */}
      <div style={styles.swipeArea}>
        {profiles.length > 0 ? (
          <div style={styles.card}>
            <div style={{...styles.cardImage, backgroundImage: profiles[0].avatar_url ? `url(${import.meta.env.VITE_API_URL}${profiles[0].avatar_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#333'}}>
              {!profiles[0].avatar_url && <span style={{fontSize: 60}}>👤</span>}
            </div>
            <div style={styles.cardInfo}>
              <h2 style={{margin: 0, fontSize: 24}}>{profiles[0].name || profiles[0].username} {profiles[0].age ? `, ${profiles[0].age}` : ''}</h2>
              <p style={{margin: '4px 0 0', color: '#aaa'}}>@{profiles[0].username}</p>
            </div>
            
            <div style={styles.actionRow}>
              <button onClick={() => handleSwipe(false)} style={{...styles.actionBtn, color: '#f44336', borderColor: '#f44336'}}>
                ✕
              </button>
              <button onClick={() => handleSwipe(true)} style={{...styles.actionBtn, color: '#4caf50', borderColor: '#4caf50'}}>
                ♥
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.center}>
            <h2>No more people around you!</h2>
            <p style={{color: '#888'}}>Check back later for new profiles.</p>
          </div>
        )}
      </div>

      {/* Match Popup */}
      {matchPopup && (
        <div style={styles.overlay}>
          <div style={styles.popup}>
            <h2 style={{color: '#e91e8c', fontSize: 32, margin: '0 0 20px'}}>It's a Match! 🎉</h2>
            <p style={{marginBottom: 30}}>You and {matchPopup.name || matchPopup.username} liked each other.</p>
            <button onClick={() => navigate(`/matches`)} style={styles.primaryBtn}>
              Say Hello
            </button>
            <button onClick={() => setMatchPopup(null)} style={styles.ghostBtn}>
              Keep Swiping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'Inter, sans-serif' },
  center: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', padding: '20px 30px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  backBtn: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  title: { fontSize: 20, margin: 0, fontWeight: 'bold', color: '#e91e8c' },
  matchesBtn: { background: 'linear-gradient(135deg, #e91e8c, #9c27b0)', border: 'none', borderRadius: 20, color: '#fff', padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold' },
  swipeArea: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 80px)' },
  card: { width: 350, height: 550, background: '#12121a', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' },
  cardImage: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { padding: 20, background: 'linear-gradient(to top, #12121a 70%, transparent)' },
  actionRow: { display: 'flex', justifyContent: 'space-evenly', padding: '20px', background: '#12121a' },
  actionBtn: { width: 60, height: 60, borderRadius: '50%', background: 'transparent', border: '2px solid', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  popup: { background: '#12121a', padding: 40, borderRadius: 20, textAlign: 'center', border: '1px solid #e91e8c' },
  primaryBtn: { display: 'block', width: '100%', padding: '15px', background: 'linear-gradient(135deg, #e91e8c, #9c27b0)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 16, fontWeight: 'bold', cursor: 'pointer', marginBottom: 10 },
  ghostBtn: { display: 'block', width: '100%', padding: '15px', background: 'transparent', border: '1px solid #888', borderRadius: 10, color: '#888', fontSize: 16, cursor: 'pointer' }
};
