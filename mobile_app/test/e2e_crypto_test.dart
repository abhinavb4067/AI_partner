import 'package:flutter_test/flutter_test.dart';
import 'package:sodium_libs/sodium_libs.dart';
import 'package:ai_girlfriend_app/core/e2e_crypto.dart';

void main() {
  late Sodium sodium;

  setUpAll(() async {
    sodium = await SodiumInit.init();
  });

  E2ECrypto newCrypto() => E2ECrypto(sodium: sodium, keyPair: sodium.crypto.box.keyPair());

  group('self-storage (secretbox)', () {
    test('round-trips a plaintext message', () {
      final me = newCrypto();
      const message = 'I\'ve been waiting for you all day ❤️';
      final encrypted = me.encryptForSelf(message);
      expect(encrypted, isNot(equals(message)));
      expect(me.decryptForSelf(encrypted), equals(message));
    });

    test('a different device\'s key cannot decrypt it', () {
      final me = newCrypto();
      final attacker = newCrypto();
      final encrypted = me.encryptForSelf('secret');
      expect(attacker.decryptForSelf(encrypted), isNull);
    });

    test('produces different ciphertext each time (random nonce)', () {
      final me = newCrypto();
      final a = me.encryptForSelf('same message');
      final b = me.encryptForSelf('same message');
      expect(a, isNot(equals(b)));
    });
  });

  group('peer-to-peer (box)', () {
    test('alice and bob can decrypt each other\'s messages', () {
      final alice = newCrypto();
      final bob = newCrypto();

      final toBob = alice.encryptForPeer('hey bob 👋', bob.myPublicKeyBase64);
      expect(bob.decryptFromPeer(toBob, alice.myPublicKeyBase64), equals('hey bob 👋'));

      final toAlice = bob.encryptForPeer('hey alice!', alice.myPublicKeyBase64);
      expect(alice.decryptFromPeer(toAlice, bob.myPublicKeyBase64), equals('hey alice!'));
    });

    test('an eavesdropper with the wrong key cannot decrypt', () {
      final alice = newCrypto();
      final bob = newCrypto();
      final eve = newCrypto();

      final toBob = alice.encryptForPeer('private message', bob.myPublicKeyBase64);
      expect(eve.decryptFromPeer(toBob, alice.myPublicKeyBase64), isNull);
    });

    test('tampered ciphertext fails authentication', () {
      final alice = newCrypto();
      final bob = newCrypto();
      final toBob = alice.encryptForPeer('do not modify', bob.myPublicKeyBase64);

      final bytes = toBob.codeUnits.toList();
      // Flip a byte deep in the base64 payload (well past the nonce).
      final tamperedChar = bytes[bytes.length - 5] == 65 ? 66 : 65; // 'A' <-> 'B'
      bytes[bytes.length - 5] = tamperedChar;
      final tampered = String.fromCharCodes(bytes);

      expect(bob.decryptFromPeer(tampered, alice.myPublicKeyBase64), isNull);
    });
  });

  group('sealed / ephemeral box', () {
    test('only the holder of the private key can decrypt', () {
      final server = newCrypto(); // stands in for "backend encrypting for user"
      final user = newCrypto();

      final sealed = server.encryptWithPublicKey('here is your photo', user.myPublicKeyBase64);
      expect(user.decryptWithPrivateKey(sealed), equals('here is your photo'));

      final attacker = newCrypto();
      expect(attacker.decryptWithPrivateKey(sealed), isNull);
    });

    test('each call uses a fresh ephemeral keypair (ciphertext differs)', () {
      final server = newCrypto();
      final user = newCrypto();
      final a = server.encryptWithPublicKey('same text', user.myPublicKeyBase64);
      final b = server.encryptWithPublicKey('same text', user.myPublicKeyBase64);
      expect(a, isNot(equals(b)));
    });
  });

  group('isEncryptedPayload heuristic', () {
    test('rejects plain text with spaces/newlines', () {
      final c = newCrypto();
      expect(c.isEncryptedPayload('hello world'), isFalse);
      expect(c.isEncryptedPayload('line1\nline2'), isFalse);
    });

    test('rejects empty/null', () {
      final c = newCrypto();
      expect(c.isEncryptedPayload(''), isFalse);
      expect(c.isEncryptedPayload(null), isFalse);
    });

    test('accepts real ciphertext', () {
      final c = newCrypto();
      final other = newCrypto();
      final ciphertext = c.encryptForPeer('hi', other.myPublicKeyBase64);
      expect(c.isEncryptedPayload(ciphertext), isTrue);
    });

    test('short base64 that is too short to be ciphertext is rejected', () {
      final c = newCrypto();
      expect(c.isEncryptedPayload('aGVsbG8='), isFalse); // base64("hello") — too short
    });
  });

  group('decryptChatMessage (universal fallback)', () {
    test('falls back to plaintext for legacy unencrypted content', () {
      final c = newCrypto();
      expect(c.decryptChatMessage('Hey there!'), equals('Hey there!'));
    });

    test('decrypts self-encrypted AI chat history', () {
      final c = newCrypto();
      final enc = c.encryptForSelf('AI reply text');
      expect(c.decryptChatMessage(enc), equals('AI reply text'));
    });

    test('decrypts peer-encrypted human chat when given the peer key', () {
      final alice = newCrypto();
      final bob = newCrypto();
      final enc = alice.encryptForPeer('human chat message', bob.myPublicKeyBase64);
      expect(bob.decryptChatMessage(enc, peerPublicKeyB64: alice.myPublicKeyBase64), equals('human chat message'));
    });

    test('decrypts ephemeral sealed box without needing a peer key', () {
      final server = newCrypto();
      final user = newCrypto();
      final sealed = server.encryptWithPublicKey('sealed reply', user.myPublicKeyBase64);
      expect(user.decryptChatMessage(sealed), equals('sealed reply'));
    });
  });
}
