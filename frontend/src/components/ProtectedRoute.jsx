import { Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { requestFirebaseNotificationPermission, setupMessageListener } from '../firebase';

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  
  useEffect(() => {
      if (token) {
          requestFirebaseNotificationPermission();
          setupMessageListener();
      }
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;
  return children;
}

