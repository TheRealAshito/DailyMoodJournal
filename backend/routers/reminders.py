"""Reminder-related endpoints for the in-app nudge banner."""

from datetime import date
from fastapi import APIRouter, Depends
from backend.deps import get_current_session
from backend.config import get_user_settings
from backend.utils import list_user_entries, extract_metadata_from_path
from backend.routers.stats import _calc_streak

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("/status")
def reminder_status(session: dict = Depends(get_current_session)):
    """Cheap status for the nudge banner: has today's entry, streak, risk.

    Uses entry FILENAMES only — never decrypts journal contents.
    """
    username = session["username"]
    today = date.today()
    dates = set()
    for path in list_user_entries(username):
        meta = extract_metadata_from_path(path)
        if meta:
            try:
                dates.add(date.fromisoformat(meta["date"]))
            except ValueError:
                continue

    has_entry_today = today in dates
    streak = _calc_streak(sorted(dates))
    return {
        "has_entry_today": has_entry_today,
        "current_streak": streak,
        "streak_at_risk": streak > 0 and not has_entry_today,
        "reminder_enabled": get_user_settings(username).get("reminder_enabled", False),
    }
