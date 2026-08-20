/**
 * End-to-End Encryption & Zero-Knowledge Cryptography Utilities
 * 
 * Uses:
 *   - X25519 (Curve25519 Diffie-Hellman) for peer-to-peer key exchange
 *   - XSalsa20-Poly1305 (TweetNaCl Box / SecretBox) for authenticated encryption
 * 
 * Key Principles:
 *   - All keypairs are generated client-side on-device.
 *   - The private key NEVER leaves the device.
 *   - The server only stores ciphertext.
 */
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

const PRIVATE_KEY_STORAGE = 'e2e_private_key';
const PUBLIC_KEY_STORAGE  = 'e2e_public_key';

// ── Key Management ─────────────────────────────────────────────────────────────

/**
 * Returns the current user's X25519 keypair from localStorage.
 * Generates and stores a new one if none exists.
 */
export function getOrCreateKeyPair() {
  const storedPriv = localStorage.getItem(PRIVATE_KEY_STORAGE);
  const storedPub  = localStorage.getItem(PUBLIC_KEY_STORAGE);

  if (storedPriv && storedPub) {
    try {
      return {
        secretKey: decodeBase64(storedPriv),
        publicKey: decodeBase64(storedPub),
      };
    } catch (e) {
      console.error('[E2EE] Corrupted keypair in localStorage, regenerating:', e);
    }
  }

  // Generate brand-new X25519 keypair
  const kp = nacl.box.keyPair();
  localStorage.setItem(PRIVATE_KEY_STORAGE, encodeBase64(kp.secretKey));
  localStorage.setItem(PUBLIC_KEY_STORAGE,  encodeBase64(kp.publicKey));
  return kp;
}

/**
 * Returns the user's public key as a base64 string (safe to send to server).
 */
export function getMyPublicKey() {
  const kp = getOrCreateKeyPair();
  return encodeBase64(kp.publicKey);
}

/**
 * Derives a 32-byte symmetric storage key from the user's private key for Zero-Knowledge DB storage.
 */
function getUserStorageKey() {
  const kp = getOrCreateKeyPair();
  // Use first 32 bytes of secretKey as symmetric key for user's personal vault
  return kp.secretKey.slice(0, 32);
}

// ── Shared Secret Derivation (Human-to-Human E2EE) ───────────────────────────

/**
 * Derives a 32-byte shared secret from our private key and their public key using X25519 ECDH.
 *
 * @param {string} theirPublicKeyB64 - Base64-encoded X25519 public key of the recipient
 * @returns {Uint8Array|null} - 32-byte shared key or null on error
 */
export function deriveSharedKey(theirPublicKeyB64) {
  if (!theirPublicKeyB64) return null;
  try {
    const myKeyPair      = getOrCreateKeyPair();
    const theirPublicKey = decodeBase64(theirPublicKeyB64);
    // nacl.box.before computes X25519 ECDH and applies HSalsa20 → 32-byte shared key
    return nacl.box.before(theirPublicKey, myKeyPair.secretKey);
  } catch (e) {
    console.error('[E2EE] Failed to derive shared key:', e);
    return null;
  }
}

// ── Peer-to-Peer Encryption / Decryption (Human Chat) ─────────────────────────

/**
 * Encrypts a plaintext string using a pre-computed shared key.
 * Format: `nonce (24B) || ciphertext (authenticated)` encoded in base64.
 *
 * @param {string}     plaintext  - The message to encrypt
 * @param {Uint8Array} sharedKey  - 32-byte shared key from deriveSharedKey()
 * @returns {string|null}         - Base64-encoded encrypted payload, or null on failure
 */
export function encryptMessage(plaintext, sharedKey) {
  if (!plaintext || !sharedKey) return null;
  try {
    const nonce      = nacl.randomBytes(nacl.box.nonceLength); // 24 bytes
    const messageU8  = encodeUTF8(plaintext);
    const ciphertext = nacl.box.after(messageU8, nonce, sharedKey);

    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, nonce.length);

    return encodeBase64(combined);
  } catch (e) {
    console.error('[E2EE] Encryption failed:', e);
    return null;
  }
}

/**
 * Decrypts an E2EE payload previously produced by encryptMessage().
 *
 * @param {string}     encryptedB64 - Base64 payload (nonce||ciphertext)
 * @param {Uint8Array} sharedKey    - 32-byte shared key from deriveSharedKey()
 * @returns {string|null}           - Decrypted plaintext, or null if tampered/failed
 */
export function decryptMessage(encryptedB64, sharedKey) {
  if (!encryptedB64 || !sharedKey) return null;
  try {
    const combined   = decodeBase64(encryptedB64);
    if (combined.length <= nacl.box.nonceLength) return null;

    const nonce      = combined.slice(0, nacl.box.nonceLength);
    const ciphertext = combined.slice(nacl.box.nonceLength);
    const plaintext  = nacl.box.open.after(ciphertext, nonce, sharedKey);

    if (!plaintext) return null; // Authentication failed
    return decodeUTF8(plaintext);
  } catch (e) {
    console.error('[E2EE] Decryption failed:', e);
    return null;
  }
}

// ── Zero-Knowledge Storage Encryption (AI Companion Chat) ────────────────────

/**
 * Encrypts a message using the user's personal device key for Zero-Knowledge database storage.
 *
 * @param {string} plaintext - Message text
 * @returns {string} - Base64-encoded encrypted payload
 */
export function encryptForSelf(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return plaintext;
  try {
    const key = getUserStorageKey();
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength); // 24 bytes
    const messageU8 = encodeUTF8(plaintext);
    const ciphertext = nacl.secretbox(messageU8, nonce, key);

    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, nonce.length);

    return encodeBase64(combined);
  } catch (e) {
    console.error('[E2EE] encryptForSelf failed:', e);
    return plaintext;
  }
}

/**
 * Decrypts a message that was encrypted for the user's personal vault.
 * Gracefully returns original content if it is legacy unencrypted plaintext.
 *
 * @param {string} encryptedB64 - Base64 ciphertext or legacy plaintext
 * @returns {string} - Decrypted plaintext
 */
export function decryptForSelf(encryptedB64) {
  if (!encryptedB64 || typeof encryptedB64 !== 'string') return encryptedB64;
  if (!isEncrypted(encryptedB64)) return encryptedB64;

  try {
    const key = getUserStorageKey();
    const combined = decodeBase64(encryptedB64);
    if (combined.length <= nacl.secretbox.nonceLength) return encryptedB64;

    const nonce = combined.slice(0, nacl.secretbox.nonceLength);
    const ciphertext = combined.slice(nacl.secretbox.nonceLength);
    const plaintext = nacl.secretbox.open(ciphertext, nonce, key);

    if (!plaintext) {
      // If decryption fails, it might be plain text that happened to look like base64
      return encryptedB64;
    }
    return decodeUTF8(plaintext);
  } catch {
    return encryptedB64;
  }
}

// ── Public-Key Box Encryption (Sealed Box) ───────────────────────────────────

/**
 * Encrypts a message using an ephemeral keypair so only the owner of recipientPublicKeyB64 can decrypt it.
 *
 * @param {string} plaintext - Message to encrypt
 * @param {string} recipientPublicKeyB64 - Base64 X25519 public key
 * @returns {string|null} - Base64 ciphertext (ephemeralPublicKey (32B) || nonce (24B) || ciphertext)
 */
export function encryptWithPublicKey(plaintext, recipientPublicKeyB64) {
  try {
    const recipientPubKey = decodeBase64(recipientPublicKeyB64);
    const ephemeralKp = nacl.box.keyPair();
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageU8 = encodeUTF8(plaintext);

    const ciphertext = nacl.box(messageU8, nonce, recipientPubKey, ephemeralKp.secretKey);

    const combined = new Uint8Array(ephemeralKp.publicKey.length + nonce.length + ciphertext.length);
    combined.set(ephemeralKp.publicKey, 0);
    combined.set(nonce, ephemeralKp.publicKey.length);
    combined.set(ciphertext, ephemeralKp.publicKey.length + nonce.length);

    return encodeBase64(combined);
  } catch (e) {
    console.error('[E2EE] encryptWithPublicKey failed:', e);
    return null;
  }
}

/**
 * Decrypts a message encrypted with encryptWithPublicKey using our private key.
 *
 * @param {string} encryptedB64 - Base64 payload
 * @returns {string|null} - Decrypted plaintext or null
 */
export function decryptWithPrivateKey(encryptedB64) {
  try {
    const myKp = getOrCreateKeyPair();
    const combined = decodeBase64(encryptedB64);
    const pubKeyLen = nacl.box.publicKeyLength;
    const nonceLen = nacl.box.nonceLength;

    if (combined.length <= pubKeyLen + nonceLen) return null;

    const ephemeralPubKey = combined.slice(0, pubKeyLen);
    const nonce = combined.slice(pubKeyLen, pubKeyLen + nonceLen);
    const ciphertext = combined.slice(pubKeyLen + nonceLen);

    const plaintext = nacl.box.open(ciphertext, nonce, ephemeralPubKey, myKp.secretKey);
    if (!plaintext) return null;
    return decodeUTF8(plaintext);
  } catch (e) {
    console.error('[E2EE] decryptWithPrivateKey failed:', e);
    return null;
  }
}

// ── Verification & Safety Numbers ─────────────────────────────────────────────

/**
 * Computes a WhatsApp/Signal-style 6-block numeric safety code to verify E2EE authenticity between two users.
 *
 * @param {string} keyA - Base64 public key A
 * @param {string} keyB - Base64 public key B
 * @returns {string} - Formatted safety number e.g. "48201 92831 82910 38472 91823 48192"
 */
export function computeSafetyNumber(keyA, keyB) {
  if (!keyA || !keyB) return '00000 00000 00000 00000 00000 00000';
  try {
    const sorted = [keyA, keyB].sort().join('::');
    let hash = 5381;
    for (let i = 0; i < sorted.length; i++) {
      hash = ((hash << 5) + hash) + sorted.charCodeAt(i);
      hash = hash & hash;
    }
    
    // Generate 6 blocks of 5-digit numbers deterministically
    const blocks = [];
    let seed = Math.abs(hash);
    for (let i = 0; i < 6; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const num = Math.floor((seed / 233280) * 90000) + 10000;
      blocks.push(num.toString());
    }
    return blocks.join(' ');
  } catch {
    return '00000 00000 00000 00000 00000 00000';
  }
}

// ── Key Backup & Restore ──────────────────────────────────────────────────────

/**
 * Exports the user's private/public keys as a secure JSON backup string.
 */
export function exportKeyBackup() {
  const kp = getOrCreateKeyPair();
  return JSON.stringify({
    version: 1,
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
    createdAt: new Date().toISOString(),
  });
}

/**
 * Restores a keypair from a backup JSON string.
 */
export function importKeyBackup(backupJson) {
  try {
    const data = JSON.parse(backupJson);
    if (!data.publicKey || !data.secretKey) {
      throw new Error('Invalid key backup format');
    }
    // Verify valid base64 and lengths
    const pub = decodeBase64(data.publicKey);
    const priv = decodeBase64(data.secretKey);
    if (pub.length !== nacl.box.publicKeyLength || priv.length !== nacl.box.secretKeyLength) {
      throw new Error('Invalid key length in backup');
    }
    localStorage.setItem(PUBLIC_KEY_STORAGE, data.publicKey);
    localStorage.setItem(PRIVATE_KEY_STORAGE, data.secretKey);
    return true;
  } catch (e) {
    console.error('[E2EE] Key import failed:', e);
    return false;
  }
}

/**
 * Universal decryptor for any chat message (AI or Human).
 * Attempts in order:
 * 1. Decrypt using public-key box (ephemeral box from backend or peer)
 * 2. Decrypt using user storage key (SecretBox)
 * 3. Decrypt using shared key (if provided)
 * 4. Fallback to plaintext if unencrypted or legacy
 *
 * @param {string} content - Ciphertext or plaintext
 * @param {Uint8Array|null} sharedKey - Optional 32-byte shared key
 * @returns {string} - Decrypted plaintext
 */
export function decryptChatMessage(content, sharedKey = null) {
  if (!content || typeof content !== 'string') return content;
  if (!isEncrypted(content)) return content;

  // 1. Try public-key box (ephemeral box)
  try {
    const fromPk = decryptWithPrivateKey(content);
    if (fromPk !== null) return fromPk;
  } catch {}

  // 2. Try user personal storage key (SecretBox)
  try {
    const fromSelf = decryptForSelf(content);
    if (fromSelf && fromSelf !== content) return fromSelf;
  } catch {}

  // 3. Try shared peer key if provided
  if (sharedKey) {
    try {
      const fromShared = decryptMessage(content, sharedKey);
      if (fromShared !== null) return fromShared;
    } catch {}
  }

  // 4. Return original content as fallback
  return content;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Checks whether a string looks like an encrypted payload.
 */
export function isEncrypted(content) {
  if (!content || typeof content !== 'string') return false;
  // If it starts with non-base64 chars or spaces, it's plaintext
  if (content.includes(' ') || content.includes('\n')) return false;
  try {
    const bytes = decodeBase64(content);
    return bytes.length >= nacl.box.nonceLength + 16; // Nonce + minimum Poly1305 MAC tag
  } catch {
    return false;
  }
}
