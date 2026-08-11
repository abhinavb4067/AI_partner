importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
  apiKey: "AIzaSyARYknvIDXpWVal-l5OWmz0LQb0j1rV9Yc",
  authDomain: "avoiga.firebaseapp.com",
  projectId: "avoiga",
  storageBucket: "avoiga.firebasestorage.app",
  messagingSenderId: "862105827140",
  appId: "1:862105827140:web:4d2560016168f40db0c911"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const data = event.notification.data;
  
  // If it's a call, open the chat page
  if (data && data.type === 'call') {
      event.waitUntil(
          clients.openWindow('/social/chat/' + data.caller_id)
      );
  } else if (data && data.type === 'chat') {
      event.waitUntil(
          clients.openWindow('/social/chat/' + data.sender_id)
      );
  } else {
      event.waitUntil(
          clients.openWindow('/')
      );
  }
});
