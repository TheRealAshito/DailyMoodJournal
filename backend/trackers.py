"""Habit trackers — standalone encrypted store (data/{user}_trackers.enc).

Two tracker types:
- timer:   "withdraw timer" — last_done_at + motivational note + reset history.
           The UI shows a live elapsed timer; resetting keeps the old timestamp
           in history so longest streak stays derivable.
- counter: behavior log — one event per occurrence with diagnostic context
           (doing / feeling / mind / triggers) so patterns can be diagnosed
           (e.g. anxiety crises by day and trigger).

Privacy: encrypted with the user's key (AES-256-GCM) like journal entries and
freewrite — the file on disk is ciphertext. Format: {"trackers": [...]} —
readers accept any missing version field (forward/backward tolerant).
"""

import json
import os
import re
import hashlib
import uuid
from datetime import datetime, timezone, timedelta

from backend import config
from backend.crypto import encrypt_entry, decrypt_entry

TRACKER_TYPES = {"timer", "counter"}
MAX_TRACKERS = 50
MAX_TEXT = 2000
MAX_NAME = 80
# Timestamps may be slightly ahead (clock skew / timezone slip on input)
FUTURE_GRACE = timedelta(hours=1)


def _now_dt(now=None) -> datetime:
    return now if now is not None else datetime.now(timezone.utc)


def _parse_ts(value) -> datetime:
    """Accept datetime or ISO string; naive means UTC. Raises ValueError."""
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value)
        except ValueError:
            raise ValueError("Invalid timestamp")
    else:
        raise ValueError("Invalid timestamp")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _iso(value) -> str:
    return _parse_ts(value).isoformat()


def _safe_name(username: str) -> str:
    if re.fullmatch(r"[a-zA-Z0-9_\-.]{1,64}", username):
        return username
    return "u_" + hashlib.sha256(username.encode()).hexdigest()[:16]


def _path(username: str) -> str:
    # Read config at call time so tests can monkeypatch DATA_DIR.
    return os.path.join(config.DATA_DIR, f"{_safe_name(username)}_trackers.enc")


def load_trackers(username: str, user_key: bytes) -> list:
    path = _path(username)
    if not os.path.exists(path):
        return []
    try:
        with open(path, "rb") as f:
            plaintext = decrypt_entry(f.read(), user_key)
        payload = json.loads(plaintext)
    except Exception:
        return []  # missing/corrupt/wrong-key: behave like no trackers
    if not isinstance(payload, dict):
        return []
    trackers = payload.get("trackers", [])
    return [t for t in trackers if isinstance(t, dict)]


def _save(username: str, user_key: bytes, trackers: list):
    os.makedirs(config.DATA_DIR, exist_ok=True)
    payload = {"version": 1, "trackers": trackers}
    with open(_path(username), "wb") as f:
        f.write(encrypt_entry(json.dumps(payload), user_key))


def _find(trackers_list: list, tracker_id: str) -> dict:
    for t in trackers_list:
        if t.get("id") == tracker_id:
            return t
    raise ValueError("Tracker not found")


def _check_name(name) -> str:
    name = (name or "").strip()
    if not name or len(name) > MAX_NAME:
        raise ValueError(f"Name must be 1-{MAX_NAME} characters")
    return name


def _check_text(value, field: str) -> str:
    value = value or ""
    if len(value) > MAX_TEXT:
        raise ValueError(f"{field} too long (max {MAX_TEXT})")
    return value


def _check_future(value, now: datetime) -> str:
    iso_str = _iso(value)
    if _parse_ts(iso_str) > now + FUTURE_GRACE:
        raise ValueError("Timestamp cannot be in the future")
    return iso_str


def create_tracker(username: str, user_key: bytes, name: str, tracker_type: str,
                   last_done_at=None, note: str = "", now=None) -> dict:
    now_dt = _now_dt(now)
    name = _check_name(name)
    if tracker_type not in TRACKER_TYPES:
        raise ValueError("Type must be 'timer' or 'counter'")

    items = load_trackers(username, user_key)
    if len(items) >= MAX_TRACKERS:
        raise ValueError(f"Maximum of {MAX_TRACKERS} trackers")

    base: dict = {
        "id": uuid.uuid4().hex,
        "name": name,
        "type": tracker_type,
        "created_at": now_dt.isoformat(),
    }
    if tracker_type == "timer":
        note = _check_text(note, "note")
        base["note"] = note
        base["last_done_at"] = _check_future(last_done_at, now_dt) if last_done_at else now_dt.isoformat()
        base["history"] = []
    else:
        if note:
            raise ValueError("Note is only for timer trackers")
        if last_done_at:
            raise ValueError("last_done_at is only for timer trackers")
        base["events"] = []

    items.append(base)
    _save(username, user_key, items)
    return base


def update_tracker(username: str, user_key: bytes, tracker_id: str,
                   name=None, note=None, last_done_at=None, now=None) -> dict:
    now_dt = _now_dt(now)
    items = load_trackers(username, user_key)
    t = _find(items, tracker_id)

    if name is not None:
        t["name"] = _check_name(name)
    if note is not None:
        if t["type"] != "timer":
            raise ValueError("Note is only for timer trackers")
        t["note"] = _check_text(note, "note")
    if last_done_at is not None:
        if t["type"] != "timer":
            raise ValueError("last_done_at is only for timer trackers")
        t["last_done_at"] = _check_future(last_done_at, now_dt)

    _save(username, user_key, items)
    return t


def reset_timer(username: str, user_key: bytes, tracker_id: str,
                at=None, now=None) -> dict:
    """User did the behavior again: keep the old streak in history."""
    now_dt = _now_dt(now)
    items = load_trackers(username, user_key)
    t = _find(items, tracker_id)
    if t["type"] != "timer":
        raise ValueError("reset is only for timer trackers")
    new_at = _check_future(at, now_dt) if at else now_dt.isoformat()
    t.setdefault("history", []).append(t.get("last_done_at", new_at))
    t["last_done_at"] = new_at
    _save(username, user_key, items)
    return t


def add_event(username: str, user_key: bytes, tracker_id: str,
              at=None, doing: str = "", feeling: str = "", mind: str = "",
              triggers: str = "", now=None) -> dict:
    now_dt = _now_dt(now)
    items = load_trackers(username, user_key)
    t = _find(items, tracker_id)
    if t["type"] != "counter":
        raise ValueError("events are only for counter trackers")
    event = {
        "id": uuid.uuid4().hex,
        "at": _iso(at) if at else now_dt.isoformat(),
        "doing": _check_text(doing, "doing"),
        "feeling": _check_text(feeling, "feeling"),
        "mind": _check_text(mind, "mind"),
        "triggers": _check_text(triggers, "triggers"),
    }
    events = t.setdefault("events", [])
    events.append(event)
    events.sort(key=lambda e: _parse_ts(e["at"]), reverse=True)
    _save(username, user_key, items)
    return t


def delete_tracker(username: str, user_key: bytes, tracker_id: str, now=None) -> bool:
    items = load_trackers(username, user_key)
    for i, t in enumerate(items):
        if t.get("id") == tracker_id:
            del items[i]
            _save(username, user_key, items)
            return True
    return False


def delete_event(username: str, user_key: bytes, tracker_id: str,
                 event_id: str, now=None):
    items = load_trackers(username, user_key)
    t = _find(items, tracker_id)
    events = t.get("events", [])
    for i, e in enumerate(events):
        if e.get("id") == event_id:
            del events[i]
            _save(username, user_key, items)
            return t
    return False


def timer_stats(tracker: dict, now=None) -> dict:
    """Pure computation: current streak and longest streak in seconds."""
    now_dt = _now_dt(now)
    stamps = list(tracker.get("history", []))
    if tracker.get("last_done_at"):
        stamps.append(tracker["last_done_at"])
    if not stamps:
        return {"current_seconds": 0, "longest_seconds": 0}
    parsed = sorted(_parse_ts(s) for s in stamps)
    current = max(0, int((now_dt - parsed[-1]).total_seconds()))
    longest = current
    for i in range(1, len(parsed)):
        gap = int((parsed[i] - parsed[i - 1]).total_seconds())
        longest = max(longest, gap)
    return {"current_seconds": current, "longest_seconds": longest}
