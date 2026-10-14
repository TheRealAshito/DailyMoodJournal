"""Daily journal reminders (opt-in).

Two delivery paths share one engine:
- In-app nudge banner (frontend reads /api/reminders/status).
- Optional ntfy push. DISABLED BY DEFAULT: nothing is ever sent unless the
  user enables reminders AND provides a URL in Settings.

Resource model: one daemon thread total. It sleeps until the next due
reminder time (capped at 5 minutes to pick up settings edits), performs a
cheap filename-scan check, sends at most one HTTP POST per user per day.
No per-user threads, no polling loops, no third-party libraries — stdlib
urllib only.

Privacy: the payload is a fixed generic string. No titles, moods, streak
counts, or timestamps ever leave the machine.
"""

import os
import time
from datetime import datetime, timedelta, timezone
from urllib import request as urlrequest
from zoneinfo import ZoneInfo

REMINDER_MESSAGE = "Time to write in your journal."
_MIN_WAKE, _MAX_WAKE = 30.0, 300.0


def _tz(name: str):
    try:
        return ZoneInfo(name or "UTC")
    except Exception:
        return ZoneInfo("UTC")


def _parse_hhmm(value: str) -> tuple[int, int] | None:
    if not isinstance(value, str):
        return None
    parts = value.split(":")
    if len(parts) != 2:
        return None
    try:
        h, m = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    if not (0 <= h <= 23 and 0 <= m <= 59):
        return None
    return h, m


def find_due_users(users: dict, now: datetime, has_entry_today: dict | None = None) -> list[str]:
    """Pure decision function: which users should get one reminder now."""
    has_entry_today = has_entry_today or {}
    due = []
    for username, user in users.items():
        if not isinstance(user, dict):
            continue
        if user.get("reminder_enabled") is not True:
            continue
        if not user.get("ntfy_url"):
            continue
        parsed = _parse_hhmm(user.get("reminder_time", ""))
        if parsed is None:
            continue
        local_now = now.astimezone(_tz(user.get("reminder_timezone", "UTC")))
        if (local_now.hour, local_now.minute) < parsed:
            continue
        if user.get("reminder_last_notified") == local_now.date().isoformat():
            continue
        if has_entry_today.get(username, False):
            continue
        due.append(username)
    return due


def _clamp_priority(value) -> int:
    try:
        p = int(value)
    except (TypeError, ValueError):
        return 3
    return max(1, min(5, p))


def build_request(user: dict) -> urlrequest.Request:
    headers = {
        "Title": "DailyMood",
        "X-Priority": str(_clamp_priority(user.get("ntfy_priority", 3))),
    }
    token = user.get("ntfy_token") or ""
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return urlrequest.Request(
        user["ntfy_url"],
        data=REMINDER_MESSAGE.encode(),
        headers=headers,
        method="POST",
    )


def _perform_send(req: urlrequest.Request) -> bool:
    try:
        with urlrequest.urlopen(req, timeout=5) as resp:
            return 200 <= resp.status < 300
    except Exception:
        return False


def check_and_notify(users: dict, now: datetime, has_entry_today: dict | None = None) -> list[str]:
    """Send reminders to everyone due. Marks users notified only on success."""
    has_entry_today = has_entry_today or {}
    sent = []
    for username in find_due_users(users, now, has_entry_today):
        user = users[username]
        if _perform_send(build_request(user)):
            local_now = now.astimezone(_tz(user.get("reminder_timezone", "UTC")))
            user["reminder_last_notified"] = local_now.date().isoformat()
            sent.append(username)
    return sent


def user_has_entry_on(username: str, date_str: str) -> bool:
    """Cheap check by filename — never decrypts entries."""
    from backend.utils import list_user_entries, extract_metadata_from_path
    for path in list_user_entries(username):
        meta = extract_metadata_from_path(path)
        if meta and meta.get("date") == date_str:
            return True
    return False


def next_wake_seconds(users: dict, now: datetime) -> float:
    """Seconds until the earliest upcoming reminder time (capped)."""
    best = _MAX_WAKE
    for user in users.values():
        if not isinstance(user, dict):
            continue
        if user.get("reminder_enabled") is not True or not user.get("ntfy_url"):
            continue
        parsed = _parse_hhmm(user.get("reminder_time", ""))
        if parsed is None:
            continue
        tz = _tz(user.get("reminder_timezone", "UTC"))
        local_now = now.astimezone(tz)
        target = local_now.replace(hour=parsed[0], minute=parsed[1], second=0, microsecond=0)
        if target <= local_now:
            target += timedelta(days=1)
        best = min(best, (target - local_now).total_seconds())
    return max(_MIN_WAKE, min(best, _MAX_WAKE))


def run_pending() -> int:
    """One scheduler iteration: load, check, notify, persist. Returns sent count."""
    from backend.config import load_users, save_users
    users = load_users()
    now = datetime.now(timezone.utc)
    has_entry = {}
    for username, user in users.items():
        if not isinstance(user, dict):
            continue
        if user.get("reminder_enabled") is not True or not user.get("ntfy_url"):
            continue
        local_today = now.astimezone(_tz(user.get("reminder_timezone", "UTC"))).date().isoformat()
        has_entry[username] = user_has_entry_on(username, local_today)
    sent = check_and_notify(users, now, has_entry)
    if sent:
        save_users(users)
    return len(sent)


_scheduler_started = False


def start_scheduler():
    """Start the single reminder thread (idempotent, daemon)."""
    global _scheduler_started
    if _scheduler_started or os.environ.get("DAILMOOD_SCHEDULER") == "off":
        return
    import threading
    from backend.config import load_users

    def _loop():
        while True:
            try:
                run_pending()
                wake = next_wake_seconds(load_users(), datetime.now(timezone.utc))
            except Exception:
                wake = _MAX_WAKE
            time.sleep(wake)

    threading.Thread(target=_loop, name="reminder-scheduler", daemon=True).start()
    _scheduler_started = True
