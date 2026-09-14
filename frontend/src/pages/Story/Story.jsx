import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../api/api';

// "Our Story" — a relationship timeline built entirely from data the app
// already had (chat timestamps, remembered facts). See the backend comment
// at app/api/routes/chat.py:get_relationship_story for the product intent.
export default function Story() {
  const { charId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    API.get(`/api/chat/story/${charId}`)
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch(() => { if (!cancelled) setError('Could not load your story right now.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [charId]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f0f0f0', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: '#12121a', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 5 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20 }}>←</button>
        <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Our Story</h1>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 60px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>Loading your story...</div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>{error}</div>
        )}

        {data && !data.started && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
            <p>You and {data.character_name} haven't started talking yet.</p>
            <p style={{ fontSize: 13, color: '#555' }}>Send your first message to begin your story.</p>
          </div>
        )}

        {data && data.started && <StoryContent data={data} />}
      </div>
    </div>
  );
}

function StoryContent({ data }) {
  const { stage } = data;
  return (
    <>
      {/* ── Hero: relationship stage + progress ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(233,30,140,0.15), rgba(156,39,176,0.1))',
        border: '1px solid rgba(233,30,140,0.25)', borderRadius: 20, padding: 28, textAlign: 'center', marginBottom: 20,
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{stage.icon}</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{stage.label}</div>
        <div style={{ color: '#999', fontSize: 14, marginBottom: 16 }}>
          Day {data.days_together} with {data.character_name}
        </div>
        {stage.next_label && (
          <>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${stage.progress * 100}%`, height: '100%', background: 'linear-gradient(90deg,#e91e8c,#9c27b0)', transition: 'width 0.6s' }} />
            </div>
            <div style={{ fontSize: 12, color: '#777' }}>
              {stage.days_to_next} day{stage.days_to_next === 1 ? '' : 's'} until "{stage.next_label}"
            </div>
          </>
        )}
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
        <StatCard value={data.total_messages.toLocaleString()} label="Messages" />
        <StatCard value={data.photos_shared.toLocaleString()} label="Photos" />
        <StatCard value={data.active_days.toLocaleString()} label="Days Active" />
      </div>

      {/* ── Milestone timeline ── */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#aaa', marginBottom: 14, letterSpacing: 0.3 }}>MILESTONES</h2>
      <div style={{ position: 'relative', paddingLeft: 28, marginBottom: 32 }}>
        <div style={{ position: 'absolute', left: 11, top: 6, bottom: 6, width: 2, background: 'rgba(233,30,140,0.2)' }} />
        {data.milestones.map((m, i) => (
          <div key={i} style={{ position: 'relative', marginBottom: 20 }}>
            <div style={{
              position: 'absolute', left: -28, top: 0, width: 24, height: 24, borderRadius: '50%',
              background: '#1a1a26', border: '2px solid #e91e8c', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 12,
            }}>
              {m.icon}
            </div>
            <div style={{ paddingTop: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{m.title}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                {new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Things she remembers about you ── */}
      {data.memories.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#aaa', marginBottom: 14, letterSpacing: 0.3 }}>
            WHAT {data.character_name.toUpperCase()} REMEMBERS ABOUT YOU
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.memories.map((mem, i) => (
              <div key={i} style={{
                background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                padding: '10px 14px', fontSize: 13,
              }}>
                <span style={{ color: '#777', textTransform: 'capitalize' }}>{mem.key.replace(/_/g, ' ')}: </span>
                <span style={{ color: '#f0f0f0', fontWeight: 500 }}>{mem.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function StatCard({ value, label }) {
  return (
    <div style={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '16px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#e91e8c' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>{label}</div>
    </div>
  );
}
