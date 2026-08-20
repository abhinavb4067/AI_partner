import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import API from "./api/api";

const firebaseConfig = {
  apiKey: "AIzaSyARYknvIDXpWVal-l5OWmz0LQb0j1rV9Yc",
  authDomain: "avoiga.firebaseapp.com",
  projectId: "avoiga",
  storageBucket: "avoiga.firebasestorage.app",
  messagingSenderId: "862105827140",
  appId: "1:862105827140:web:4d2560016168f40db0c911",
  measurementId: "G-NDQYZK3RFG"
};

export const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

export const requestFirebaseNotificationPermission = async () => {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('Push notifications not supported on this browser');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const token = await getToken(messaging, { 
        serviceWorkerRegistration: registration,
      });

      if (token) {
        console.log("✅ [FCM] Acquired valid Token:", token);
        // Send token to our backend
        await API.post('/api/profile/fcm-token', { fcm_token: token });
        return token;
      }
    } else {
      console.warn("Notification permission was not granted:", permission);
    }
  } catch (error) {
    console.error("Firebase permission error:", error);
  }
  return null;
};

export const setupMessageListener = (onMessageCallback) => {
    return onMessage(messaging, (payload) => {
        console.log("Message received. ", payload);
        if(onMessageCallback) onMessageCallback(payload);
    });
};
