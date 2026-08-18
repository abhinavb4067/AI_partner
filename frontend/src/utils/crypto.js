/**
 * End-to-End Encryption Utilities
 * 
 * Uses:
 *   - X25519 (Curve25519 Diffie-Hellman) for key exchange
 *   - XSalsa20-Poly1305 for symmetric authenticated encryption
 * 
 * All keys are generated on-device and the private key NEVER leaves the device.
 * The server only stores ciphertext + the user's public key.
 */
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

const PRIVATE_KEY_STORAGE = 'e2e_private_key';
const PUBLIC_KEY_STORAGE  = 'e2e_public_key';

// ── Key Management ─────────────────────────────────────────────────────────────

/**
 * Returns the current user's keypair from localStorage.
 * Generates a new one if none exists.
 */
export function getOrCreateKeyPair() {
  const storedPriv = localStorage.getItem(PRIVATE_KEY_STORAGE);
  const storedPub  = localStorage.getItem(PUBLIC_KEY_STORAGE);

  if (storedPriv && storedPub) {
    return {
      secretKey: decodeBase64(storedPriv),
      publicKey: decodeBase64(storedPub),
    };
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

// ── Shared Secret Derivation ────────────────────────────────────────────────────

/**
 * Derives a 32-byte shared secret from our private key and their public key.
 * Both sides compute the same secret without ever transmitting it.
 *
 * @param {string} theirPublicKeyB64 - Base64-encoded X25519 public key of the recipient
 * @returns {Uint8Array} - 32-byte shared key
 */
export function deriveSharedKey(theirPublicKeyB64) {
  try {
    const myKeyPair     = getOrCreateKeyPair();
    const theirPublicKey = decodeBase64(theirPublicKeyB64);
    // nacl.box.before computes X25519 ECDH and applies HSalsa20 → 32-byte key
    return nacl.box.before(theirPublicKey, myKeyPair.secretKey);
  } catch (e) {
    console.error('[E2EE] Failed to derive shared key:', e);
    return null;
  }
}

// ── Encryption / Decryption ────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string using a pre-computed shared key.
 * Returns a base64 string of the format: `nonce||ciphertext` (both concatenated).
 *
 * @param {string}     plaintext  - The message to encrypt
 * @param {Uint8Array} sharedKey  - 32-byte shared key from deriveSharedKey()
 * @returns {string|null}         - Base64-encoded encrypted payload, or null on failure
 */
export function encryptMessage(plaintext, sharedKey) {
  try {
    const nonce      = nacl.randomBytes(nacl.box.nonceLength); // 24 bytes
    const messageU8  = encodeUTF8(plaintext);
    const ciphertext = nacl.box.after(messageU8, nonce, sharedKey);

    // Concatenate nonce + ciphertext into one payload
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
  try {
    const combined   = decodeBase64(encryptedB64);
    const nonce      = combined.slice(0, nacl.box.nonceLength);
    const ciphertext = combined.slice(nacl.box.nonceLength);
    const plaintext  = nacl.box.open.after(ciphertext, nonce, sharedKey);

    if (!plaintext) return null; // Authentication failed (tampered/wrong key)
    return decodeUTF8(plaintext);
  } catch (e) {
    console.error('[E2EE] Decryption failed:', e);
    return null;
  }
}

/**
 * Checks whether a string looks like an E2EE-encrypted payload.
 * (Heuristic: valid base64, length > 40 bytes after decode.)
 */
export function isEncrypted(content) {
  if (!content || typeof content !== 'string') return false;
  try {
    const bytes = decodeBase64(content);
    return bytes.length > nacl.box.nonceLength + 1;
  } catch {
    return false;
  }
}
