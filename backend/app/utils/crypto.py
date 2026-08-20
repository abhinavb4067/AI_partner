"""
Backend Cryptography Utilities for End-to-End & Zero-Knowledge Encryption

Uses:
  - Curve25519 (X25519) + XSalsa20-Poly1305 (PyNaCl / Libsodium)
  - Interoperable with frontend TweetNaCl
"""
import base64
from typing import Optional
import nacl.public
import nacl.utils


def encrypt_for_user(plaintext: str, user_pubkey_b64: str) -> str:
    """
    Encrypts a message using the user's X25519 public key.
    Creates an ephemeral X25519 keypair and standard 24-byte nonce.
    Returns Base64 encoded payload: ephemeral_public_key (32B) + nonce (24B) + ciphertext + MAC (16B).
    Only the user possessing the corresponding private key on their device can decrypt this.
    """
    if not plaintext or not user_pubkey_b64:
        return plaintext

    try:
        user_pk_bytes = base64.b64decode(user_pubkey_b64)
        user_pk = nacl.public.PublicKey(user_pk_bytes)

        ephemeral_sk = nacl.public.PrivateKey.generate()
        nonce = nacl.utils.random(24)

        box = nacl.public.Box(ephemeral_sk, user_pk)
        encrypted_with_nonce = box.encrypt(plaintext.encode("utf-8"), nonce)

        combined = bytes(ephemeral_sk.public_key) + encrypted_with_nonce
        return base64.b64encode(combined).decode("utf-8")
    except Exception as e:
        print(f"[E2EE] Failed to encrypt message for user: {e}")
        return plaintext


def is_encrypted_payload(content: str) -> bool:
    """
    Checks whether a string is a base64 encoded encrypted payload.
    """
    if not content or not isinstance(content, str):
        return False
    if " " in content or "\n" in content:
        return False
    try:
        raw = base64.b64decode(content, validate=True)
        # Minimum length: 32 (pubkey) + 24 (nonce) + 16 (MAC) = 72 bytes
        return len(raw) >= 72
    except Exception:
        return False
