import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sodium_libs/sodium_libs.dart';
import 'e2e_crypto.dart';

/// App-wide singleton that owns the on-device keypair (persisted via secure
/// storage) and exposes it through [E2ECrypto] — see e2e_crypto.dart for the
/// actual cryptography and its unit tests.
class CryptoService {
  CryptoService._();
  static final CryptoService instance = CryptoService._();

  static const _storage = FlutterSecureStorage();
  static const _privKeyStorageKey = 'e2e_private_key';
  static const _pubKeyStorageKey = 'e2e_public_key';

  late E2ECrypto _crypto;
  bool _ready = false;

  bool get isReady => _ready;

  /// Call once at app startup (after [Session.restore]). Generates a fresh
  /// X25519 keypair on first run, or restores the persisted one.
  Future<void> init() async {
    if (_ready) return;
    final sodium = await SodiumInit.init();

    final storedPriv = await _storage.read(key: _privKeyStorageKey);
    final storedPub = await _storage.read(key: _pubKeyStorageKey);

    KeyPair keyPair;
    if (storedPriv != null && storedPub != null) {
      try {
        keyPair = KeyPair(
          publicKey: base64Decode(storedPub),
          secretKey: SecureKey.fromList(sodium, base64Decode(storedPriv)),
        );
        _crypto = E2ECrypto(sodium: sodium, keyPair: keyPair);
        _ready = true;
        return;
      } catch (_) {
        // Corrupted — fall through and regenerate.
      }
    }

    keyPair = sodium.crypto.box.keyPair();
    final secretBytes = keyPair.secretKey.extractBytes();
    await _storage.write(key: _privKeyStorageKey, value: base64Encode(secretBytes));
    await _storage.write(key: _pubKeyStorageKey, value: base64Encode(keyPair.publicKey));
    _crypto = E2ECrypto(sodium: sodium, keyPair: keyPair);
    _ready = true;
  }

  String get myPublicKeyBase64 => _crypto.myPublicKeyBase64;

  String encryptForSelf(String plaintext) => _crypto.encryptForSelf(plaintext);
  String? decryptForSelf(String encryptedB64) => _crypto.decryptForSelf(encryptedB64);

  String encryptForPeer(String plaintext, String theirPublicKeyB64) =>
      _crypto.encryptForPeer(plaintext, theirPublicKeyB64);
  String? decryptFromPeer(String encryptedB64, String theirPublicKeyB64) =>
      _crypto.decryptFromPeer(encryptedB64, theirPublicKeyB64);

  String encryptWithPublicKey(String plaintext, String recipientPublicKeyB64) =>
      _crypto.encryptWithPublicKey(plaintext, recipientPublicKeyB64);
  String? decryptWithPrivateKey(String encryptedB64) => _crypto.decryptWithPrivateKey(encryptedB64);

  String decryptChatMessage(String content, {String? peerPublicKeyB64}) =>
      _crypto.decryptChatMessage(content, peerPublicKeyB64: peerPublicKeyB64);

  bool isEncryptedPayload(String? content) => _crypto.isEncryptedPayload(content);
}
