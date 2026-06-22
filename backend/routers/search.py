from datetime import date
from fastapi import APIRouter, Request, HTTPException, Query
from backend.entry_crud import get_entry, list_user_entries
from backend.utils import extract_date_from_path
from backend.config import MOOD_COLORS, MOOD_LABELS
from backend.routers.auth import _get_session

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def search_entries(
    request: Request,
    tags: str = Query(""),
    from_date: str = Query(""),
    to_date: str = Query(""),
):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    user_key = session["user_key"]
    filter_tags = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    try:
        date_from = date.fromisoformat(from_date) if from_date else date.min
    except ValueError:
        date_from = date.min

    try:
        date_to = date.fromisoformat(to_date) if to_date else date.max
    except ValueError:
        date_to = date.max

    results = []
    for path in list_user_entries(session["username"]):
        dt = extract_date_from_path(path)
        if dt is None:
            continue

        if dt.date() < date_from or dt.date() > date_to:
            continue

        entry = get_entry(path, user_key)
        if entry is None:
            continue

        entry_tags = entry.get("tags", [])
        if filter_tags:
            if not any(t in entry_tags for t in filter_tags):
                continue

        results.append({
            "title": entry.get("title", ""),
            "date": entry.get("date", ""),
            "mood": entry.get("mood", 3),
            "tags": entry_tags,
            "body": entry.get("body", ""),
            "author": entry.get("author", ""),
            "path": path,
            "mood_color": MOOD_COLORS.get(entry.get("mood", 3), MOOD_COLORS[3]),
            "mood_label": MOOD_LABELS.get(entry.get("mood", 3), "Unknown"),
        })

    results.sort(key=lambda e: e["date"], reverse=True)
    return {"entries": results}
