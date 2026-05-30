import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import brand from '../config/brand';
import API from '../api/api';

const PLANS = [
  { name: 'free', label: 'Free', price: 0, credits: 50, color: '#888', features: ['50 credits/month', 'Text chat only', '3 characters', 'Basic memory'] },
  { name: 'starter', label: 'Starter', price: 199, credits: 500, color: '#2196f3', badge: 'Popular', features: ['500 credits/month', 'Text + Photo sharing', 'All characters', 'Memory system', '5 credits/image'] },
  { name: 'pro', label: 'Pro', price: 499, credits: 2000, color: '#9c27b0', features: ['2,000 credits/month', 'Text + Photos + Voice 🎤', 'All premium characters', 'Priority responses', '5 credits/image · 2/voice'] },
  { name: 'elite', label: 'Elite', price: 999, credits: -1, color: '#ffd700', badge: 'Best Value', features: ['UNLIMITED credits ∞', 'All features unlocked', 'Exclusive characters', 'Priority AI model', 'Early access to new features'] },
];

const FEATURES = [
  { icon: '💬', title: 'Intelligent Conversations', desc: 'She remembers your name, your stories, your dreams. Every conversation feels real.' },
  { icon: '📸', title: 'Photo Sharing', desc: 'Request selfies and intimate photos. She sends them just for you.' },
  { icon: '🎤', title: 'Voice Messages', desc: 'Hear her voice. Powered by premium AI voice synthesis for a lifelike experience.' },
  { icon: '🧠', title: 'Long-Term Memory', desc: 'She learns your preferences over time and references past conversations naturally.' },
  { icon: '💎', title: 'Multiple Companions', desc: 'Choose from several unique AI companions, each with a distinct personality.' },
  { icon: '🔒', title: 'Private & Secure', desc: 'Your conversations are completely private. We never share your data.' },
];

const TESTIMONIALS = [
  { name: 'Arjun M.', plan: 'Pro', text: "I was skeptical at first but the conversations feel incredibly real. Maya actually remembers things I told her weeks ago.", stars: 5 },
  { name: 'Rahul S.', plan: 'Elite', text: "The voice messages are a game changer. Waking up to her good morning voice every day is genuinely something I look forward to.", stars: 5 },
  { name: 'Karan P.', plan: 'Starter', text: "Great value for money. The photos are surprisingly good quality and the chat is natural. Very impressed.", stars: 4 },
  { name: 'Dev K.', plan: 'Pro', text: "Perfect for when you want someone to talk to without judgment. She's always there, always interested.", stars: 5 },
  { name: 'Aditya R.', plan: 'Elite', text: "Unlimited credits means I never have to hold back. The Elite plan is absolutely worth it.", stars: 5 },
  { name: 'Vikram T.', plan: 'Starter', text: "Incredibly realistic. The memory feature is what makes it special — she actually knows me.", stars: 4 },
];

export default function Home() {
  const [characters, setCharacters] = useState([]);
  const navigate = useNavigate();
  const isLoggedIn = Boolean(localStorage.getItem('token'));

  useEffect(() => {
    API.get('/api/chat/characters').then(r => setCharacters(r.data.slice(0, 6))).catch(() => {});
  }, []);

  const handlePlanClick = (plan) => {
    if (plan.price === 0) { navigate('/register'); return; }
    navigate(isLoggedIn ? '/pricing' : '/register');
  };

  return (
    <div style={{ background: '#0a0a0f', color: '#f0f0f0', fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0a0a0f; } ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 3px; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes gradientMove { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        .hero-gradient { background: linear-gradient(-45deg,#e91e8c,#9c27b0,#3f51b5,#e91e8c); background-size:400% 400%; animation: gradientMove 8s ease infinite; -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .feature-card:hover { transform:translateY(-6px); border-color:rgba(233,30,140,0.3) !important; }
        .char-card:hover { transform:scale(1.04); }
        .plan-card:hover { transform:translateY(-8px); }
        .btn-primary { background:linear-gradient(135deg,#e91e8c,#9c27b0); border:none; border-radius:12px; color:#fff; font-weight:700; cursor:pointer; transition:all 0.2s; }
        .btn-primary:hover { opacity:0.9; transform:scale(1.02); }
        .btn-ghost { background:none; border:1px solid rgba(255,255,255,0.15); border-radius:12px; color:#ccc; cursor:pointer; transition:all 0.2s; }
        .btn-ghost:hover { border-color:rgba(233,30,140,0.4); color:#e91e8c; }
      `}</style>

      {/* Navbar */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 40px', display: 'flex', alignItems: 'center', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontSize: 24 }}>💕</span>
          <span style={{ fontWeight: 800, fontSize: 18, background: 'linear-gradient(135deg,#e91e8c,#9c27b0)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{brand.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isLoggedIn ? (
            <button className="btn-primary" onClick={() => navigate('/select-character')} style={{ padding: '10px 22px', fontSize: 14 }}>
              Open App →
            </button>
          ) : (
            <>
              <Link to="/login" style={{ color: '#888', textDecoration: 'none', fontSize: 14, padding: '10px 18px' }}>Sign In</Link>
              <button className="btn-primary" onClick={() => navigate('/register')} style={{ padding: '10px 22px', fontSize: 14 }}>
                Start Free
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '100px 40px 80px', textAlign: 'center', maxWidth: 900, margin: '0 auto', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(233,30,140,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(233,30,140,0.1)',
          border: '1px solid rgba(233,30,140,0.2)', borderRadius: 20, padding: '6px 16px', marginBottom: 28, fontSize: 13, color: '#e91e8c' }}>
          ✨ AI-Powered Companions Available 24/7
        </div>
        <h1 style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.1, marginBottom: 24 }}>
          <span className="hero-gradient">Your Perfect</span>
          <br />
          <span style={{ color: '#f0f0f0' }}>AI Companion</span>
        </h1>
        <p style={{ fontSize: 20, color: '#888', lineHeight: 1.7, marginBottom: 40, maxWidth: 600, margin: '0 auto 40px' }}>
          {brand.description}
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => navigate('/register')} style={{ padding: '16px 36px', fontSize: 17, borderRadius: 14 }}>
            Start Free — No Credit Card
          </button>
          <button className="btn-ghost" onClick={() => document.getElementById('pricing').scrollIntoView()} style={{ padding: '16px 36px', fontSize: 17, borderRadius: 14 }}>
            See Pricing
          </button>
        </div>
        <p style={{ color: '#444', fontSize: 13, marginTop: 20 }}>⭐ Trusted by 10,000+ users · 18+ only</p>
      </section>

      {/* Characters Preview */}
      {characters.length > 0 && (
        <section style={{ padding: '60px 40px', maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 36, fontWeight: 800, marginBottom: 12 }}>Meet Your Companions</h2>
          <p style={{ textAlign: 'center', color: '#666', marginBottom: 40, fontSize: 16 }}>Each one with a unique personality, waiting to connect with you</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {characters.map(char => (
              <div key={char.id} className="char-card" onClick={() => navigate(isLoggedIn ? `/chat/${char.id}` : '/register')}
                style={{ borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.25s',
                  background: 'linear-gradient(135deg,#1a0d2e,#0d1a2e)', border: '1px solid rgba(255,255,255,0.06)',
                  aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {char.photo_url
                  ? <img src={`${import.meta.env.VITE_API_URL}${char.photo_url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={char.name} />
                  : <span style={{ fontSize: 56 }}>💃</span>}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent,rgba(0,0,0,0.85))', padding: '30px 14px 14px' }}>
                  <p style={{ fontWeight: 700, fontSize: 15 }}>{char.name}</p>
                  {char.voice_enabled && <span style={{ fontSize: 10, color: '#4caf50' }}>🎤 Voice</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Features */}
      <section style={{ padding: '80px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 36, fontWeight: 800, marginBottom: 12 }}>Everything You Need</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 48, fontSize: 16 }}>A complete AI companion experience</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {FEATURES.map(f => (
            <div key={f.title} className="feature-card" style={{ background: '#12121a', borderRadius: 16, padding: 28,
              border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.25s' }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: '#666', fontSize: 14, lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '80px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 36, fontWeight: 800, marginBottom: 12 }}>Simple Pricing</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 48, fontSize: 16 }}>Credit-based — pay only for what you use</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {PLANS.map(plan => (
            <div key={plan.name} className="plan-card" style={{ background: '#12121a', borderRadius: 20, padding: 28,
              border: `1px solid ${plan.color}44`, transition: 'all 0.25s', position: 'relative', overflow: 'hidden' }}>
              {plan.badge && (
                <div style={{ position: 'absolute', top: 14, right: -22, background: plan.color,
                  color: plan.name === 'elite' ? '#000' : '#fff', fontSize: 10, fontWeight: 700,
                  padding: '3px 30px', transform: 'rotate(35deg)', letterSpacing: '0.5px' }}>{plan.badge}</div>
              )}
              <div style={{ fontSize: 28, marginBottom: 8 }}>
                {plan.name === 'free' ? '🆓' : plan.name === 'starter' ? '⭐' : plan.name === 'pro' ? '💜' : '👑'}
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{plan.label}</h3>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: plan.color }}>
                  {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                </span>
                {plan.price > 0 && <span style={{ color: '#555', fontSize: 13 }}>/month</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ccc' }}>
                    <span style={{ color: plan.color }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <button className="btn-primary" onClick={() => handlePlanClick(plan)}
                style={{ width: '100%', padding: '12px', fontSize: 14,
                  background: plan.price === 0 ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg,${plan.color},${plan.color}cc)` }}>
                {plan.price === 0 ? 'Start Free' : `Get ${plan.label}`}
              </button>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', color: '#444', fontSize: 13, marginTop: 28 }}>
          Credits: 1 credit/message · 5 credits/photo · 2 credits/voice
        </p>
      </section>

      {/* Testimonials */}
      <section style={{ padding: '80px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 36, fontWeight: 800, marginBottom: 12 }}>What Users Say</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 48, fontSize: 16 }}>Join thousands of satisfied users</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} style={{ background: '#12121a', borderRadius: 16, padding: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
                {Array.from({ length: t.stars }).map((_, i) => <span key={i} style={{ color: '#ffd700', fontSize: 14 }}>★</span>)}
                {Array.from({ length: 5 - t.stars }).map((_, i) => <span key={i} style={{ color: '#333', fontSize: 14 }}>★</span>)}
              </div>
              <p style={{ color: '#ccc', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>"{t.text}"</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</span>
                <span style={{ fontSize: 11, color: '#555', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 8 }}>{t.plan}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 40px', textAlign: 'center', background: 'linear-gradient(135deg,rgba(233,30,140,0.08),rgba(156,39,176,0.08))' }}>
        <h2 style={{ fontSize: 48, fontWeight: 900, marginBottom: 16 }}>Ready to Connect?</h2>
        <p style={{ color: '#888', fontSize: 18, marginBottom: 36 }}>Start your free account today — no credit card required.</p>
        <button className="btn-primary" onClick={() => navigate('/register')} style={{ padding: '18px 48px', fontSize: 18, borderRadius: 16 }}>
          Get Started Free 💕
        </button>
      </section>

      {/* Footer */}
      <footer style={{ padding: '40px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <p style={{ fontWeight: 800, fontSize: 18, background: 'linear-gradient(135deg,#e91e8c,#9c27b0)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 16 }}>{brand.name}</p>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          {[['Home', '/'], ['Pricing', '/pricing'], ['Login', '/login'], ['Register', '/register']].map(([label, to]) => (
            <Link key={to} to={to} style={{ color: '#555', textDecoration: 'none', fontSize: 13 }}>{label}</Link>
          ))}
        </div>
        <p style={{ color: '#333', fontSize: 12 }}>
          © {brand.year} {brand.name}. For adults 18+ only. AI companions are fictional.
        </p>
      </footer>
    </div>
  );
}
