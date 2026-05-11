import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import API from "../../api/api";
import styles from "./ChatStyles";
import EmojiPicker from "emoji-picker-react";
import { FiImage, FiMic, FiSmile } from "react-icons/fi";

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

  // ✅ Fetch Chat History on Load
  useEffect(() => {
    const fetchHistory = async () => {
      if (loggedInUserId && charId) {
        try {
          const encodedUserId = encodeURIComponent(loggedInUserId);
          const res = await API.get(`/api/chat/history/${encodedUserId}/${charId}`);
          setChat(res.data);
        } catch (err) {
          console.error("Failed to load chat history:", err);
        }
      }
    };
    fetchHistory();
  }, [loggedInUserId, charId]);

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
            <div style={styles.avatar}></div>
            <div>
              <div style={styles.name}>{charName}</div>
              <div style={{ fontSize: "10px", color: "#00ff00" }}>Online</div>
            </div>
          </div>
        </div>

        {/* MESSAGES */}
        <div style={styles.messages}>
          {chat.map((msg, i) => (
            <div
              key={i}
              style={{
                ...styles.message,
                alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                backgroundColor: msg.sender === "user" ? "#0095f6" : "#efefef",
                color: msg.sender === "user" ? "#fff" : "#000",
              }}
            >
              {msg.type === "text" && msg.text}
              {msg.type === "image" && (
                <img
                  src={msg.url}
                  alt="Shared"
                  style={{ ...styles.image, cursor: "pointer" }}
                  onClick={() => setFullScreenImage(msg.url)}
                  onError={(e) => {
                    // If image fails to load, try again after 2 seconds
                    if (!e.target.dataset.retried) {
                      e.target.dataset.retried = "true";
                      setTimeout(() => {
                        const currentSrc = e.target.src;
                        e.target.src = ""; // Clear
                        e.target.src = currentSrc; // Reload
                      }, 2000);
                    }
                  }}
                />
              )}
              {msg.type === "audio" && (
                <audio controls src={msg.url} style={styles.audio} />
              )}
            </div>
          ))}
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
