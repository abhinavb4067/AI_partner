import React, { useEffect, useState, useRef } from 'react';
import { adminAPI } from '../../api/api';

const BODY_SHAPES = ['Slim', 'Athletic', 'Curvy', 'Plus Size'];
const SKIN_COLORS = ['Fair', 'Light', 'Medium', 'Olive', 'Tan', 'Brown', 'Dark'];

const DEFAULT_FORM = {
  name: '', slug: '', gender: 'female', age_display: '', skin_color: '', body_shape: '',
  hair_color: '', eye_color: '', personality_prompt: '', identity_dna: '', body_dna: '', about: 'Available',
  ollama_model: 'dolphin-llama3:8b', plan_id: '', voice_enabled: false,
  elevenlabs_voice_id: '', is_active: true,
};

export default function AdminCharacters() {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [plans, setPlans] = useState([]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        adminAPI.get('/api/admin/characters'),
        adminAPI.get('/api/admin/plans'),
      ]);
      setCharacters(cRes.data);
      setPlans(pRes.data);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => { setEditing(null); setShowModal(true); };
  const openEdit = (char) => { setEditing(char); setShowModal(true); };

  const toggleActive = async (char) => {
    const fd = new FormData();
    fd.append('is_active', !char.is_active);
    await adminAPI.put(`/api/admin/characters/${char.id}`, fd);
    fetchAll();
  };

  return (
    <div style={{ color: '#f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Characters</h1>
          <p style={{ color: '#666', fontSize: 14 }}>{characters.length} AI companions</p>
        </div>
        <button onClick={openCreate} style={{
          padding: '11px 22px', background: 'linear-gradient(135deg,#e91e8c,#9c27b0)',
          border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14,
        }}>+ Add Character</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {characters.map(char => (
            <CharacterCard key={char.id} char={char} onEdit={openEdit} onToggle={() => toggleActive(char)} />
          ))}
        </div>
      )}

      {showModal && (
        <CharacterModal char={editing} plans={plans} onClose={() => setShowModal(false)} onSave={fetchAll} />
      )}
    </div>
  );
}

function CharacterCard({ char, onEdit, onToggle }) {
  return (
    <div style={{ background: '#12121a', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden', opacity: char.is_active ? 1 : 0.5 }}>
      {/* Photo */}
      <div style={{ height: 180, background: 'linear-gradient(135deg,#1a0d2e,#0d1a2e)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {char.photo_url ? (
          <img src={`${import.meta.env.VITE_API_URL}${char.photo_url}`} alt={char.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ fontSize: 64 }}>💃</div>
        )}
        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
          {char.voice_enabled && (
            <span style={{ background: 'rgba(76,175,80,0.9)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#fff' }}>
              🎤 Voice
            </span>
          )}
          {!char.is_active && (
            <span style={{ background: 'rgba(233,30,140,0.9)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#fff' }}>
              Inactive
            </span>
          )}
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{char.name}</h3>
            <p style={{ color: '#666', fontSize: 12, margin: '2px 0 0' }}>
              {char.gender} · {char.body_shape || 'N/A'} · {char.skin_color || 'N/A'}
            </p>
          </div>
          <span style={{ fontSize: 11, color: '#666' }}>#{char.id}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => onEdit(char)} style={{ flex: 1, padding: '8px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#ccc', cursor: 'pointer', fontSize: 12 }}>
            ✏️ Edit
          </button>
          <button onClick={onToggle} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none',
            background: char.is_active ? 'rgba(233,30,140,0.15)' : 'rgba(76,175,80,0.15)',
            color: char.is_active ? '#e91e8c' : '#4caf50', cursor: 'pointer', fontSize: 12 }}>
            {char.is_active ? '🚫 Disable' : '✅ Enable'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CharacterModal({ char, plans, onClose, onSave }) {
  const [form, setForm] = useState(char ? {
    name: char.name, slug: char.slug, gender: char.gender, age_display: char.age_display || '',
    skin_color: char.skin_color || '', body_shape: char.body_shape || '',
    hair_color: char.hair_color || '', eye_color: char.eye_color || '', about: char.about || 'Available',
    personality_prompt: char.personality_prompt || '', identity_dna: char.identity_dna || '',
    body_dna: char.body_dna || '', ollama_model: char.ollama_model || 'dolphin-llama3:8b',
    plan_id: char.plan_id || '', voice_enabled: char.voice_enabled || false,
    elevenlabs_voice_id: char.elevenlabs_voice_id || '', is_active: char.is_active ?? true,
  } : { ...DEFAULT_FORM });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(char?.photo_url ? `${import.meta.env.VITE_API_URL}${char.photo_url}` : null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) fd.append(k, v); });
      if (photo) fd.append('photo', photo);
      if (char) {
        await adminAPI.put(`/api/admin/characters/${char.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await adminAPI.post('/api/admin/characters', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      onSave();
      onClose();
    } catch (e) {
      alert(e.response?.data?.detail || 'Save failed');
    }
    setSaving(false);
  };

  const inputStyle = { width: '100%', padding: '10px 12px', background: '#1a1a26',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0f0f0',
    fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { color: '#888', fontSize: 12, display: 'block', marginBottom: 6, fontWeight: 500 };
  const TAB_STYLE = (active) => ({
    padding: '8px 16px', background: active ? 'rgba(233,30,140,0.15)' : 'none',
    border: active ? '1px solid rgba(233,30,140,0.3)' : '1px solid transparent',
    color: active ? '#e91e8c' : '#666', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#12121a', borderRadius: 20, width: '100%', maxWidth: 600,
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        border: '1px solid rgba(255,255,255,0.08)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f0', margin: 0 }}>
            {char ? 'Edit Character' : 'Add New Character'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {['basic', 'appearance', 'ai', 'voice', 'posts'].map(tab => (
            <button key={tab} style={TAB_STYLE(activeTab === tab)} onClick={() => setActiveTab(tab)}>
              {tab === 'basic' ? '📝 Basic' : tab === 'appearance' ? '💄 Appearance' : tab === 'ai' ? '🤖 AI/Prompt' : tab === 'voice' ? '🎤 Voice' : '📸 Media & Posts'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>

          {activeTab === 'basic' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Photo upload */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 100, height: 120, borderRadius: 12, background: '#1a1a26',
                  border: '2px dashed rgba(233,30,140,0.3)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => fileRef.current?.click()}>
                  {preview ? <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="preview" />
                    : <span style={{ fontSize: 32 }}>📷</span>}
                </div>
                <div>
                  <p style={{ color: '#ccc', fontSize: 13, marginBottom: 8 }}>Character Photo</p>
                  <button onClick={() => fileRef.current?.click()} style={{ padding: '8px 16px', borderRadius: 8,
                    border: '1px solid rgba(233,30,140,0.3)', background: 'rgba(233,30,140,0.1)',
                    color: '#e91e8c', cursor: 'pointer', fontSize: 13 }}>Upload Photo</button>
                  <p style={{ color: '#555', fontSize: 11, marginTop: 6 }}>JPG/PNG/WebP · Max 5MB</p>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
                </div>
              </div>
              <div><label style={labelStyle}>Name *</label><input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Maya" /></div>
              <div><label style={labelStyle}>Slug *</label><input style={inputStyle} value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="maya" /></div>
              <div><label style={labelStyle}>Gender</label>
                <select style={inputStyle} value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                </select>
              </div>
              <div><label style={labelStyle}>Age (Display)</label><input style={inputStyle} type="number" value={form.age_display} onChange={e => set('age_display', e.target.value)} placeholder="25" /></div>
              <div><label style={labelStyle}>About</label><input style={inputStyle} value={form.about} onChange={e => set('about', e.target.value)} placeholder="Available" /></div>
              <div><label style={labelStyle}>Plan Required</label>
                <select style={inputStyle} value={form.plan_id} onChange={e => set('plan_id', e.target.value)}>
                  <option value="">Free (All users)</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.display_name || p.plan_name}</option>)}
                </select>
              </div>
            </div>
          )}

          {activeTab === 'posts' && (
            <div>
              {!char ? (
                <div style={{ color: '#888', textAlign: 'center', padding: 30 }}>
                  Save the character first to add media and posts.
                </div>
              ) : (
                <CharacterPostsTab charId={char.id} />
              )}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div><label style={labelStyle}>Skin Color</label>
                <select style={inputStyle} value={form.skin_color} onChange={e => set('skin_color', e.target.value)}>
                  <option value="">Select...</option>
                  {SKIN_COLORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Body Shape</label>
                <select style={inputStyle} value={form.body_shape} onChange={e => set('body_shape', e.target.value)}>
                  <option value="">Select...</option>
                  {BODY_SHAPES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Hair Color</label><input style={inputStyle} value={form.hair_color} onChange={e => set('hair_color', e.target.value)} placeholder="e.g. Black, Blonde, Red" /></div>
              <div><label style={labelStyle}>Eye Color</label><input style={inputStyle} value={form.eye_color} onChange={e => set('eye_color', e.target.value)} placeholder="e.g. Brown, Blue, Green" /></div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={labelStyle}>Personality Prompt</label>
                <textarea style={{ ...inputStyle, height: 100, resize: 'vertical' }} value={form.personality_prompt}
                  onChange={e => set('personality_prompt', e.target.value)} placeholder="You are Maya, a warm and playful companion..." />
              </div>
              <div><label style={labelStyle}>Identity DNA</label>
                <textarea style={{ ...inputStyle, height: 80, resize: 'vertical' }} value={form.identity_dna}
                  onChange={e => set('identity_dna', e.target.value)} placeholder="Physical description for image generation..." />
              </div>
              <div><label style={labelStyle}>Body DNA</label>
                <textarea style={{ ...inputStyle, height: 80, resize: 'vertical' }} value={form.body_dna}
                  onChange={e => set('body_dna', e.target.value)} placeholder="Detailed body description..." />
              </div>
              <div><label style={labelStyle}>Ollama Model</label>
                <input style={inputStyle} value={form.ollama_model} onChange={e => set('ollama_model', e.target.value)} placeholder="dolphin-llama3:8b" />
              </div>
            </div>
          )}

          {activeTab === 'voice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'rgba(233,30,140,0.06)', border: '1px solid rgba(233,30,140,0.15)',
                borderRadius: 12, padding: 16 }}>
                <p style={{ color: '#ccc', fontSize: 13, marginBottom: 4 }}>🎤 ElevenLabs Voice Integration</p>
                <p style={{ color: '#666', fontSize: 12 }}>
                  Enable this to allow voice message playback using ElevenLabs TTS.
                  Each TTS request costs the user 2 credits. The API key is configured globally in the .env file.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => set('voice_enabled', !form.voice_enabled)} style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative',
                  background: form.voice_enabled ? '#e91e8c' : '#2a2a3a', transition: 'background 0.2s',
                }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute',
                    top: 3, left: form.voice_enabled ? 25 : 3, transition: 'left 0.2s' }} />
                </button>
                <span style={{ color: form.voice_enabled ? '#e91e8c' : '#666', fontSize: 14, fontWeight: 500 }}>
                  {form.voice_enabled ? 'Voice Enabled ✓' : 'Voice Disabled'}
                </span>
              </div>
              {form.voice_enabled && (
                <div>
                  <label style={labelStyle}>ElevenLabs Voice ID *</label>
                  <input style={inputStyle} value={form.elevenlabs_voice_id}
                    onChange={e => set('elevenlabs_voice_id', e.target.value)}
                    placeholder="e.g. 21m00Tcm4TlvDq8ikWAM" />
                  <p style={{ color: '#555', fontSize: 11, marginTop: 6 }}>
                    Find voice IDs at{' '}
                    <a href="https://elevenlabs.io/voice-library" target="_blank" rel="noopener noreferrer"
                      style={{ color: '#e91e8c' }}>elevenlabs.io/voice-library</a>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
            background: 'none', color: '#888', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#e91e8c,#9c27b0)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            {saving ? 'Saving...' : char ? 'Save Changes' : 'Create Character'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CharacterPostsTab({ charId }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(true);
  const fileRef = useRef();

  const fetchPosts = () => {
    adminAPI.get(`/api/admin/characters/${charId}/posts`).then(r => {
      setPosts(r.data);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchPosts();
  }, [charId]);

  const handleUpload = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    fd.append("is_premium", isPremium);
    try {
      await adminAPI.post(`/api/admin/characters/${charId}/posts`, fd, { headers: { 'Content-Type': 'multipart/form-data' }});
      fetchPosts();
    } catch(err) {
      alert("Failed to upload: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (postId) => {
    if(!window.confirm("Delete this post?")) return;
    try {
      await adminAPI.delete(`/api/admin/characters/posts/${postId}`);
      fetchPosts();
    } catch(err) {
      alert("Failed to delete post");
    }
  }

  if (loading) return <div style={{ color: '#888' }}>Loading posts...</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, background: '#1a1a26', padding: 15, borderRadius: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={isPremium} onChange={e => setIsPremium(e.target.checked)} />
            Premium Content (Requires Subscription)
          </label>
        </div>
        <button onClick={() => fileRef.current?.click()} style={{ padding: '8px 16px', borderRadius: 8, background: '#00a884', color: '#111', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
          Upload Media
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleUpload} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
        {posts.map(p => (
          <div key={p.id} style={{ position: 'relative', height: 120, borderRadius: 8, overflow: 'hidden', border: p.is_premium ? '2px solid #e91e8c' : '2px solid transparent' }}>
            {p.media_type === 'video' ? (
              <video src={`${import.meta.env.VITE_API_URL}${p.media_url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img src={`${import.meta.env.VITE_API_URL}${p.media_url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            )}
            {p.is_premium && <div style={{ position: 'absolute', top: 4, left: 4, background: '#e91e8c', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 'bold' }}>PREMIUM</div>}
            {p.media_type === 'video' && <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>VIDEO</div>}
            <button onClick={() => handleDelete(p.id)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        ))}
        {posts.length === 0 && <div style={{ color: '#555', gridColumn: '1 / -1', padding: 20, textAlign: 'center' }}>No media uploaded yet.</div>}
      </div>
    </div>
  );
}
