import 'dart:convert';
import 'dart:typed_data';
import 'package:sodium_libs/sodium_libs.dart';

/// Pure E2E-encryption logic (no storage, no singleton) — ported 1:1 from the
/// web app's `utils/crypto.js`. Kept separate from [CryptoService] so it can
/// be unit-tested directly with independently generated keypairs.
///
/// Both sides use the NaCl `crypto_box` (X25519 + XSalsa20-Poly1305) and
/// `crypto_secretbox` (XSalsa20-Poly1305) constructions — tweetnacl-js on the
/// web and libsodium (via the `sodium` package) here implement the exact same
/// primitives, so ciphertext produced by one side decrypts on the other.
class E2ECrypto {
  E2ECrypto({required Sodium sodium, required KeyPair keyPair})
      : _sodium = sodium,
        _keyPair = keyPair;

  final Sodium _sodium;
  final KeyPair _keyPair;

  /// Our public key, base64-encoded — safe to send to the server / peers.
  String get myPublicKeyBase64 => base64Encode(_keyPair.publicKey);

  // ── Self-storage (Zero-Knowledge AI chat encryption) ──────────────────────

  /// Encrypts a message with our own key so only this device can read it back
  /// out of the server's database (used for AI companion chat history).
  String encryptForSelf(String plaintext) {
    final nonce = _sodium.randombytes.buf(_sodium.crypto.secretBox.nonceBytes);
    final cipherText = _sodium.crypto.secretBox.easy(
      message: Uint8List.fromList(utf8.encode(plaintext)),
      nonce: nonce,
      key: _keyPair.secretKey,
    );
    return base64Encode(Uint8List.fromList([...nonce, ...cipherText]));
  }

  /// Returns null if this isn't decryptable with our key (not necessarily an
  /// error — caller should fall back to treating it as plaintext).
  String? decryptForSelf(String encryptedB64) {
    try {
      final combined = base64Decode(encryptedB64);
      final nonceLen = _sodium.crypto.secretBox.nonceBytes;
      if (combined.length <= nonceLen) return null;
      final nonce = combined.sublist(0, nonceLen);
      final cipherText = combined.sublist(nonceLen);
      final plain = _sodium.crypto.secretBox.openEasy(
        cipherText: Uint8List.fromList(cipherText),
        nonce: Uint8List.fromList(nonce),
        key: _keyPair.secretKey,
      );
      return utf8.decode(plain);
    } catch (_) {
      return null;
    }
  }

  // ── Peer-to-peer (human-to-human chat) ────────────────────────────────────

  /// Encrypts for a specific peer given their base64 X25519 public key.
  /// Format: `nonce(24) || ciphertext`, base64 — matches the web app.
  String encryptForPeer(String plaintext, String theirPublicKeyB64) {
    final theirPk = base64Decode(theirPublicKeyB64);
    final box = _sodium.crypto.box.precalculate(publicKey: theirPk, secretKey: _keyPair.secretKey);
    try {
      final nonce = _sodium.randombytes.buf(_sodium.crypto.box.nonceBytes);
      final cipherText = box.easy(message: Uint8List.fromList(utf8.encode(plaintext)), nonce: nonce);
      return base64Encode(Uint8List.fromList([...nonce, ...cipherText]));
    } finally {
      box.dispose();
    }
  }

  String? decryptFromPeer(String encryptedB64, String theirPublicKeyB64) {
    try {
      final theirPk = base64Decode(theirPublicKeyB64);
      final combined = base64Decode(encryptedB64);
      final nonceLen = _sodium.crypto.box.nonceBytes;
      if (combined.length <= nonceLen) return null;
      final nonce = combined.sublist(0, nonceLen);
      final cipherText = combined.sublist(nonceLen);
      final box = _sodium.crypto.box.precalculate(publicKey: theirPk, secretKey: _keyPair.secretKey);
      try {
        final plain = box.openEasy(cipherText: Uint8List.fromList(cipherText), nonce: Uint8List.fromList(nonce));
        return utf8.decode(plain);
      } finally {
        box.dispose();
      }
    } catch (_) {
      return null;
    }
  }

  // ── Sealed / ephemeral box (server -> user delivery, e.g. AI photo replies) ─

  /// Encrypts with a throwaway keypair so only the holder of [recipientPublicKeyB64]
  /// can decrypt. Format: `ephemeralPublicKey(32) || nonce(24) || ciphertext`.
  String encryptWithPublicKey(String plaintext, String recipientPublicKeyB64) {
    final recipientPk = base64Decode(recipientPublicKeyB64);
    final ephemeral = _sodium.crypto.box.keyPair();
    final nonce = _sodium.randombytes.buf(_sodium.crypto.box.nonceBytes);
    final cipherText = _sodium.crypto.box.easy(
      message: Uint8List.fromList(utf8.encode(plaintext)),
      nonce: nonce,
      publicKey: recipientPk,
      secretKey: ephemeral.secretKey,
    );
    ephemeral.secretKey.dispose();
    return base64Encode(Uint8List.fromList([...ephemeral.publicKey, ...nonce, ...cipherText]));
  }

  String? decryptWithPrivateKey(String encryptedB64) {
    try {
      final combined = base64Decode(encryptedB64);
      const pubKeyLen = 32;
      final nonceLen = _sodium.crypto.box.nonceBytes;
      if (combined.length <= pubKeyLen + nonceLen) return null;

      final ephemeralPk = combined.sublist(0, pubKeyLen);
      final nonce = combined.sublist(pubKeyLen, pubKeyLen + nonceLen);
      final cipherText = combined.sublist(pubKeyLen + nonceLen);

      final plain = _sodium.crypto.box.openEasy(
        cipherText: Uint8List.fromList(cipherText),
        nonce: Uint8List.fromList(nonce),
        publicKey: Uint8List.fromList(ephemeralPk),
        secretKey: _keyPair.secretKey,
      );
      return utf8.decode(plain);
    } catch (_) {
      return null;
    }
  }

  // ── Universal decrypt / helpers ───────────────────────────────────────────

  /// Tries every known scheme in turn; returns the original string untouched
  /// if none apply (legacy plaintext, or not actually encrypted).
  String decryptChatMessage(String content, {String? peerPublicKeyB64}) {
    if (!isEncryptedPayload(content)) return content;

    final fromEphemeral = decryptWithPrivateKey(content);
    if (fromEphemeral != null) return fromEphemeral;

    final fromSelf = decryptForSelf(content);
    if (fromSelf != null) return fromSelf;

    if (peerPublicKeyB64 != null) {
      final fromPeer = decryptFromPeer(content, peerPublicKeyB64);
      if (fromPeer != null) return fromPeer;
    }

    return content;
  }

  /// Heuristic check mirroring the web app's `isEncrypted()`.
  bool isEncryptedPayload(String? content) {
    if (content == null || content.isEmpty) return false;
    if (content.contains(' ') || content.contains('\n')) return false;
    try {
      final bytes = base64Decode(content);
      return bytes.length >= _sodium.crypto.box.nonceBytes + 16;
    } catch (_) {
      return false;
    }
  }
}
