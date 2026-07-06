from datetime import date, timedelta
from collections import defaultdict
import numpy as np
from fastapi import APIRouter, Request, HTTPException, Query
from backend.entry_crud import get_entry, list_user_entries
from backend.utils import extract_date_from_path
from backend.routers.auth import _get_session

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
def get_stats(request: Request, period: str = Query("30d")):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    user_key = session["user_key"]
    entries = list_user_entries(session["username"])

    if not entries:
        return {"total_entries": 0, "avg_mood": 0, "current_streak": 0, "longest_streak": 0, "mood_by_date": [], "mood_distribution": []}

    by_date = defaultdict(lambda: {"moods": [], "count": 0, "scales": defaultdict(list)})
    all_dates = []

    for path in entries:
        try:
            entry = get_entry(path, user_key)
            if entry is None:
                continue
            dt = extract_date_from_path(path)
            if dt is None:
                continue
            date_key = dt.date()
            by_date[date_key]["moods"].append(entry.get("mood", 3))
            by_date[date_key]["count"] += 1
            # Collect custom scale values
            scales = entry.get("scales", {})
            if isinstance(scales, dict):
                for scale_name, scale_val in scales.items():
                    by_date[date_key]["scales"][scale_name].append(scale_val)
        except Exception:
            continue

    if not by_date:
        return {"total_entries": 0, "avg_mood": 0, "current_streak": 0, "longest_streak": 0, "mood_by_date": [], "mood_distribution": []}

    dates = sorted(by_date.keys())
    total_entries = sum(d["count"] for d in by_date.values())
    all_moods = [m for d in by_date.values() for m in d["moods"]]
    avg_mood = round(np.mean(all_moods), 1)
    current_streak = _calc_streak(dates)
    longest_streak = _calc_longest_streak(dates)

    mood_by_date = []
    scales_by_date = defaultdict(list)
    for d in dates:
        moods = by_date[d]["moods"]
        mood_by_date.append({
            "date": d.isoformat(),
            "avg_mood": round(sum(moods) / len(moods), 1),
            "count": by_date[d]["count"],
            "label": d.strftime("%b %d"),
        })
        # Aggregate scale values per date
        for scale_name, vals in by_date[d]["scales"].items():
            if vals:
                scales_by_date[scale_name].append({
                    "date": d.isoformat(),
                    "value": round(sum(vals) / len(vals), 1),
                    "label": d.strftime("%b %d"),
                })

    mood_dist = []
    for m in range(7):
        mood_dist.append({"mood": m, "count": all_moods.count(m)})

    return {
        "total_entries": total_entries,
        "avg_mood": avg_mood,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "mood_by_date": mood_by_date,
        "mood_distribution": mood_dist,
        "scales_by_date": dict(scales_by_date),
    }


def _calc_streak(dates: list) -> int:
    if not dates:
        return 0
    today = date.today()
    streak = 0
    check_date = today
    while True:
        if check_date in dates:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            if check_date != today:
                break
            check_date -= timedelta(days=1)
    return streak


def _calc_longest_streak(dates: list) -> int:
    if not dates:
        return 0
    sorted_dates = sorted(dates)
    longest = 1
    current = 1
    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
            current += 1
            longest = max(longest, current)
        else:
            current = 1
    return longest
