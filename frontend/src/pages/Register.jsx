import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '', email: '', age: '', password: '', confirmPass: ''
  });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPass) {
      alert("Passwords do not match!");
      return;
    }

    try {
      const res = await fetch('http://localhost:8000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          age: parseInt(formData.age),
          password: formData.password
        }),
      });
      if (res.ok) {
        alert("Registration Successful!");
        navigate('/login');
      }
    } catch (err) {
      console.error("Signup failed", err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded-lg shadow-xl w-96 space-y-4">
        <h2 className="text-2xl font-bold text-center text-pink-500">Join Maya AI</h2>
        <input type="text" placeholder="Full Name" required className="w-full p-2 rounded bg-gray-700" 
          onChange={(e) => setFormData({...formData, name: e.target.value})} />
        <input type="email" placeholder="Email ID" required className="w-full p-2 rounded bg-gray-700" 
          onChange={(e) => setFormData({...formData, email: e.target.value})} />
        <input type="number" placeholder="Age" required className="w-full p-2 rounded bg-gray-700" 
          onChange={(e) => setFormData({...formData, age: e.target.value})} />
        <input type="password" placeholder="Password" required className="w-full p-2 rounded bg-gray-700" 
          onChange={(e) => setFormData({...formData, password: e.target.value})} />
        <input type="password" placeholder="Confirm Password" required className="w-full p-2 rounded bg-gray-700" 
          onChange={(e) => setFormData({...formData, confirmPass: e.target.value})} />
        <button type="submit" className="w-full bg-pink-600 hover:bg-pink-700 p-2 rounded font-bold transition">
          Create Account
        </button>
      </form>
    </div>
  );
};

export default Register;