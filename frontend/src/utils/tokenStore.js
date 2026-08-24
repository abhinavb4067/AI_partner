// Mirrors the auth token into IndexedDB so the service worker (which has no access to
// localStorage) can make authenticated requests on our behalf - e.g. rejecting a call
// when the user taps "Decline" on a system notification while the app isn't open.
const DB_NAME = 'app_auth_store';
const STORE_NAME = 'kv';
const TOKEN_KEY = 'authToken';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSetToken(token) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(token, TOKEN_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    // Non-critical: notification-bar decline just falls back to live-socket only
    console.warn('[tokenStore] Failed to persist token for service worker use', e);
  }
}

export async function idbClearToken() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(TOKEN_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    // ignore
  }
}
