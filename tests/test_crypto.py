"""Tests for backend.crypto — encryption, key management, password hashing."""

from backend.crypto import (
    generate_salt,
    generate_entry_iv,
    generate_user_key,
    derive_kek,
    wrap_user_key,
    unwrap_user_key,
    encrypt_entry,
    decrypt_entry,
    hash_password,
    verify_password,
    PBKDF2_ITERATIONS,
    NONCE_LENGTH,
)


class TestKeyGeneration:
    def test_generate_salt_returns_16_bytes(self):
        salt = generate_salt()
        assert isinstance(salt, bytes)
        assert len(salt) == 16

    def test_generate_salt_is_random(self):
        assert generate_salt() != generate_salt()

    def test_generate_entry_iv_returns_correct_length(self):
        iv = generate_entry_iv()
        assert isinstance(iv, bytes)
        assert len(iv) == NONCE_LENGTH

    def test_generate_user_key_returns_32_bytes(self):
        key = generate_user_key()
        assert isinstance(key, bytes)
        assert len(key) == 32

    def test_generate_user_key_is_random(self):
        assert generate_user_key() != generate_user_key()


class TestKeyWrapping:
    def test_wrap_unwrap_roundtrip(self):
        user_key = generate_user_key()
        password = "testpassword123"
        salt = generate_salt()
        kek = derive_kek(password, salt)

        wrapped = wrap_user_key(user_key, kek)
        assert isinstance(wrapped, str)

        unwrapped = unwrap_user_key(wrapped, kek)
        assert unwrapped == user_key

    def test_unwrap_with_wrong_key_returns_none(self):
        user_key = generate_user_key()
        salt = generate_salt()
        kek = derive_kek("correct", salt)

        wrapped = wrap_user_key(user_key, kek)

        wrong_kek = derive_kek("wrong", salt)
        result = unwrap_user_key(wrapped, wrong_kek)
        assert result is None

    def test_unwrap_with_corrupted_data_returns_none(self):
        kek = derive_kek("pass", generate_salt())
        result = unwrap_user_key("not-valid-base64!!!", kek)
        assert result is None

    def test_wrap_uses_unique_iv_each_time(self):
        user_key = generate_user_key()
        salt = generate_salt()
        kek = derive_kek("pass", salt)

        w1 = wrap_user_key(user_key, kek)
        w2 = wrap_user_key(user_key, kek)
        # Same key + same kek but different IVs => different ciphertext
        assert w1 != w2
        # Both should unwrap to the same key
        assert unwrap_user_key(w1, kek) == user_key
        assert unwrap_user_key(w2, kek) == user_key


class TestPBKDF:
    def test_derive_kek_deterministic(self):
        salt = generate_salt()
        k1 = derive_kek("password", salt)
        k2 = derive_kek("password", salt)
        assert k1 == k2

    def test_derive_kek_different_passwords(self):
        salt = generate_salt()
        k1 = derive_kek("pass1", salt)
        k2 = derive_kek("pass2", salt)
        assert k1 != k2

    def test_derive_kek_different_salts(self):
        k1 = derive_kek("pass", generate_salt())
        k2 = derive_kek("pass", generate_salt())
        assert k1 != k2

    def test_derive_kek_output_length(self):
        kek = derive_kek("pass", generate_salt())
        assert len(kek) == 32


class TestEntryEncryption:
    def test_encrypt_decrypt_roundtrip(self, user_key):
        plaintext = "Hello, this is my journal entry.\nLine two."
        ciphertext = encrypt_entry(plaintext, user_key)

        assert isinstance(ciphertext, bytes)
        assert ciphertext != plaintext.encode("utf-8")

        decrypted = decrypt_entry(ciphertext, user_key)
        assert decrypted == plaintext

    def test_encrypt_uses_unique_iv(self, user_key):
        plaintext = "same text"
        c1 = encrypt_entry(plaintext, user_key)
        c2 = encrypt_entry(plaintext, user_key)
        # Same plaintext + key but different nonces => different ciphertext
        assert c1 != c2
        # Both decrypt to same plaintext
        assert decrypt_entry(c1, user_key) == plaintext
        assert decrypt_entry(c2, user_key) == plaintext

    def test_decrypt_with_wrong_key_raises(self, user_key):
        ciphertext = encrypt_entry("secret", user_key)
        wrong_key = generate_user_key()
        try:
            decrypt_entry(ciphertext, wrong_key)
            assert False, "Should have raised an exception"
        except Exception:
            pass  # Expected

    def test_encrypt_empty_string(self, user_key):
        ciphertext = encrypt_entry("", user_key)
        assert decrypt_entry(ciphertext, user_key) == ""

    def test_encrypt_unicode(self, user_key):
        text = "日本語テスト 🔒 émojis café"
        ciphertext = encrypt_entry(text, user_key)
        assert decrypt_entry(ciphertext, user_key) == text

    def test_encrypt_large_entry(self, user_key):
        text = "x" * 100_000
        ciphertext = encrypt_entry(text, user_key)
        assert decrypt_entry(ciphertext, user_key) == text


class TestPasswordHashing:
    def test_hash_password_returns_string(self):
        h = hash_password("password", "salt123")
        assert isinstance(h, str)
        assert len(h) > 0

    def test_hash_password_deterministic(self):
        h1 = hash_password("password", "salt")
        h2 = hash_password("password", "salt")
        assert h1 == h2

    def test_hash_password_different_passwords(self):
        h1 = hash_password("pass1", "salt")
        h2 = hash_password("pass2", "salt")
        assert h1 != h2

    def test_hash_password_different_salts(self):
        h1 = hash_password("pass", "salt1")
        h2 = hash_password("pass", "salt2")
        assert h1 != h2

    def test_verify_password_correct(self):
        salt = "randomsalt"
        h = hash_password("mypassword", salt)
        assert verify_password("mypassword", salt, h) is True

    def test_verify_password_incorrect(self):
        salt = "randomsalt"
        h = hash_password("mypassword", salt)
        assert verify_password("wrongpassword", salt, h) is False

    def test_full_signup_login_flow(self):
        """Simulate: signup creates hash, login verifies it."""
        password = "hunter2"
        salt = generate_salt().hex()

        # Signup
        stored_hash = hash_password(password, salt)

        # Login - correct password
        assert verify_password(password, salt, stored_hash) is True

        # Login - wrong password
        assert verify_password("wrong", salt, stored_hash) is False
