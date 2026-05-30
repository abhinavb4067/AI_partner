import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import API from "../../api/api";
import styles from "./ChatStyles";
import EmojiPicker from "emoji-picker-react";
import { FiImage, FiMic, FiSmile } from "react-icons/fi";

const ImageMessage = ({ url, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  useEffect(() => {
    const phrases = [
      "Taking my clothes off... 😉",
      "Taking a quick selfie for you baby... ❤️",
      "Hold on, getting a good angle... 🔥",
      "Getting undressed for you... 💋"
    ];
    setLoadingText(phrases[Math.floor(Math.random() * phrases.length)]);
  }, []);

  return (
    <div style={{ position: "relative", minWidth: "200px", minHeight: "260px", backgroundColor: "rgba(0,0,0,0.1)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", margin: "4px 0" }}>
      {!loaded && !error && (
        <div style={{ position: "absolute", color: "#666", fontSize: "12px", display: "flex", flexDirection: "column", alignItems: "center", fontWeight: "500", textAlign: "center", padding: "0 10px" }}>
          <div style={{ marginBottom: "12px", width: "28px", height: "28px", border: "3px solid rgba(0,0,0,0.1)", borderRadius: "50%", borderTopColor: "#0095f6", animation: "spin 1s linear infinite" }} />
          {loadingText}
        </div>
      )}
      {error ? (
        <div style={{ color: "#ff4444", fontSize: "12px", padding: "10px", textAlign: "center", fontWeight: "500" }}>Failed to load image.<br/>The generation took too long.</div>
      ) : (
        <img
          src={url}
          alt="Shared"
          style={{ ...styles.image, opacity: loaded ? 1 : 0, transition: "opacity 0.5s ease-in", cursor: "pointer", width: "100%", height: "100%", objectFit: "cover", position: loaded ? "relative" : "absolute" }}
          onClick={onClick}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            const retryCount = parseInt(e.target.dataset.retried || "0");
            if (retryCount < 6) {
              e.target.dataset.retried = (retryCount + 1).toString();
              setTimeout(() => {
                const currentSrc = e.target.src;
                e.target.src = "";
                e.target.src = currentSrc;
              }, 4000);
            } else {
              setError(true);
            }
          }}
        />
      )}
    </div>
  );
};

function Chat() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const timerRef = useRef(null);
  const MAX_DURATION = 30;

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef(null);
  const messagesEndRef = useRef(null);

  const { charId } = useParams();
  const loggedInUserId = localStorage.getItem("user_id");
  const [charName, setCharName] = useState("");

  // ✅ Fetch Character Details (Name, etc.)
  useEffect(() => {
    const fetchCharDetails = async () => {
      if (charId) {
        try {
          const res = await API.get(`/api/chat/characters/${charId}`);
          setCharName(res.data.name);
        } catch (err) {
          console.error("Failed to load character details:", err);
        }
      }
    };
    fetchCharDetails();
  }, [charId]);

  const greetingTriggered = useRef(false);
  const followUpTimer = useRef(null);
  const proactiveCount = useRef(0);
  const isInitialLoad = useRef(true);

  // ✅ Fetch Chat History on Load
  useEffect(() => {
    const fetchHistory = async () => {
      const uid = localStorage.getItem("user_id");
      if (uid && charId) {
        try {
          const encodedUserId = encodeURIComponent(uid);
          const res = await API.get(`/api/chat/history/${encodedUserId}/${charId}`);
          const history = res.data;
          setChat(history);
          
          // 🚀 PROACTIVE LOGIC: Only run once on mount/char change
          if (isInitialLoad.current || charId) {
            isInitialLoad.current = false;
            
            // Count how many consecutive AI messages are at the end
            let aiConsecutive = 0;
            for (let i = history.length - 1; i >= 0; i--) {
              if (history[i].sender === "ai") aiConsecutive++;
              else break;
            }

            // 1️⃣ If chat is TOTALLY empty -> Send Initial Greeting
            if (history.length === 0 && !greetingTriggered.current) {
              greetingTriggered.current = true;
              proactiveCount.current = 1;
              triggerAutoGreeting(uid, "[GREETING]");
              scheduleFollowUp(uid);
            } 
            // 2️⃣ If last message was AI and only 1 AI message exists -> Maybe follow up
            else if (aiConsecutive === 1 && !history.some(m => m.sender === "user")) {
                proactiveCount.current = 1;
                scheduleFollowUp(uid);
            }
            // 3️⃣ If 2 or more AI messages with no user reply -> STOP COMPLETELY
            else if (aiConsecutive >= 2) {
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
  }, [charId]);

  const scheduleFollowUp = (uid) => {
    if (followUpTimer.current) clearTimeout(followUpTimer.current);
    followUpTimer.current = setTimeout(() => {
      setChat(prev => {
        const stillNoUser = !prev.some(m => m.sender === "user");
        // Count consecutive AI messages in state
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
    }, 120000); // 2 minutes
  };

  // Dedicated effect for cleanup only
  useEffect(() => {
    return () => {
      if (followUpTimer.current) clearTimeout(followUpTimer.current);
    };
  }, []);

  const triggerAutoGreeting = async (uid, triggerMessage) => {
    setIsTyping(true);
    try {
      const res = await API.post("/api/chat/", {
        user_id: uid,
        char_id: charId,
        message: triggerMessage,
      });

      const aiResponse = {
        sender: "ai",
        type: "text",
        text: res.data.reply,
        time: res.data.time || new Date().toISOString()
      };

      setChat((prev) => [...prev, aiResponse]);
    } catch (err) {
      console.error("Auto-greeting failed:", err);
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !loggedInUserId) return;

    const userMessage = message;

    const newChat = [
      ...chat,
      { sender: "user", type: "text", text: userMessage },
    ];
    setChat(newChat);

    setMessage("");
    setIsTyping(true);

    try {
      // 🔄 UPDATED: Sending char_id instead of char_slug
      const res = await API.post("/api/chat/", {
        user_id: loggedInUserId,
        char_id: charId,
        message: userMessage,
      });

      const aiResponse = {
        sender: "ai",
        type: "text",
        text: res.data.reply,
      };

      const newMessages = [aiResponse];

      if (res.data.image_url) {
        newMessages.push({
          sender: "ai",
          type: "image",
          url: res.data.image_url,
        });
      }

      setChat((prev) => [...prev, ...newMessages]);
    } catch (err) {
      console.error("Chat Error:", err);
      setChat((prev) => [
        ...prev,
        { sender: "ai", type: "text", text: "Connection error." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // ✅ Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, isTyping]);

  // Emoji logic
  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiRef.current && !emojiRef.current.contains(event.target)) {
        setShowEmoji(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const imageUrl = URL.createObjectURL(file);
    setChat((prev) => [
      ...prev,
      { sender: "user", type: "image", url: imageUrl },
    ]);
  };

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      setIsRecording(true);
      setRecordTime(0);

      timerRef.current = setInterval(() => {
        setRecordTime((prev) =>
          prev >= MAX_DURATION - 1 ? (stopRecording(), MAX_DURATION) : prev + 1,
        );
      }, 1000);

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = () => {
        clearInterval(timerRef.current);
        setIsRecording(false);
        const url = URL.createObjectURL(
          new Blob(audioChunksRef.current, { type: "audio/webm" }),
        );
        setChat((prev) => [...prev, { sender: "user", type: "audio", url }]);
      };
      recorder.start();
    } catch (err) {
      alert("Mic access denied");
    }
  };

  const stopRecording = () => mediaRecorderRef.current?.stop();

  const formatTime = (sec) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div style={styles.container}>
      <div style={styles.chatBox}>
        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={{...styles.avatar, overflow: 'hidden'}}>
              <img 
                src={`/avatars/${charName}.jpg`} 
                alt={charName} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            <div>
              <div style={styles.name}>{charName}</div>
              <div style={{ fontSize: "10px", color: "#00ff00" }}>Online</div>
            </div>
          </div>
        </div>

        {/* MESSAGES */}
        {/* Chat Messages */}
        <div style={styles.messages}>
          {chat.reduce((acc, msg, i) => {
            const msgDate = new Date(msg.time || new Date());
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);

            const isToday = msgDate.toDateString() === today.toDateString();
            const isYesterday = msgDate.toDateString() === yesterday.toDateString();

            let dateLabel = msgDate.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
            if (isToday) dateLabel = "Today";
            else if (isYesterday) dateLabel = "Yesterday";

            // Check if we need a date separator
            const prevMsg = chat[i - 1];
            const prevDate = prevMsg ? new Date(prevMsg.time || new Date()).toDateString() : null;
            const currentDate = msgDate.toDateString();

            if (currentDate !== prevDate) {
              acc.push(
                <div key={`date-${i}`} style={{
                  textAlign: "center",
                  margin: "20px 0",
                  display: "flex",
                  justifyContent: "center"
                }}>
                  <span style={{
                    backgroundColor: "rgba(0,0,0,0.05)",
                    padding: "4px 12px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "rgba(0,0,0,0.5)",
                    fontWeight: "600",
                    textTransform: "uppercase"
                  }}>
                    {dateLabel}
                  </span>
                </div>
              );
            }

            acc.push(
              <div
                key={i}
                style={{
                  ...styles.message,
                  alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                  backgroundColor: msg.sender === "user" ? "#0095f6" : "#efefef",
                  color: msg.sender === "user" ? "#fff" : "#000",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  paddingBottom: "18px",
                  minWidth: "60px"
                }}
              >
                {msg.type === "text" && msg.text}
                {msg.type === "image" && (
                  <ImageMessage url={msg.url} onClick={() => setFullScreenImage(msg.url)} />
                )}
                {msg.type === "audio" && (
                  <audio controls src={msg.url} style={styles.audio} />
                )}
                
                <div style={{
                  position: "absolute",
                  bottom: "4px",
                  right: "8px",
                  fontSize: "10px",
                  color: msg.sender === "user" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.4)",
                  fontWeight: "500"
                }}>
                  {msg.time 
                    ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
                    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()}
                </div>
              </div>
            );
            return acc;
          }, [])}
          
          {isTyping && (
            <div
              style={{
                ...styles.message,
                alignSelf: "flex-start",
                backgroundColor: "#efefef",
                fontStyle: "italic",
              }}
            >
              {charName} is typing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT BOX */}
        <div style={styles.inputBox}>
          {!isRecording ? (
            <>
              <button
                style={styles.iconButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmoji(!showEmoji);
                }}
              >
                <FiSmile />
              </button>
              {showEmoji && (
                <div
                  ref={emojiRef}
                  style={{
                    position: "absolute",
                    bottom: "60px",
                    left: "10px",
                    zIndex: 999,
                  }}
                >
                  <EmojiPicker
                    onEmojiClick={(emojiData) =>
                      setMessage((prev) => prev + emojiData.emoji)
                    }
                  />
                </div>
              )}
              <input
                style={styles.input}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyUp={(e) =>
                  e.key === "Enter" && message.trim() && sendMessage()
                }
                placeholder="Message..."
              />
              {!message.trim() && (
                <>
                  <button
                    style={styles.iconButton}
                    onClick={() => fileInputRef.current.click()}
                  >
                    <FiImage />
                  </button>
                  <button
                    style={styles.iconButton}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                  >
                    <FiMic />
                  </button>
                </>
              )}
              {message.trim() && (
                <button style={styles.sendBtn} onClick={sendMessage}>
                  Send
                </button>
              )}
            </>
          ) : (
            <div style={styles.recordingBar}>
              <button
                style={styles.cancelBtn}
                onClick={() => {
                  audioChunksRef.current = [];
                  stopRecording();
                }}
              >
                ✖
              </button>
              <div style={styles.recordingWave}>🎤 Recording...</div>
              <div style={styles.timer}>{formatTime(recordTime)}</div>
              <button style={styles.sendVoiceBtn} onClick={stopRecording}>
                ➤
              </button>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            hidden
            onChange={handleImageUpload}
          />
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {fullScreenImage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            cursor: "zoom-out"
          }}
          onClick={() => setFullScreenImage(null)}
        >
          <img
            src={fullScreenImage}
            alt="Fullscreen"
            style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain", borderRadius: "8px" }}
          />
          <button
            style={{
              position: "absolute",
              top: "20px",
              right: "30px",
              background: "transparent",
              border: "none",
              color: "white",
              fontSize: "40px",
              cursor: "pointer"
            }}
            onClick={(e) => {
              e.stopPropagation();
              setFullScreenImage(null);
            }}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}

export default Chat;
