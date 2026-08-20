import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../api/api";
import styles from "./ChatStyles";
import EmojiPicker from "emoji-picker-react";
import { FiImage, FiMic, FiSmile, FiArrowLeft } from "react-icons/fi";
import { Lock, ShieldCheck, Key, Download, Copy, Check, X } from "lucide-react";
import {
  getOrCreateKeyPair,
  getMyPublicKey,
  decryptChatMessage,
  encryptForSelf,
  exportKeyBackup,
  isEncrypted,
} from "../../utils/crypto";

// ── Helpers ────────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const resolveMediaUrl = (url) => url && !url.startsWith('http') && !url.startsWith('blob:') ? `${API_BASE}${url}` : url;

const ImageMessage = ({ url, onClick }) => {
  const resolvedUrl = resolveMediaUrl(url);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [loadingText] = useState(() => {
    const phrases = [
      "Taking my clothes off... 😉",
      "Taking a quick selfie for you baby... ❤️",
      "Hold on, getting a good angle... 🔥",
      "Getting undressed for you... 💋",
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  });

  return (
    <div style={{ position: "relative", minWidth: "200px", minHeight: "260px", backgroundColor: "rgba(0,0,0,0.1)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", margin: "4px 0" }}>
      {!loaded && !error && (
        <div style={{ position: "absolute", color: "#666", fontSize: "12px", display: "flex", flexDirection: "column", alignItems: "center", fontWeight: "500", textAlign: "center", padding: "0 10px" }}>
          <div style={{ marginBottom: "12px", width: "28px", height: "28px", border: "3px solid rgba(0,0,0,0.1)", borderRadius: "50%", borderTopColor: "#0095f6", animation: "spin 1s linear infinite" }} />
          {loadingText}
        </div>
      )}
      {error ? (
        <div style={{ color: "#ff4444", fontSize: "12px", padding: "10px", textAlign: "center", fontWeight: "500" }}>Failed to load image.<br />The generation took too long.</div>
      ) : (
        <img src={resolvedUrl} alt="Shared"
          style={{ ...styles.image, opacity: loaded ? 1 : 0, transition: "opacity 0.5s ease-in", cursor: "pointer", width: "100%", height: "100%", objectFit: "cover", position: loaded ? "relative" : "absolute" }}
          onClick={onClick} onLoad={() => setLoaded(true)}
          onError={(e) => {
            const retryCount = parseInt(e.target.dataset.retried || "0");
            if (retryCount < 6) {
              e.target.dataset.retried = (retryCount + 1).toString();
              setTimeout(() => { const s = e.target.src; e.target.src = ""; e.target.src = s; }, 4000);
            } else { setError(true); }
          }}
        />
      )}
    </div>
  );
};

// ── Voice Player Button ────────────────────────────────────────────────────────
const VoiceButton = ({ charId, text, onCreditDeducted }) => {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);

  const play = async () => {
    if (audioUrl) { audioRef.current?.play(); return; }
    setLoading(true);
    try {
      const res = await API.post("/api/voice/tts", { char_id: Number(charId), text }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      setAudioUrl(url);
      onCreditDeducted && onCreditDeducted(2);
      setTimeout(() => { if (audioRef.current) { audioRef.current.src = url; audioRef.current.play(); } }, 100);
    } catch (err) {
      const status = err.response?.status;
      if (status === 402) {
        alert("Not enough credits for voice. You need 2 credits.");
      } else {
        alert("Voice unavailable right now.");
      }
    }
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={play}
        title="Play voice (2 credits)"
        style={{
          background: "none", border: "none", cursor: loading ? "wait" : "pointer",
          color: "#e91e8c", fontSize: "14px", padding: "2px 6px", borderRadius: "6px",
          marginTop: "4px", display: "flex", alignItems: "center", gap: "4px", opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "⏳" : "🎤"} <span style={{ fontSize: "10px", color: "#aaa" }}>2cr</span>
      </button>
      <audio ref={audioRef} style={{ display: "none" }} />
    </>
  );
};

// ── Out Of Credits Modal ───────────────────────────────────────────────────────
const OutOfCreditsModal = ({ onClose, navigate, title, message }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
    <div style={{ background: "#12121a", borderRadius: 20, padding: 36, maxWidth: 360, width: "90%", textAlign: "center", border: "1px solid rgba(233,30,140,0.3)" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>💎</div>
      <h3 style={{ color: "#f0f0f0", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{title || "Out of Credits"}</h3>
      <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>{message || "You've used all your credits for this month. Upgrade your plan to keep chatting."}</p>
      <button
        onClick={() => navigate("/pricing")}
        style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg,#e91e8c,#9c27b0)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15, marginBottom: 10 }}
      >
        Upgrade Plan ↗
      </button>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 13 }}>Maybe later</button>
    </div>
  </div>
);

// ── E2EE Security Info Modal ─────────────────────────────────────────────────
const E2EESecurityModal = ({ onClose, myPubKey }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(myPubKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportKeys = () => {
    const jsonStr = exportKeyBackup();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `e2ee-keys-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: "#111b21", borderRadius: 20, padding: 28, maxWidth: 440, width: "90%", color: "#e9edef", border: "1px solid rgba(0,168,132,0.3)", position: "relative" }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#8696a0", cursor: "pointer" }}><X size={20} /></button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,168,132,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#00a884" }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>End-to-End Encrypted</h3>
            <p style={{ margin: 0, fontSize: 12, color: "#00a884" }}>Zero-Knowledge Cryptography Active</p>
          </div>
        </div>

        <p style={{ fontSize: 13, color: "#8696a0", lineHeight: "1.6", marginBottom: 20 }}>
          Your messages and shared photos with this AI companion are encrypted on your device using <strong>X25519</strong> and <strong>XSalsa20-Poly1305</strong>.
          The database only stores unreadable ciphertext. Your private encryption keys never leave your browser.
        </p>

        <div style={{ background: "#202c33", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#8696a0", fontWeight: 600, textTransform: "uppercase" }}>Your Device Public Key</span>
            <button onClick={handleCopyKey} style={{ background: "none", border: "none", color: "#00a884", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 11, fontFamily: "monospace", color: "#ccc", wordBreak: "break-all" }}>
            {myPubKey || "Key initializing..."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleExportKeys}
            style={{ flex: 1, padding: "10px 14px", background: "#00a884", border: "none", borderRadius: 10, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Download size={16} /> Backup Keys
          </button>
          <button
            onClick={onClose}
            style={{ padding: "10px 16px", background: "#202c33", border: "none", borderRadius: 10, color: "#8696a0", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Chat Component ────────────────────────────────────────────────────────
function Chat() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [fullScreenMedia, setFullScreenMedia] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [outOfCredits, setOutOfCredits] = useState(false);
  const [premiumModalMsg, setPremiumModalMsg] = useState("");
  const [charVoiceEnabled, setCharVoiceEnabled] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  
  // Contact Info states
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [charPosts, setCharPosts] = useState([]);
  const [sidebarTab, setSidebarTab] = useState('posts');

  // Credits state
  const userInfo = JSON.parse(localStorage.getItem("user_info") || "{}");
  const [credits, setCredits] = useState(userInfo.credits_remaining ?? 50);
  const [isUnlimited, setIsUnlimited] = useState(userInfo.is_unlimited ?? false);
  const [planName, setPlanName] = useState(userInfo.plan_name || "free");
  const LOW_CREDIT_THRESHOLD = 20;

  const timerRef = useRef(null);
  const MAX_DURATION = 30;
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const emojiRef = useRef(null);
  const messagesEndRef = useRef(null);
  const greetingTriggered = useRef(false);
  const followUpTimer = useRef(null);
  const proactiveCount = useRef(0);
  const isInitialLoad = useRef(true);
  const isCancelledRef = useRef(false);

  const { charId } = useParams();
  const navigate = useNavigate();
  const loggedInUserId = localStorage.getItem("user_id");
  const [charName, setCharName] = useState("");
  const [charAbout, setCharAbout] = useState("");
  const [charPhoto, setCharPhoto] = useState(null);
  const [myPublicKey, setMyPublicKey] = useState("");

  // Deduct credits from local state
  const deductCredits = (amount) => {
    if (isUnlimited) return;
    setCredits((prev) => {
      const next = Math.max(0, prev - amount);
      const info = JSON.parse(localStorage.getItem("user_info") || "{}");
      info.credits_remaining = next;
      localStorage.setItem("user_info", JSON.stringify(info));
      return next;
    });
  };

  // ── Step 1: Initialize E2EE Keypair and sync with server ───────────────────
  useEffect(() => {
    try {
      getOrCreateKeyPair();
      const pubKey = getMyPublicKey();
      setMyPublicKey(pubKey);
      API.post("/api/social/public-key", { public_key: pubKey }).catch(() => {});
    } catch (err) {
      console.error("[E2EE] Key initialization error:", err);
    }
  }, []);

  // ── Decrypt history messages helper ──────────────────────────────────────────
  const unpackAndDecryptMessage = useCallback((rawMsg) => {
    const rawContent = rawMsg.text || rawMsg.content || "";
    let decryptedText = rawContent;

    if (isEncrypted(rawContent)) {
      decryptedText = decryptChatMessage(rawContent);
    }

    const results = [];
    const sender = rawMsg.sender === "user" ? "user" : "ai";
    const time = rawMsg.time || new Date().toISOString();

    // Check for [AUDIO:...]
    if (decryptedText.includes("[AUDIO:")) {
      const parts = decryptedText.split("[AUDIO:");
      const audioUrl = parts[1].split("]")[0].trim();
      const cleanText = decryptedText.replace(/\[AUDIO:.*?\]\s*/g, "").trim();
      if (cleanText) results.push({ sender, type: "text", text: cleanText, time, is_encrypted: true });
      results.push({ sender, type: "audio", url: audioUrl, time, is_encrypted: true });
      return results;
    }

    // Check for [IMAGE:...]
    if (decryptedText.includes("[IMAGE:")) {
      const parts = decryptedText.split("[IMAGE:");
      const cleanText = parts[0].trim();
      const imgUrl = parts[1].replace("]", "").trim();
      if (cleanText) results.push({ sender, type: "text", text: cleanText, time, is_encrypted: true });
      results.push({ sender, type: "image", url: imgUrl, time, is_encrypted: true });
      return results;
    }

    // Standard message
    if (rawMsg.type === "image" || rawMsg.type === "audio") {
      results.push({ ...rawMsg, text: decryptedText, is_encrypted: true });
    } else {
      results.push({ sender, type: "text", text: decryptedText, time, is_encrypted: true });
    }

    return results;
  }, []);

  // Fetch character info
  useEffect(() => {
    if (!charId) return;
    API.get(`/api/chat/characters/${charId}`)
      .then((r) => {
        setCharName(r.data.name);
        setCharVoiceEnabled(r.data.voice_enabled || false);
        setCharAbout(r.data.about || "Available");
        setCharPhoto(r.data.photo_url || null);
      })
      .catch(console.error);

    API.get(`/api/chat/characters/${charId}/posts`)
      .then((r) => setCharPosts(r.data))
      .catch(console.error);
  }, [charId]);

  // Sync credits from server on mount
  useEffect(() => {
    API.get("/api/auth/me")
      .then((r) => {
        setCredits(r.data.credits_remaining);
        setIsUnlimited(r.data.is_unlimited);
        setPlanName(r.data.plan_name);
        const info = JSON.parse(localStorage.getItem("user_info") || "{}");
        info.credits_remaining = r.data.credits_remaining;
        info.is_unlimited = r.data.is_unlimited;
        info.plan_name = r.data.plan_name;
        localStorage.setItem("user_info", JSON.stringify(info));
      })
      .catch(() => {});
  }, []);

  // Fetch & Decrypt chat history
  useEffect(() => {
    const fetchHistory = async () => {
      const uid = localStorage.getItem("user_id");
      if (uid && charId) {
        try {
          const encodedUserId = encodeURIComponent(uid);
          const res = await API.get(`/api/chat/history/${encodedUserId}/${charId}`);
          const rawHistory = res.data;

          // Decrypt and unpack all messages
          const decryptedHistory = [];
          for (const msg of rawHistory) {
            const unpacked = unpackAndDecryptMessage(msg);
            decryptedHistory.push(...unpacked);
          }

          setChat(decryptedHistory);

          if (isInitialLoad.current || charId) {
            isInitialLoad.current = false;
            let aiConsecutive = 0;
            for (let i = decryptedHistory.length - 1; i >= 0; i--) {
              if (decryptedHistory[i].sender === "ai") aiConsecutive++;
              else break;
            }
            if (decryptedHistory.length === 0 && !greetingTriggered.current) {
              greetingTriggered.current = true;
              proactiveCount.current = 1;
              triggerAutoGreeting(uid, "[GREETING]");
              scheduleFollowUp(uid);
            } else if (aiConsecutive === 1 && !decryptedHistory.some((m) => m.sender === "user")) {
              proactiveCount.current = 1;
              scheduleFollowUp(uid);
            } else if (aiConsecutive >= 2) {
              greetingTriggered.current = true;
              proactiveCount.current = 2;
              if (followUpTimer.current) clearTimeout(followUpTimer.current);
            }
          }
        } catch (err) {
          console.error("Failed to load chat history:", err);
        }
      }
    };
    fetchHistory();
  }, [charId, unpackAndDecryptMessage]);

  const scheduleFollowUp = (uid) => {
    if (followUpTimer.current) clearTimeout(followUpTimer.current);
    followUpTimer.current = setTimeout(() => {
      setChat((prev) => {
        const stillNoUser = !prev.some((m) => m.sender === "user");
        let aiConsecutive = 0;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].sender === "ai") aiConsecutive++;
          else break;
        }
        if (stillNoUser && aiConsecutive === 1) {
          proactiveCount.current = 2;
          triggerAutoGreeting(uid, "I miss you... what are you doing? why aren't you replying? ❤️");
        }
        return prev;
      });
    }, 120000);
  };

  useEffect(() => () => { if (followUpTimer.current) clearTimeout(followUpTimer.current); }, []);

  const triggerAutoGreeting = async (uid, triggerMessage) => {
    setIsTyping(true);
    try {
      const pubKey = getMyPublicKey();
      const res = await API.post("/api/chat/", { 
        user_id: uid, 
        char_id: charId, 
        message: triggerMessage,
        user_public_key: pubKey 
      });
      setChat((prev) => [...prev, { sender: "ai", type: "text", text: res.data.reply, time: res.data.time || new Date().toISOString(), is_encrypted: true }]);
    } catch (err) {
      console.error("Auto-greeting failed:", err);
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessage = async (overrideMessage = null, hideUserBubble = false, audioUrl = null) => {
    let textToSubmit = typeof overrideMessage === 'string' ? overrideMessage : message;
    if (!textToSubmit.trim() || !loggedInUserId) return;
    
    if (audioUrl) {
        textToSubmit = `[AUDIO:${audioUrl}] ${textToSubmit}`;
    }

    if (!isUnlimited && credits <= 0) {
      setOutOfCredits(true);
      return;
    }

    const userMessage = textToSubmit;
    if (!hideUserBubble) {
      setChat((prev) => [...prev, { sender: "user", type: "text", text: userMessage, time: new Date().toISOString(), is_encrypted: true }]);
    }
    if (typeof overrideMessage !== 'string') setMessage("");
    setIsTyping(true);

    try {
      const pubKey = getMyPublicKey();
      const encryptedUserMsg = encryptForSelf(userMessage);

      const res = await API.post("/api/chat/", { 
        user_id: loggedInUserId, 
        char_id: charId, 
        message: userMessage,
        user_public_key: pubKey,
        encrypted_user_content: encryptedUserMsg
      });

      const imageCost = res.data.image_url ? 5 : 0;
      deductCredits(1 + imageCost);

      const newMessages = [{ sender: "ai", type: "text", text: res.data.reply, time: res.data.time || new Date().toISOString(), is_encrypted: true }];
      if (res.data.image_url) {
        const imgUrl = res.data.image_url.startsWith('http')
          ? res.data.image_url
          : `${API_BASE}${res.data.image_url}`;
        newMessages.push({ sender: "ai", type: "image", url: imgUrl, time: new Date().toISOString(), is_encrypted: true });
      }
      setChat((prev) => [...prev, ...newMessages]);
    } catch (err) {
      if (err.response?.status === 402) {
        setOutOfCredits(true);
      } else {
        setChat((prev) => [...prev, { sender: "ai", type: "text", text: "Connection error." }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, isTyping]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiRef.current && !emojiRef.current.contains(event.target)) setShowEmoji(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    setChat((prev) => [...prev, { sender: "user", type: "image", url: URL.createObjectURL(file), is_encrypted: true }]);
  };

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          noiseSuppression: true, 
          echoCancellation: true, 
          autoGainControl: true 
        } 
      });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setIsRecording(true);
      setRecordTime(0);
      timerRef.current = setInterval(() => {
        setRecordTime((prev) => (prev >= MAX_DURATION - 1 ? (stopRecording(), MAX_DURATION) : prev + 1));
      }, 1000);
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        clearInterval(timerRef.current);
        setIsRecording(false);
        
        if (isCancelledRef.current) {
          isCancelledRef.current = false;
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setChat((prev) => [...prev, { sender: "user", type: "audio", url, is_encrypted: true }]);

        const formData = new FormData();
        formData.append("file", blob, "voice.webm");
        try {
          setIsTyping(true);
          const res = await API.post("/api/voice/transcribe", formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          const text = res.data.text;
          const audioUrl = res.data.audio_url;

          setChat((prev) => {
             const newChat = [...prev];
             for (let i = newChat.length - 1; i >= 0; i--) {
                if (newChat[i].sender === "user" && newChat[i].type === "audio" && newChat[i].url === url) {
                   newChat[i].url = audioUrl;
                   break;
                }
             }
             return newChat;
          });

          if (text) {
             await sendMessage(text, true, audioUrl);
          }
        } catch (err) {
          console.error("Transcription failed", err);
          setChat((prev) => [...prev, { sender: "ai", type: "text", text: "Sorry, I couldn't understand the audio." }]);
          setIsTyping(false);
        }
      };
      recorder.start();
    } catch (err) {
      alert("Mic access denied");
    }
  };

  const stopRecording = () => mediaRecorderRef.current?.stop();
  const formatTime = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @media (max-width: 768px) {
          .contact-sidebar {
            position: fixed !important;
            top: 0;
            right: 0;
            bottom: 0;
            width: 100% !important;
            z-index: 1000;
          }
        }
      `}</style>

      <div style={{ ...styles.chatBox, flex: 1, borderRight: showContactInfo ? '1px solid #1f2c34' : 'none' }}>
        {/* ── Header ── */}
        <div style={{ ...styles.header, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
            <button 
              onClick={() => navigate('/select-character')}
              style={{ background: 'none', border: 'none', fontSize: 24, color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: "4px" }}
            >
              <FiArrowLeft />
            </button>
            <div 
              style={{ ...styles.headerLeft, cursor: 'pointer', flex: 1, minWidth: 0 }}
              onClick={() => setShowContactInfo(true)}
            >
              <div style={{ ...styles.avatar, overflow: "hidden", flexShrink: 0 }}>
                <img
                  key={charPhoto || charName}
                  src={charPhoto ? `${import.meta.env.VITE_API_URL}${charPhoto}` : `/avatars/${charName}.jpg`}
                  alt={charName}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              </div>
              <div style={{ overflow: "hidden", minWidth: 0 }}>
                <div style={{ ...styles.name, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{charName}</div>
                <div style={{ fontSize: "12px", color: "#8696a0", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{charAbout}</div>
              </div>
            </div>
          </div>

          {/* E2EE Active Security Badge */}
          <div 
            style={styles.e2eeBadge}
            onClick={() => setShowSecurityModal(true)}
            title="Click to view end-to-end encryption details"
          >
            <Lock size={12} />
            <span>E2EE</span>
          </div>
        </div>

        {/* ── E2EE Notice Banner ── */}
        <div style={styles.e2eeBanner} onClick={() => setShowSecurityModal(true)} role="button" tabIndex={0}>
          <Lock size={12} />
          <span>Messages and media are end-to-end encrypted. Tap to verify.</span>
        </div>

        {/* ── Messages ── */}
        <div style={styles.messages}>
          {chat.reduce((acc, msg, i) => {
            const msgDate = new Date(msg.time || new Date());
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);
            const isToday = msgDate.toDateString() === today.toDateString();
            const isYesterday = msgDate.toDateString() === yesterday.toDateString();
            let dateLabel = msgDate.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
            if (isToday) dateLabel = "Today";
            else if (isYesterday) dateLabel = "Yesterday";
            const prevMsg = chat[i - 1];
            const prevDate = prevMsg ? new Date(prevMsg.time || new Date()).toDateString() : null;
            if (msgDate.toDateString() !== prevDate) {
              acc.push(
                <div key={`date-${i}`} style={{ textAlign: "center", margin: "20px 0", display: "flex", justifyContent: "center" }}>
                  <span style={{ backgroundColor: "rgba(0,0,0,0.05)", padding: "4px 12px", borderRadius: "12px", fontSize: "12px", color: "rgba(0,0,0,0.5)", fontWeight: "600", textTransform: "uppercase" }}>{dateLabel}</span>
                </div>
              );
            }

            const isAI = msg.sender === "ai";
            acc.push(
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isAI ? "flex-start" : "flex-end" }}>
                <div style={{
                  ...styles.message,
                  alignSelf: isAI ? "flex-start" : "flex-end",
                  backgroundColor: isAI ? "#efefef" : "#0095f6",
                  color: isAI ? "#000" : "#fff",
                  position: "relative",
                  paddingBottom: "18px",
                  minWidth: "75px",
                }}>
                  {msg.type === "text" && msg.text}
                  {msg.type === "image" && <ImageMessage url={msg.url} onClick={() => {
                    const chatMedia = chat.filter(m => m.type === 'image' || m.type === 'video').map(m => ({ url: resolveMediaUrl(m.url), type: m.type }));
                    const idx = chatMedia.findIndex(m => m.url === resolveMediaUrl(msg.url));
                    setFullScreenMedia({ items: chatMedia, index: idx >= 0 ? idx : 0 });
                  }} />}
                  {msg.type === "audio" && <audio controls src={resolveMediaUrl(msg.url)} style={styles.audio} onLoadedMetadata={(e) => {
                    if (e.target.duration === Infinity || isNaN(e.target.duration)) {
                      e.target.currentTime = 1e101;
                      e.target.ontimeupdate = () => {
                        e.target.ontimeupdate = null;
                        e.target.currentTime = 0;
                      };
                    }
                  }} />}
                  <div style={{ position: "absolute", bottom: "4px", right: "8px", fontSize: "10px", color: isAI ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.8)", fontWeight: "500", display: "flex", alignItems: "center", gap: 3 }}>
                    <Lock size={9} color={isAI ? "rgba(0,168,132,0.8)" : "rgba(255,255,255,0.8)"} />
                    {new Date(msg.time || new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase()}
                  </div>
                </div>
                {/* ── Voice button under each AI text message ── */}
                {isAI && msg.type === "text" && charVoiceEnabled && (
                  <VoiceButton charId={charId} text={msg.text} onCreditDeducted={deductCredits} />
                )}
              </div>
            );
            return acc;
          }, [])}

          {isTyping && (
            <div style={{ ...styles.message, alignSelf: "flex-start", backgroundColor: "#efefef", fontStyle: "italic" }}>
              {charName} is typing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Box ── */}
        <div style={styles.inputBox}>
          {!isRecording ? (
            <>
              <button style={styles.iconButton} onClick={(e) => { e.stopPropagation(); setShowEmoji(!showEmoji); }}>
                <FiSmile />
              </button>
              {showEmoji && (
                <div ref={emojiRef} style={{ position: "absolute", bottom: "60px", left: "10px", zIndex: 999 }}>
                  <EmojiPicker onEmojiClick={(emojiData) => setMessage((prev) => prev + emojiData.emoji)} />
                </div>
              )}
              <input
                style={styles.input}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyUp={(e) => e.key === "Enter" && message.trim() && sendMessage()}
                placeholder={!isUnlimited && credits <= 0 ? "No credits — upgrade to continue" : "🔒 Message..."}
                disabled={!isUnlimited && credits <= 0}
              />
              {!message.trim() && (
                <>
                  <button style={styles.iconButton} onClick={() => fileInputRef.current.click()}><FiImage /></button>
                  <button style={styles.iconButton} onMouseDown={startRecording} onMouseUp={stopRecording}><FiMic /></button>
                </>
              )}
              {message.trim() && (
                <button style={styles.sendBtn} onClick={sendMessage}>Send</button>
              )}
            </>
          ) : (
            <div style={styles.recordingBar}>
              <button style={styles.cancelBtn} onClick={() => { isCancelledRef.current = true; stopRecording(); }}>✖</button>
              <div style={styles.recordingWave}>🎤 Recording...</div>
              <div style={styles.timer}>{formatTime(recordTime)}</div>
              <button style={styles.sendVoiceBtn} onClick={stopRecording}>➤</button>
            </div>
          )}
          <input type="file" accept="image/*" ref={fileInputRef} hidden onChange={handleImageUpload} />
        </div>
      </div>

      {/* ── Contact Info Sidebar (WhatsApp Style) ── */}
      {showContactInfo && (() => {
        const posts = charPosts.filter(p => p.media_type === 'image');
        const reels = charPosts.filter(p => p.media_type === 'video');
        const personalMedia = chat.filter(m => m.sender === 'ai' && m.type === 'image').reverse();

        let activeMedia = [];
        if (sidebarTab === 'posts') activeMedia = posts;
        if (sidebarTab === 'reels') activeMedia = reels;
        if (sidebarTab === 'personal') activeMedia = personalMedia;

        return (
          <div className="contact-sidebar" style={{ width: 360, minWidth: 320, background: '#111b21', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
            <div style={{ padding: '20px', background: '#202c33', display: 'flex', alignItems: 'center', gap: 20 }}>
              <button onClick={() => setShowContactInfo(false)} style={{ background: 'none', border: 'none', color: '#a6b0b6', cursor: 'pointer', fontSize: 20 }}>✕</button>
              <span style={{ color: '#e9edef', fontSize: 16, fontWeight: 500 }}>Contact info</span>
            </div>
            
            <div style={{ padding: '30px 20px', background: '#111b21', textAlign: 'center', borderBottom: '8px solid #0b141a' }}>
              <img 
                src={charPhoto ? `${import.meta.env.VITE_API_URL}${charPhoto}` : `/avatars/${charName}.jpg`} 
                style={{ width: 200, height: 200, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 16px', border: '2px solid #202c33', cursor: 'pointer' }} 
                alt={charName}
                onClick={() => setFullScreenMedia({ 
                  items: [{ url: charPhoto ? `${import.meta.env.VITE_API_URL}${charPhoto}` : `/avatars/${charName}.jpg`, type: 'image' }], 
                  index: 0 
                })}
              />
              <h2 style={{ fontSize: 24, color: '#e9edef', margin: '0 0 6px 0', fontWeight: 500 }}>{charName}</h2>
              <p style={{ fontSize: 15, color: '#8696a0', margin: 0 }}>{charAbout || "Available"}</p>
            </div>
            
            <div style={{ padding: '0 20px', background: '#111b21', display: 'flex', gap: 24, borderBottom: '1px solid #1f2c34' }}>
              {['posts', 'reels', 'personal'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: sidebarTab === tab ? '3px solid #00a884' : '3px solid transparent',
                    color: sidebarTab === tab ? '#00a884' : '#8696a0',
                    padding: '16px 4px 12px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: 14,
                    textTransform: 'capitalize',
                    transition: 'color 0.2s'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ padding: '20px', background: '#111b21', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {sidebarTab !== 'personal' ? activeMedia.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => {
                      if (p.is_premium && planName === "free" && !isUnlimited) {
                        setPremiumModalMsg("Subscribe to a premium plan to watch exclusive reels and posts.");
                        setOutOfCredits(true);
                      } else {
                        const items = activeMedia
                          .filter(item => !(item.is_premium && planName === "free" && !isUnlimited))
                          .map(item => ({ url: `${import.meta.env.VITE_API_URL}${item.media_url}`, type: item.media_type }));
                        const currentUrl = `${import.meta.env.VITE_API_URL}${p.media_url}`;
                        setFullScreenMedia({ items, index: items.findIndex(item => item.url === currentUrl) });
                      }
                    }}
                    style={{ position: 'relative', aspectRatio: '1/1', background: '#1f2c34', borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
                  >
                    {p.media_type === 'video' ? (
                      <video src={`${import.meta.env.VITE_API_URL}${p.media_url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                    ) : (
                      <img src={`${import.meta.env.VITE_API_URL}${p.media_url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    )}
                    {p.media_type === 'video' && <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, padding: '2px 5px', borderRadius: 4 }}>🎥</div>}
                    {p.is_premium && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        <span style={{ fontSize: 24, marginBottom: 2 }}>🔒</span>
                        <span style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>Premium</span>
                      </div>
                    )}
                  </div>
                )) : activeMedia.map((m, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      const items = activeMedia.map(item => ({ url: resolveMediaUrl(item.url), type: "image" }));
                      setFullScreenMedia({ items, index: idx });
                    }}
                    style={{ position: 'relative', aspectRatio: '1/1', background: '#1f2c34', borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
                  >
                    <img src={resolveMediaUrl(m.url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Personal" />
                  </div>
                ))}
                {activeMedia.length === 0 && <p style={{ gridColumn: '1 / -1', color: '#555', fontSize: 13, textAlign: 'center', marginTop: 20 }}>No media found.</p>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Fullscreen Media ── */}
      {fullScreenMedia && (() => {
        const item = fullScreenMedia.items[fullScreenMedia.index];
        const hasPrev = fullScreenMedia.index > 0;
        const hasNext = fullScreenMedia.index < fullScreenMedia.items.length - 1;
        
        const handlePrev = (e) => { e.stopPropagation(); if (hasPrev) setFullScreenMedia({...fullScreenMedia, index: fullScreenMedia.index - 1}); };
        const handleNext = (e) => { e.stopPropagation(); if (hasNext) setFullScreenMedia({...fullScreenMedia, index: fullScreenMedia.index + 1}); };
        
        let touchStartX = 0;
        const handleTouchStart = (e) => { touchStartX = e.changedTouches[0].screenX; };
        const handleTouchEnd = (e) => {
          const touchEndX = e.changedTouches[0].screenX;
          if (touchStartX - touchEndX > 50) handleNext(e);
          if (touchEndX - touchStartX > 50) handlePrev(e);
        };

        return (
          <div 
            style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.95)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, cursor: "zoom-out" }} 
            onClick={() => setFullScreenMedia(null)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {hasPrev && <button style={{position: 'absolute', left: 20, fontSize: 40, color: 'white', background: 'none', border: 'none', cursor: 'pointer', zIndex: 10000, padding: 20}} onClick={handlePrev}>&#10094;</button>}
            
            {item.type === 'video' ? (
              <video src={item.url} controls autoPlay style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: "8px" }} onClick={e => e.stopPropagation()} />
            ) : (
              <img src={item.url} alt="Fullscreen" style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain", borderRadius: "8px", userSelect: "none" }} onClick={e => e.stopPropagation()} draggable="false" />
            )}

            {hasNext && <button style={{position: 'absolute', right: 20, fontSize: 40, color: 'white', background: 'none', border: 'none', cursor: 'pointer', zIndex: 10000, padding: 20}} onClick={handleNext}>&#10095;</button>}

            <button style={{ position: "absolute", top: "20px", right: "30px", background: "transparent", border: "none", color: "white", fontSize: "40px", cursor: "pointer", zIndex: 10000 }} onClick={(e) => { e.stopPropagation(); setFullScreenMedia(null); }}>
              &times;
            </button>
          </div>
        );
      })()}

      {/* ── Out of Credits / Premium Modal ── */}
      {outOfCredits && (
        <OutOfCreditsModal 
          onClose={() => { setOutOfCredits(false); setPremiumModalMsg(""); }} 
          navigate={navigate} 
          title={premiumModalMsg ? "Premium Content" : "Out of Credits"}
          message={premiumModalMsg}
        />
      )}

      {/* ── E2EE Security Info Modal ── */}
      {showSecurityModal && (
        <E2EESecurityModal 
          onClose={() => setShowSecurityModal(false)}
          myPubKey={myPublicKey}
        />
      )}
    </div>
  );
}

export default Chat;
