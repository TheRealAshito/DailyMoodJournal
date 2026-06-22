import os
import json
import streamlit as st

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENTRIES_DIR = os.path.join(BASE_DIR, "entries")
DATA_DIR = os.path.join(BASE_DIR, "data")
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


def apply_theme():
    theme = st.session_state.get("theme", "light")
    if theme == "dark":
        base_theme = "dark"
    else:
        base_theme = "light"

    config_path = os.path.join(BASE_DIR, ".streamlit", "config.toml")
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            content = f.read()
        if f'base = "{base_theme}"' not in content:
            content = content.replace('base = "light"', f'base = "{base_theme}"')
            content = content.replace('base = "dark"', f'base = "{base_theme}"')
            with open(config_path, "w") as f:
                f.write(content)
