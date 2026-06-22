import os
from datetime import datetime
from backend.crypto import encrypt_entry, decrypt_entry
from backend.utils import build_entry_path, parse_entry_text, build_entry_text, list_user_entries, extract_date_from_path

KNOWN_FIELDS = {"title", "date", "mood", "tags", "author", "body", "path"}


def _merge_frontmatter(known: dict, extra: dict) -> dict:
    result = dict(known)
    for key, value in extra.items():
        if key not in KNOWN_FIELDS and key not in result:
            result[key] = value
    return result


def create_entry(username: str, entry_data: dict, user_key: bytes) -> str:
    dt = entry_data["date"]
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    path = build_entry_path(username, dt)

    os.makedirs(os.path.dirname(path), exist_ok=True)

    frontmatter = {
        "title": entry_data["title"],
        "date": dt.strftime("%Y-%m-%d %H:%M"),
        "mood": entry_data["mood"],
        "tags": entry_data.get("tags", []),
        "author": username,
    }
    extra = {k: v for k, v in entry_data.items() if k not in KNOWN_FIELDS and k not in frontmatter}
    frontmatter = _merge_frontmatter(frontmatter, extra)

    body = entry_data.get("body", "")
    plaintext = build_entry_text(frontmatter, body)
    ciphertext = encrypt_entry(plaintext, user_key)

    with open(path, "wb") as f:
        f.write(ciphertext)

    return path


def get_entry(path: str, user_key: bytes) -> dict | None:
    if not os.path.exists(path):
        return None

    with open(path, "rb") as f:
        ciphertext = f.read()

    plaintext = decrypt_entry(ciphertext, user_key)
    frontmatter, body = parse_entry_text(plaintext)

    frontmatter["body"] = body
    frontmatter["path"] = path
    return frontmatter


def update_entry(path: str, entry_data: dict, user_key: bytes) -> str:
    existing = get_entry(path, user_key)
    dt = entry_data["date"]
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)

    os.makedirs(os.path.dirname(path), exist_ok=True)

    frontmatter = {
        "title": entry_data["title"],
        "date": dt.strftime("%Y-%m-%d %H:%M"),
        "mood": entry_data["mood"],
        "tags": entry_data.get("tags", []),
        "author": entry_data.get("author", ""),
    }
    extra = {k: v for k, v in entry_data.items() if k not in KNOWN_FIELDS and k not in frontmatter}
    if existing:
        for key, value in existing.items():
            if key not in KNOWN_FIELDS and key not in frontmatter and key not in extra:
                extra[key] = value
    frontmatter = _merge_frontmatter(frontmatter, extra)

    body = entry_data.get("body", "")
    plaintext = build_entry_text(frontmatter, body)
    ciphertext = encrypt_entry(plaintext, user_key)

    with open(path, "wb") as f:
        f.write(ciphertext)

    return path


def delete_entry(path: str) -> bool:
    if not os.path.exists(path):
        return False
    os.remove(path)
    return True


def get_entries_for_date(username: str, date_obj, user_key: bytes) -> list[dict]:
    entries = []
    for path in list_user_entries(username):
        entry_date = extract_date_from_path(path)
        if entry_date and entry_date.date() == date_obj:
            entries.append({"path": path, "date": entry_date})
    return sorted(entries, key=lambda e: e["date"])


def get_all_tags_for_user(username: str, user_key: bytes) -> list[str]:
    tags_set = set()
    for path in list_user_entries(username):
        try:
            entry = get_entry(path, user_key)
            if entry:
                for tag in entry.get("tags", []):
                    tags_set.add(tag)
        except Exception:
            pass
    return sorted(tags_set)
