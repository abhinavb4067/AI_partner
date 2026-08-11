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
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // You should replace vapidKey with your actual public VAPID key from Firebase Console -> Project Settings -> Cloud Messaging -> Web configuration
      const token = await getToken(messaging, { 
          // vapidKey: "YOUR_PUBLIC_VAPID_KEY_HERE" 
      });
      if (token) {
        console.log("FCM Token:", token);
        // Send token to our backend
        await API.post('/api/profile/fcm-token', { fcm_token: token });
      }
    }
  } catch (error) {
    console.error("Firebase permission error:", error);
  }
};

export const setupMessageListener = (onMessageCallback) => {
    return onMessage(messaging, (payload) => {
        console.log("Message received. ", payload);
        if(onMessageCallback) onMessageCallback(payload);
    });
};
