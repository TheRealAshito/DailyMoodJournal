import os
import json

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRIES_DIR = os.path.join(PROJECT_ROOT, "entries")
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
MASTER_KEY_FILE = os.path.join(DATA_DIR, "master.key")

MOOD_COLORS = {
    0: "#4a148c",
    1: "#6a1b9a",
    2: "#9c27b0",
    3: "#9e9e9e",
    4: "#66bb6a",
    5: "#43a047",
    6: "#2e7d32",
}

MOOD_LABELS = {
    0: "Terrible",
    1: "Bad",
    2: "Poor",
    3: "Okay",
    4: "Good",
    5: "Great",
    6: "Amazing",
}

MOOD_EMOJIS = {
    0: "\U0001f61e",
    1: "\U0001f622",
    2: "\U0001f615",
    3: "\U0001f610",
    4: "\U0001f642",
    5: "\U0001f60a",
    6: "\U0001f929",
}

DATA_VERSION = "1.0"


def ensure_directories():
    os.makedirs(ENTRIES_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)


def is_first_run():
    return not os.path.exists(USERS_FILE)


def load_users() -> dict:
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, "r") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data.pop("_data_version", None)
    return data


def save_users(users: dict):
    ensure_directories()
    data = dict(users)
    data["_data_version"] = DATA_VERSION
    with open(USERS_FILE, "w") as f:
        json.dump(data, f, indent=2)
    os.chmod(USERS_FILE, 0o600)


def load_master_key() -> bytes | None:
    if not os.path.exists(MASTER_KEY_FILE):
        return None
    with open(MASTER_KEY_FILE, "rb") as f:
        return f.read()


def save_master_key(key: bytes):
    ensure_directories()
    with open(MASTER_KEY_FILE, "wb") as f:
        f.write(key)
    os.chmod(MASTER_KEY_FILE, 0o600)


AUTH_KEYS = {
    "salt", "password_hash", "entry_key_encrypted_with_pwd",
    "entry_key_salt_pwd", "entry_key_encrypted_with_secret",
    "entry_key_salt_secret", "security_question", "created_at",
    "theme", "language", "reflection_categories", "cbt_enabled_categories",
}

KNOWN_SETTINGS = {"theme", "language", "reflection_categories"}


def get_user_settings(username: str) -> dict:
    users = load_users()
    user = users.get(username, {})
    settings = {
        "theme": user.get("theme", "light"),
        "language": user.get("language", "en"),
        "reflection_categories": user.get("reflection_categories",
            user.get("cbt_enabled_categories",
                ["self_reflection", "gratitude", "growth_learning", "emotional_awareness"])),
    }
    for key, value in user.items():
        if key not in AUTH_KEYS and key not in settings:
            settings[key] = value
    return settings


def save_user_settings(username: str, settings: dict):
    users = load_users()
    if username not in users:
        return
    for key, value in settings.items():
        users[username][key] = value
    save_users(users)
