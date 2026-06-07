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
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  avatar: {
    width: "35px",
    height: "35px",
    borderRadius: "50%",
    backgroundColor: "#ddd",
  },

  name: {
    fontWeight: "600",
    fontSize: "14px",
  },

  username: {
    fontSize: "12px",
    color: "#888",
  },

  headerIcons: {
    fontSize: "18px",
  },

  messages: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "10px",
    gap: "8px",
    overflowY: "auto",
  },

message: {
  maxWidth: "70%",
  padding: "10px 14px",
  borderRadius: "18px",
  fontSize: "14px",
},

  inputBox: {
    display: "flex",
    alignItems: "center",
    padding: "10px",
    borderTop: "1px solid #dbdbdb",
    gap: "8px",
     position: "relative",
  },

 input: {
  flex: 1,
  padding: "10px",
  borderRadius: "20px",
  border: "1px solid #dbdbdb",
  backgroundColor: "#fafafa",
  color: "#000",        // ✅ ADD THIS (VERY IMPORTANT)
  outline: "none",
},

  iconButton: {
    border: "none",
    background: "none",
    fontSize: "18px",
    cursor: "pointer",
  },

  sendBtn: {
    border: "none",
    background: "none",
    color: "#0095f6",
    fontWeight: "600",
    cursor: "pointer",
  },

  image: {
    maxWidth: "200px",
    borderRadius: "10px",
  },
  iconButton: {
  border: "none",
  background: "none",
  fontSize: "20px",   // slightly bigger
  cursor: "pointer",
  color: "#555",
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
  maxWidth: "220px",   // ✅ limit size (important)
},

audio: {
  width: "180px",      // ✅ fixed compact width
  height: "35px",
  borderRadius: "20px",
},

};

export default styles;