import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); // Prevent Chrome from showing the mini-infobar
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setDeferredPrompt(null);
    }
  };

  if (isInstalled || !deferredPrompt || dismissed) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #e91e8c 0%, #9c27b0 100%)',
      padding: '12px 20px',
      margin: '20px 20px 0 20px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 4px 15px rgba(233,30,140,0.3)',
      animation: 'slideDown 0.5s ease-out'
    }}>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ background: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: '50%' }}>
          <Download size={20} color="#fff" />
        </div>
        <div>
          <h4 style={{ margin: 0, color: '#fff', fontSize: 14, fontWeight: 'bold' }}>Install Avoiga by Ectama</h4>
          <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Add to home screen for a better experience</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button 
          onClick={() => setDismissed(true)} 
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13 }}
        >
          Not now
        </button>
        <button 
          onClick={handleInstallClick} 
          style={{ background: '#fff', border: 'none', color: '#e91e8c', padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
        >
          Install
        </button>
      </div>
    </div>
  );
}
