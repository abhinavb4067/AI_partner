import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('user_id', data.user_id);
        localStorage.setItem('user_name', data.name);
        navigate('/select-character'); // ✅ Redirect to character selection
      } else {
        alert(data.detail);
      }
    } catch (err) {
      alert("Login Connection Failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-lg shadow-xl w-80 space-y-4">
        <h2 className="text-2xl font-bold text-center text-pink-500">Welcome Back</h2>
        <input type="email" placeholder="Email" className="w-full p-2 rounded bg-gray-700" 
          onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" className="w-full p-2 rounded bg-gray-700" 
          onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" className="w-full bg-pink-600 hover:bg-pink-700 p-2 rounded font-bold">
          Login
        </button>
        <p className="text-sm text-center cursor-pointer text-gray-400" onClick={() => navigate('/register')}>
          Don't have an account? <span className="text-pink-400">Sign Up</span>
        </p>
      </form>
    </div>
  );
};

export default Login;