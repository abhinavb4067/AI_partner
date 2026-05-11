import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat/Chat'; // Your existing chat component
import CharacterSelection from './pages/CharacterSelection'; // New


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Redirect root to login */}
        <Route path="/" element={<Navigate to="/login" />} />
                <Route path="/select-character" element={<CharacterSelection />} />

        <Route path="/chat/:charId" element={<Chat />} />
      </Routes>
    </Router>
  );
}

export default App;