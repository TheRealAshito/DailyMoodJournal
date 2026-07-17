from datetime import date, timedelta
from collections import defaultdict
from fastapi import APIRouter, Request, HTTPException, Query
from backend.entry_crud import get_entry, list_user_entries
from backend.utils import extract_date_from_path
from backend.routers.auth import _get_session

router = APIRouter(prefix="/api/stats", tags=["stats"])

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _get_period_key(d: date, period: str) -> tuple[str, date]:
    """Return (period_key, period_start_date) for grouping."""
    if period == "week":
        iso = d.isocalendar()
        start = d - timedelta(days=d.weekday())
        return f"{iso[0]}-W{iso[1]:02d}", start
    elif period == "month":
        return f"{d.year}-{d.month:02d}", d.replace(day=1)
    return d.isoformat(), d


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


def _period_label(period_key: str, period_start: date, period: str) -> str:
    if period == "week":
        return f"W{period_start.isocalendar()[1]} {period_start.strftime('%b')}"
    elif period == "month":
        return period_start.strftime("%b %Y")
    return period_start.strftime("%b %d")


@router.get("")
def get_stats(
    request: Request,
    period: str = Query("day", pattern=r"^(day|week|month)$"),
    from_date: str = Query(""),
    to_date: str = Query(""),
    tags: str = Query(""),
):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    user_key = session["user_key"]
    entries = list_user_entries(session["username"])

    if not entries:
        empty = {"total_entries": 0, "avg_mood": 0, "current_streak": 0, "longest_streak": 0,
                 "mood_by_date": [], "mood_distribution": [],
                 "tag_mood_correlation": [], "day_of_week_mood": [], "tag_frequency": [],
                 "scales_by_date": {}}
        return empty

    # Parse filters
    filter_tags = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    try:
        date_from = date.fromisoformat(from_date) if from_date else None
    except ValueError:
        date_from = None
    try:
        date_to = date.fromisoformat(to_date) if to_date else None
    except ValueError:
        date_to = None

    # Per-date accumulators
    by_date = defaultdict(lambda: {"moods": [], "count": 0, "scales": defaultdict(list)})
    tag_moods = defaultdict(list)
    tag_counts = defaultdict(int)
    day_of_week_moods = defaultdict(list)
    all_filtered_dates = []

    for path in entries:
        try:
            entry = get_entry(path, user_key)
            if entry is None:
                continue
            dt = extract_date_from_path(path)
            if dt is None:
                continue
            date_key = dt.date()

            # Date filter
            if date_from and date_key < date_from:
                continue
            if date_to and date_key > date_to:
                continue

            entry_tags = entry.get("tags", [])

            # Tag filter (entry must match ALL selected tags)
            if filter_tags:
                if not all(t in entry_tags for t in filter_tags):
                    continue

            all_filtered_dates.append(date_key)
            mood_val = entry.get("mood", 3)
            by_date[date_key]["moods"].append(mood_val)
            by_date[date_key]["count"] += 1

            scales = entry.get("scales", {})
            if isinstance(scales, dict):
                for scale_name, scale_val in scales.items():
                    by_date[date_key]["scales"][scale_name].append(scale_val)

            for tag in entry_tags:
                tag_moods[tag].append(mood_val)
                tag_counts[tag] += 1

            day_of_week_moods[date_key.weekday()].append(mood_val)

        except Exception:
            continue

    if not by_date:
        empty = {"total_entries": 0, "avg_mood": 0, "current_streak": 0, "longest_streak": 0,
                 "mood_by_date": [], "mood_distribution": [],
                 "tag_mood_correlation": [], "day_of_week_mood": [], "tag_frequency": [],
                 "scales_by_date": {}}
        return empty

    dates = sorted(by_date.keys())
    total_entries = sum(d["count"] for d in by_date.values())
    all_moods = [m for d in by_date.values() for m in d["moods"]]
    avg_mood = round(sum(all_moods) / len(all_moods), 1) if all_moods else 0

    current_streak = _calc_streak(dates)
    longest_streak = _calc_longest_streak(dates)

    # Period-grouped mood chart
    mood_by_period = defaultdict(list)
    period_order = []
    period_start_map = {}
    for d in dates:
        pk, start = _get_period_key(d, period)
        if pk not in period_start_map:
            period_start_map[pk] = start
            period_order.append(pk)
        mood_by_period[pk].extend(by_date[d]["moods"])

    mood_by_date = []
    for pk in period_order:
        moods = mood_by_period[pk]
        start = period_start_map[pk]
        mood_by_date.append({
            "date": start.isoformat(),
            "avg_mood": round(sum(moods) / len(moods), 1),
            "count": len(moods),
            "label": _period_label(pk, start, period),
        })

    # Mood distribution
    mood_dist = [{"mood": m, "count": all_moods.count(m)} for m in range(7)]

    # Tag mood correlation
    tag_mood_correlation = sorted(
        [{"tag": tag, "avg_mood": round(sum(moods) / len(moods), 1), "count": len(moods)}
         for tag, moods in tag_moods.items()],
        key=lambda x: x["count"], reverse=True,
    )

    # Day of week
    day_of_week_mood = [
        {"day": WEEKDAY_NAMES[d], "day_index": d,
         "avg_mood": round(sum(moods) / len(moods), 1), "count": len(moods)}
        for d, moods in sorted(day_of_week_moods.items())
    ]

    # Tag frequency
    tag_frequency = sorted(
        [{"tag": tag, "count": count} for tag, count in tag_counts.items()],
        key=lambda x: x["count"], reverse=True,
    )

    # Scales by date (period-grouped)
    scales_by_period = defaultdict(lambda: defaultdict(list))
    for d in dates:
        pk, _ = _get_period_key(d, period)
        for scale_name, vals in by_date[d]["scales"].items():
            scales_by_period[pk][scale_name].extend(vals)

    scales_by_date = defaultdict(list)
    for pk in period_order:
        for scale_name, vals in scales_by_period[pk].items():
            if vals:
                start = period_start_map[pk]
                scales_by_date[scale_name].append({
                    "date": start.isoformat(),
                    "value": round(sum(vals) / len(vals), 1),
                    "label": _period_label(pk, start, period),
                })

    return {
        "total_entries": total_entries,
        "avg_mood": avg_mood,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "mood_by_date": mood_by_date,
        "mood_distribution": mood_dist,
        "tag_mood_correlation": tag_mood_correlation,
        "day_of_week_mood": day_of_week_mood,
        "tag_frequency": tag_frequency,
        "scales_by_date": dict(scales_by_date),
    }
