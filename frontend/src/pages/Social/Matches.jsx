import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/api';

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/api/social/matches')
      .then(res => setMatches(res.data))
      .catch(err => {
        if(err.response?.status === 401) navigate('/login');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) return <div style={styles.center}>Loading matches...</div>;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate('/discover')} style={styles.backBtn}>← Discover</button>
        <h1 style={styles.title}>Your Matches</h1>
        <div style={{width: 60}}></div>
      </div>

      <div style={styles.list}>
        {matches.length === 0 ? (
          <div style={styles.center}>
            <p style={{color: '#888'}}>You don't have any matches yet.</p>
            <button onClick={() => navigate('/discover')} style={styles.primaryBtn}>
              Start Swiping!
            </button>
          </div>
        ) : (
          matches.map(m => (
            <div key={m.match_id} style={styles.matchCard} onClick={() => navigate(`/human-chat/${m.user_id}`)}>
              <div style={{...styles.avatar, backgroundImage: m.avatar_url ? `url(${import.meta.env.VITE_API_URL}${m.avatar_url})` : 'none', backgroundColor: '#333'}}>
                {!m.avatar_url && '👤'}
              </div>
              <div style={styles.info}>
                <h3 style={{margin: '0 0 4px', fontSize: 18}}>{m.name || m.username}</h3>
                <p style={{margin: 0, color: '#aaa', fontSize: 14}}>@{m.username}</p>
              </div>
              <div style={{color: '#e91e8c', fontSize: 24}}>💬</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'Inter, sans-serif' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' },
  header: { display: 'flex', justifyContent: 'space-between', padding: '20px 30px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  backBtn: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 },
  title: { fontSize: 20, margin: 0, fontWeight: 'bold' },
  list: { padding: '20px 30px', maxWidth: 600, margin: '0 auto' },
  matchCard: { display: 'flex', alignItems: 'center', background: '#12121a', padding: 15, borderRadius: 15, marginBottom: 15, border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.2s' },
  avatar: { width: 60, height: 60, borderRadius: '50%', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginRight: 15 },
  info: { flex: 1 },
  primaryBtn: { marginTop: 20, padding: '12px 24px', background: 'linear-gradient(135deg, #e91e8c, #9c27b0)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 'bold', cursor: 'pointer' }
};
