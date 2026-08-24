// Shows a real OS/browser notification (system tray) via the service worker, even while
// the app tab is in the foreground. Firebase's onMessage() foreground handler does NOT do
// this automatically - it only delivers the payload to JS - so without this, notifications
// (calls, chat messages) only ever appeared inside the app UI.
export async function showSystemNotification(title, body, options = {}) {
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/favicon.svg',
      ...options,
    });
  } catch (e) {
    console.warn('[systemNotify] Failed to show notification', e);
  }
}
