"""Remembered-device token store.

One record per physical device (browser), keyed by device id. Each record
holds one entry per user who opted to be remembered there, with that user's
UEK wrapped under a key derived from the device secret.

Security model (mirrors the app's three-key hierarchy):
- Cookie value is "<device_id>.<secret>", secret = 256-bit random.
- Only sha256(secret) is persisted; the raw secret lives in the cookie only.
- Each user's UEK is wrapped with PBKDF2(secret, per-entry salt), so a stolen
  devices.json alone cannot decrypt journals.

File: data/devices.json — created lazily, safe to delete (users just log in
again). Never touches users.json or entries/.
"""

import json
import os
import hmac
import uuid
import time
from base64 import b64encode, b64decode
from hashlib import sha256

from backend import config
from backend.crypto import derive_kek, wrap_user_key, unwrap_user_key

DATA_VERSION = "1.0"
COOKIE_NAME = "dailymood_device"


def _devices_path() -> str:
    # Read at call time so test monkeypatching of config.DATA_DIR works.
    return os.path.join(config.DATA_DIR, "devices.json")


def _read_store() -> dict:
    path = _devices_path()
    if not os.path.exists(path):
        return {"_data_version": DATA_VERSION, "devices": {}}
    try:
        with open(path, "r") as f:
            store = json.load(f)
    except (json.JSONDecodeError, OSError):
        return {"_data_version": DATA_VERSION, "devices": {}}
    if not isinstance(store, dict):
        return {"_data_version": DATA_VERSION, "devices": {}}
    store.setdefault("devices", {})
    if not isinstance(store["devices"], dict):
        store["devices"] = {}
    return store


def _write_store(store: dict):
    path = _devices_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    store["_data_version"] = DATA_VERSION
    with open(path, "w") as f:
        json.dump(store, f, indent=2)
    os.chmod(path, 0o600)


def _hash_secret(secret: str) -> str:
    return sha256(secret.encode()).hexdigest()


def _split_cookie(cookie: str) -> tuple[str, str] | None:
    if not cookie or "." not in cookie:
        return None
    device_id, secret = cookie.split(".", 1)
    if not device_id or not secret:
        return None
    return device_id, secret


def verify_device(cookie: str) -> str | None:
    """Return the device id if the cookie authenticates, else None."""
    parts = _split_cookie(cookie)
    if parts is None:
        return None
    device_id, secret = parts
    store = _read_store()
    record = store["devices"].get(device_id)
    if not isinstance(record, dict):
        return None
    stored = record.get("secret_hash", "")
    if not stored or not hmac.compare_digest(stored, _hash_secret(secret)):
        return None
    return device_id


def _new_device_record(secret: str, username: str, user_key: bytes, label: str) -> dict:
    wrap_salt = b64encode(os.urandom(16)).decode()
    kek = derive_kek(secret, b64decode(wrap_salt.encode()))
    now = time.time()
    return {
        "secret_hash": _hash_secret(secret),
        "users": {
            username: {
                "label": label,
                "created_at": now,
                "last_used_at": now,
                "wrap_salt": wrap_salt,
                "wrapped_uek": wrap_user_key(user_key, kek),
            }
        },
    }


def create_device(username: str, user_key: bytes, label: str) -> tuple[str, str]:
    """Create a new device record; returns (cookie_value, device_id)."""
    device_id = uuid.uuid4().hex
    secret = uuid.uuid4().hex + uuid.uuid4().hex  # 256-bit
    store = _read_store()
    store["devices"][device_id] = _new_device_record(secret, username, user_key, label)
    _write_store(store)
    return f"{device_id}.{secret}", device_id


def add_user_to_device(cookie: str, username: str, user_key: bytes, label: str) -> str | None:
    """Remember an additional user on an existing device. Returns device_id or None."""
    device_id = verify_device(cookie)
    if device_id is None:
        return None
    parts = _split_cookie(cookie)
    if parts is None:
        return None
    device_id, secret = parts
    store = _read_store()
    record = store["devices"].get(device_id)
    if not isinstance(record, dict):
        return None
    wrap_salt = b64encode(os.urandom(16)).decode()
    kek = derive_kek(secret, b64decode(wrap_salt.encode()))
    now = time.time()
    record.setdefault("users", {})
    record["users"][username] = {
        "label": label,
        "created_at": now,
        "last_used_at": now,
        "wrap_salt": wrap_salt,
        "wrapped_uek": wrap_user_key(user_key, kek),
    }
    _write_store(store)
    return device_id


def get_remembered_users(cookie: str) -> list[dict]:
    """Users remembered on this device (safe subset: no key material)."""
    device_id = verify_device(cookie)
    if device_id is None:
        return []
    store = _read_store()
    record = store["devices"].get(device_id)
    if not isinstance(record, dict):
        return []
    out = []
    for username, entry in record.get("users", {}).items():
        if not isinstance(entry, dict):
            continue
        out.append({
            "username": username,
            "label": entry.get("label", ""),
            "created_at": entry.get("created_at"),
            "last_used_at": entry.get("last_used_at"),
        })
    out.sort(key=lambda u: u["last_used_at"] or 0, reverse=True)
    return out


def device_login(cookie: str, username: str) -> bytes | None:
    """Unwrap and return the user's key if this device remembers them."""
    device_id = verify_device(cookie)
    if device_id is None:
        return None
    parts = _split_cookie(cookie)
    if parts is None:
        return None
    _, secret = parts
    store = _read_store()
    record = store["devices"].get(device_id)
    if not isinstance(record, dict):
        return None
    entry = record.get("users", {}).get(username)
    if not isinstance(entry, dict):
        return None
    try:
        salt = b64decode(entry["wrap_salt"].encode())
    except (KeyError, ValueError):
        return None
    kek = derive_kek(secret, salt)
    user_key = unwrap_user_key(entry.get("wrapped_uek", ""), kek)
    if user_key is None:
        return None
    entry["last_used_at"] = time.time()
    _write_store(store)
    return user_key


def remove_user(cookie: str, username: str) -> bool:
    """Forget one user on this device. Drops the device record if empty."""
    device_id = verify_device(cookie)
    if device_id is None:
        return False
    store = _read_store()
    record = store["devices"].get(device_id)
    if not isinstance(record, dict):
        return False
    users = record.get("users", {})
    if username not in users:
        return False
    del users[username]
    if not users:
        del store["devices"][device_id]
    _write_store(store)
    return True


def revoke_user_everywhere(username: str) -> int:
    """Forget a user on every device. Returns number of devices affected."""
    store = _read_store()
    affected = 0
    for device_id in list(store["devices"].keys()):
        record = store["devices"][device_id]
        if not isinstance(record, dict):
            continue
        users = record.get("users", {})
        if username in users:
            del users[username]
            affected += 1
            if not users:
                del store["devices"][device_id]
    if affected:
        _write_store(store)
    return affected


def list_devices_for_user(username: str) -> list[dict]:
    """Every device that remembers this user (for the Settings page)."""
    store = _read_store()
    out = []
    for device_id, record in store["devices"].items():
        if not isinstance(record, dict):
            continue
        entry = record.get("users", {}).get(username)
        if not isinstance(entry, dict):
            continue
        out.append({
            "device_id": device_id,
            "label": entry.get("label", ""),
            "created_at": entry.get("created_at"),
            "last_used_at": entry.get("last_used_at"),
        })
    out.sort(key=lambda d: d["last_used_at"] or 0, reverse=True)
    return out


def revoke_device_for_user(device_id: str, username: str) -> bool:
    """Forget one user on one specific device (Settings -> remembered devices)."""
    store = _read_store()
    record = store["devices"].get(device_id)
    if not isinstance(record, dict):
        return False
    users = record.get("users", {})
    if username not in users:
        return False
    del users[username]
    if not users:
        del store["devices"][device_id]
    _write_store(store)
    return True
