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


def ensure_directories():
    os.makedirs(ENTRIES_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)


def is_first_run():
    return not os.path.exists(USERS_FILE)


def load_users() -> dict:
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, "r") as f:
        return json.load(f)


def save_users(users: dict):
    ensure_directories()
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)


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


def get_user_settings(username: str) -> dict:
    users = load_users()
    user = users.get(username, {})
    return {
        "theme": user.get("theme", "light"),
        "language": user.get("language", "en"),
        "cbt_enabled_categories": user.get("cbt_enabled_categories", ["distortions", "reframing"]),
        "cbt_show_education": user.get("cbt_show_education", True),
    }


def save_user_settings(username: str, settings: dict):
    users = load_users()
    if username not in users:
        return
    for key in ("theme", "language", "cbt_enabled_categories", "cbt_show_education"):
        if key in settings:
            users[username][key] = settings[key]
    save_users(users)
