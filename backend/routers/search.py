from datetime import date
from fastapi import APIRouter, Request, HTTPException, Query
from backend.entry_crud import get_entry
from backend.index import query_entries as index_query
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
    username = session["username"]
    filter_tags = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    try:
        date_from = date.fromisoformat(from_date) if from_date else None
    except ValueError:
        date_from = None
    try:
        date_to = date.fromisoformat(to_date) if to_date else None
    except ValueError:
        date_to = None

    # Use index for filtering
    indexed = index_query(username, date_from=date_from, date_to=date_to, tags=filter_tags)

    results = []
    for meta in indexed:
        try:
            # Decrypt to get body
            entry = get_entry(meta["path"], user_key)
            if entry is None:
                continue
            results.append({
                "title": entry.get("title", ""),
                "date": entry.get("date", ""),
                "mood": entry.get("mood", 3),
                "tags": entry.get("tags", []),
                "body": entry.get("body", ""),
                "author": entry.get("author", ""),
                "path": meta["path"],
                "mood_color": MOOD_COLORS.get(entry.get("mood", 3), MOOD_COLORS[3]),
                "mood_label": MOOD_LABELS.get(entry.get("mood", 3), "Unknown"),
            })
        except Exception:
            continue

    results.sort(key=lambda e: e["date"], reverse=True)
    return {"entries": results}
