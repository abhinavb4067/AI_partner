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
  
  const data = payload.data || {};
  const isCall = data.type === 'call';
  const isMissedCall = data.type === 'missed_call';

  const callerId = data.caller_id || '';
  const callerName = data.caller_name || 'Someone';

  let notificationTitle = payload.notification?.title;
  let notificationBody = payload.notification?.body;
  let actions = [];

  if (isCall) {
    notificationTitle = notificationTitle || "Incoming Call";
    notificationBody = notificationBody || `${callerName} is calling you...`;
    actions = [
      { action: 'answer', title: '📞 Answer' },
      { action: 'decline', title: '❌ Decline' }
    ];
  } else if (isMissedCall) {
    notificationTitle = "📞 Missed Call";
    notificationBody = `You missed a call from ${callerName}`;
    actions = [
      { action: 'call_back', title: '📞 Call Back' },
      { action: 'view_chat', title: '💬 View Chat' }
    ];
    
    // Close any previous ringing notification for this caller
    self.registration.getNotifications({ tag: 'incoming_call_' + callerId }).then(function(notifications) {
      notifications.forEach(function(n) { n.close(); });
    });
  } else {
    notificationTitle = notificationTitle || "New Message";
    notificationBody = notificationBody || "You have a new message";
  }

  const notificationOptions = {
    body: notificationBody,
    icon: '/icon-192.png',
    badge: '/favicon.svg',
    tag: isCall ? ('incoming_call_' + callerId) : isMissedCall ? ('missed_call_' + callerId) : 'chat_notification',
    renotify: true,
    requireInteraction: isCall, // Keep ringing on screen until answered/dismissed
    vibrate: isCall
      ? [500, 250, 500, 250, 500, 250, 500, 250, 500, 250, 1000] // Rhythmic call vibration
      : isMissedCall
        ? [300, 100, 300]
        : [200, 100, 200],
    actions: actions,
    data: data
  };

  // Broadcast to any open tabs so they can trigger sound or UI update immediately
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
    for (let i = 0; i < clientList.length; i++) {
      clientList[i].postMessage({
        type: isCall ? 'INCOMING_CALL' : isMissedCall ? 'MISSED_CALL' : 'NEW_MESSAGE',
        payload: payload
      });
    }
  });

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action;

  if (action === 'decline') {
    // User declined call from notification
    return;
  }

  let targetUrl = '/';

  if (data.type === 'call') {
    targetUrl = '/social/chat/' + data.caller_id + (action === 'answer' ? '?auto_accept=true' : '');
  } else if (data.type === 'missed_call') {
    targetUrl = '/social/chat/' + data.caller_id + (action === 'call_back' ? '?start_call=true' : '');
  } else if (data.type === 'chat') {
    targetUrl = '/social/chat/' + data.sender_id;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
