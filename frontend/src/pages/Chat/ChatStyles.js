const styles = {
  container: {
    height: "100vh",
    backgroundColor: "#fff",
    display: "flex",
    flexDirection: "row",
    overflow: "hidden",
    position: "relative",
  },

  chatBox: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 15px",
    borderBottom: "1px solid #dbdbdb",
    background: "#fff",
    zIndex: 10,
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  avatar: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    backgroundColor: "#ddd",
  },

  name: {
    fontWeight: "600",
    fontSize: "14px",
    color: "#000",
  },

  username: {
    fontSize: "12px",
    color: "#888",
  },

  headerIcons: {
    fontSize: "18px",
  },

  e2eeBadge: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 10px",
    borderRadius: "16px",
    background: "rgba(0, 168, 132, 0.1)",
    border: "1px solid rgba(0, 168, 132, 0.25)",
    color: "#00a884",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background 0.2s",
  },

  e2eeBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "7px 16px",
    background: "#f0fdf4",
    borderBottom: "1px solid #dcfce7",
    color: "#15803d",
    fontSize: "11px",
    fontWeight: "500",
    textAlign: "center",
  },

  messages: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "10px 14px",
    gap: "8px",
    overflowY: "auto",
  },

  message: {
    maxWidth: "70%",
    padding: "10px 14px",
    borderRadius: "18px",
    fontSize: "14px",
    position: "relative",
    wordBreak: "break-word",
  },

  inputBox: {
    display: "flex",
    alignItems: "center",
    padding: "10px 14px",
    borderTop: "1px solid #dbdbdb",
    gap: "8px",
    position: "relative",
    background: "#fff",
  },

  input: {
    flex: 1,
    padding: "11px 16px",
    borderRadius: "22px",
    border: "1px solid #dbdbdb",
    backgroundColor: "#fafafa",
    color: "#000",
    outline: "none",
    fontSize: "14px",
  },

  iconButton: {
    border: "none",
    background: "none",
    fontSize: "20px",
    cursor: "pointer",
    color: "#555",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px",
  },

  sendBtn: {
    border: "none",
    background: "none",
    color: "#0095f6",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "15px",
    padding: "4px 8px",
  },

  image: {
    maxWidth: "240px",
    borderRadius: "10px",
  },

  recordingBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "8px 10px",
    background: "linear-gradient(90deg, #6a7cff, #4b5cff)",
    borderRadius: "25px",
    color: "white",
  },

  cancelBtn: {
    border: "none",
    background: "#1e90ff",
    color: "white",
    borderRadius: "50%",
    width: "30px",
    height: "30px",
    cursor: "pointer",
  },

  recordingWave: {
    flex: 1,
    textAlign: "center",
    fontSize: "14px",
  },

  timer: {
    background: "white",
    color: "#333",
    borderRadius: "15px",
    padding: "2px 8px",
    fontSize: "12px",
  },

  sendVoiceBtn: {
    border: "none",
    background: "#1e90ff",
    color: "white",
    borderRadius: "50%",
    width: "35px",
    height: "35px",
    cursor: "pointer",
  },

  audioWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    maxWidth: "220px",
  },

  audio: {
    width: "180px",
    height: "35px",
    borderRadius: "20px",
  },
};

export default styles;