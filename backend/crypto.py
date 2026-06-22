import os
import json
import secrets
from base64 import b64encode, b64decode
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

PBKDF2_ITERATIONS = 600_000
PBKDF2_LENGTH = 32
NONCE_LENGTH = 12


def generate_salt() -> bytes:
    return secrets.token_bytes(16)


def generate_entry_iv() -> bytes:
    return secrets.token_bytes(NONCE_LENGTH)


def generate_user_key() -> bytes:
    return AESGCM.generate_key(bit_length=256)


def derive_kek(secret: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=PBKDF2_LENGTH,
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
        backend=default_backend(),
    )
    return kdf.derive(secret.encode("utf-8"))


def wrap_user_key(user_key: bytes, kek: bytes) -> str:
    aesgcm = AESGCM(kek)
    iv = secrets.token_bytes(NONCE_LENGTH)
    ct = aesgcm.encrypt(iv, user_key, None)
    return b64encode(iv + ct).decode("utf-8")


def unwrap_user_key(wrapped: str, kek: bytes) -> bytes | None:
    try:
        raw = b64decode(wrapped.encode("utf-8"))
        iv = raw[:NONCE_LENGTH]
        ct = raw[NONCE_LENGTH:]
        aesgcm = AESGCM(kek)
        return aesgcm.decrypt(iv, ct, None)
    except Exception:
        return None


def encrypt_entry(plaintext: str, user_key: bytes) -> bytes:
    iv = generate_entry_iv()
    aesgcm = AESGCM(user_key)
    ct = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
    return iv + ct


def decrypt_entry(ciphertext: bytes, user_key: bytes) -> str:
    iv = ciphertext[:NONCE_LENGTH]
    ct = ciphertext[NONCE_LENGTH:]
    aesgcm = AESGCM(user_key)
    plaintext = aesgcm.decrypt(iv, ct, None)
    return plaintext.decode("utf-8")


def hash_password(password: str, salt: str) -> str:
    import hashlib
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
    return b64encode(dk).decode("utf-8")


def verify_password(password: str, salt: str, stored_hash: str) -> bool:
    return hash_password(password, salt) == stored_hash
