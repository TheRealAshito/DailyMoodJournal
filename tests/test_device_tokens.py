"""Tests for the remembered-device token store (backend.device_tokens).

Device model:
- One device record per browser/device (id + secret), holding one entry per
  user that opted to be remembered there.
- Cookie value is "<device_id>.<secret>"; only sha256(secret) is stored.
- Each user's UEK is wrapped with a key derived from the secret (PBKDF2),
  mirroring the app's existing three-key hierarchy.
"""

import pytest

from backend import device_tokens
from backend.crypto import generate_user_key


COOKIE = None  # set per-test


class TestDeviceLifecycle:
    def test_create_device_returns_cookie_and_stores_hash_only(self, isolated_data_dir):
        key = generate_user_key()
        cookie, device_id = device_tokens.create_device("alice", key, "Test Browser")
        assert cookie.startswith(device_id + ".")
        secret = cookie.split(".", 1)[1]
        # raw secret must never touch disk — only its hash
        import json
        assert secret not in json.dumps(device_tokens._read_store())
        assert device_tokens.verify_device(cookie) == device_id

    def test_verify_rejects_forged_cookie(self, isolated_data_dir):
        key = generate_user_key()
        cookie, device_id = device_tokens.create_device("alice", key, "Lab")
        other = device_tokens.create_device("bob", generate_user_key(), "Lab")[0]
        # wrong secret for a real device id
        forged = device_id + "." + "0" * 64
        assert device_tokens.verify_device(forged) is None
        # complete garbage
        assert device_tokens.verify_device("nope") is None
        assert device_tokens.verify_device("") is None

    def test_add_second_user_to_same_device(self, isolated_data_dir):
        key_a, key_b = generate_user_key(), generate_user_key()
        cookie, device_id = device_tokens.create_device("alice", key_a, "Tablet")
        ok = device_tokens.add_user_to_device(cookie, "bob", key_b, "Tablet")
        assert ok == device_id
        users = device_tokens.get_remembered_users(cookie)
        assert sorted(u["username"] for u in users) == ["alice", "bob"]

    def test_device_login_unwraps_correct_user_key(self, isolated_data_dir):
        key_a, key_b = generate_user_key(), generate_user_key()
        cookie, _ = device_tokens.create_device("alice", key_a, "Tablet")
        device_tokens.add_user_to_device(cookie, "bob", key_b, "Tablet")
        assert device_tokens.device_login(cookie, "alice") == key_a
        assert device_tokens.device_login(cookie, "bob") == key_b

    def test_device_login_unknown_user_returns_none(self, isolated_data_dir):
        cookie, _ = device_tokens.create_device("alice", generate_user_key(), "PC")
        assert device_tokens.device_login(cookie, "mallory") is None

    def test_remove_user_keeps_other_users(self, isolated_data_dir):
        cookie, _ = device_tokens.create_device("alice", generate_user_key(), "Tablet")
        device_tokens.add_user_to_device(cookie, "bob", generate_user_key(), "Tablet")
        assert device_tokens.remove_user(cookie, "bob") is True
        assert [u["username"] for u in device_tokens.get_remembered_users(cookie)] == ["alice"]

    def test_remove_last_user_drops_device_record(self, isolated_data_dir):
        cookie, device_id = device_tokens.create_device("alice", generate_user_key(), "Old PC")
        assert device_tokens.remove_user(cookie, "alice") is True
        assert device_tokens.verify_device(cookie) is None
        assert device_tokens.get_remembered_users(cookie) == []

    def test_revoke_user_everywhere(self, isolated_data_dir):
        c1, _ = device_tokens.create_device("alice", generate_user_key(), "Phone")
        device_tokens.add_user_to_device(c1, "bob", generate_user_key(), "Phone")
        c2, _ = device_tokens.create_device("alice", generate_user_key(), "Laptop")
        assert device_tokens.revoke_user_everywhere("alice") == 2
        assert [u["username"] for u in device_tokens.get_remembered_users(c1)] == ["bob"]
        assert device_tokens.get_remembered_users(c2) == []

    def test_last_used_updates_on_login(self, isolated_data_dir):
        cookie, _ = device_tokens.create_device("alice", generate_user_key(), "PC")
        before = device_tokens.get_remembered_users(cookie)[0]["last_used_at"]
        device_tokens.device_login(cookie, "alice")
        after = device_tokens.get_remembered_users(cookie)[0]["last_used_at"]
        assert after >= before

    def test_missing_devices_file_is_empty(self, isolated_data_dir):
        assert device_tokens.get_remembered_users("x.y") == []
        assert device_tokens.verify_device("x.y") is None


class TestLegacyStoreShapes:
    """Backward-compat guards: odd-but-present data must never crash the app."""

    def test_store_without_devices_key(self, isolated_data_dir):
        import json, os
        from backend import config
        path = os.path.join(config.DATA_DIR, "devices.json")
        with open(path, "w") as f:
            json.dump({"_data_version": "1.0"}, f)
        assert device_tokens.get_remembered_users("x.y") == []

    def test_record_with_unknown_extra_fields(self, isolated_data_dir):
        import json, os
        from backend import config
        cookie, device_id = device_tokens.create_device("alice", generate_user_key(), "PC")
        path = os.path.join(config.DATA_DIR, "devices.json")
        with open(path) as f:
            store = json.load(f)
        store["devices"][device_id]["future_field"] = {"x": 1}
        with open(path, "w") as f:
            json.dump(store, f)
        users = device_tokens.get_remembered_users(cookie)
        assert [u["username"] for u in users] == ["alice"]
