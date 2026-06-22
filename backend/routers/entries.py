import os
from datetime import datetime, date
from fastapi import APIRouter, Request, HTTPException, UploadFile
from pydantic import BaseModel
from backend.entry_crud import (
    create_entry,
    get_entry,
    update_entry,
    delete_entry,
    get_entries_for_date,
    list_user_entries,
    get_all_tags_for_user,
)
from backend.utils import extract_date_from_path
from backend.config import MOOD_COLORS, MOOD_LABELS
from backend.routers.auth import _get_session

router = APIRouter(prefix="/api/entries", tags=["entries"])


class EntryCreate(BaseModel):
    title: str
    date: str
    mood: int
    tags: list[str] = []
    body: str = ""


class EntryUpdate(BaseModel):
    title: str
    date: str
    mood: int
    tags: list[str] = []
    body: str = ""


def _format_entry(entry: dict) -> dict:
    return {
        "title": entry.get("title", ""),
        "date": entry.get("date", ""),
        "mood": entry.get("mood", 3),
        "tags": entry.get("tags", []),
        "body": entry.get("body", ""),
        "author": entry.get("author", ""),
        "path": entry.get("path", ""),
        "mood_color": MOOD_COLORS.get(entry.get("mood", 3), MOOD_COLORS[3]),
        "mood_label": MOOD_LABELS.get(entry.get("mood", 3), "Unknown"),
    }


@router.get("")
def list_entries_by_month(request: Request, year: int, month: int):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    username = session["username"]
    user_key = session["user_key"]
    paths = list_user_entries(username)

    entries = []
    for path in paths:
        dt = extract_date_from_path(path)
        if dt is None or dt.year != year or dt.month != month:
            continue
        try:
            entry = get_entry(path, user_key)
            if entry:
                entries.append(_format_entry(entry))
        except Exception:
            continue

    entries.sort(key=lambda e: e["date"], reverse=True)
    return {"entries": entries}


@router.post("")
def create_new_entry(request: Request, body: EntryCreate):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    if body.mood < 0 or body.mood > 6:
        raise HTTPException(400, "Mood must be between 0 and 6")

    entry_data = {
        "title": body.title,
        "date": body.date,
        "mood": body.mood,
        "tags": body.tags,
        "body": body.body,
    }
    path = create_entry(session["username"], entry_data, session["user_key"])
    entry = get_entry(path, session["user_key"])
    return _format_entry(entry) if entry else {"path": path}


@router.get("/day/{date_str}")
def entries_for_day(request: Request, date_str: str):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(400, "Invalid date format (YYYY-MM-DD)")

    day_entries = get_entries_for_date(session["username"], target_date, session["user_key"])
    result = []
    for meta in day_entries:
        entry = get_entry(meta["path"], session["user_key"])
        if entry:
            result.append(_format_entry(entry))
    return {"entries": result}


@router.get("/tags/all")
def list_tags(request: Request):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    tags = get_all_tags_for_user(session["username"], session["user_key"])
    return {"tags": tags}


@router.get("/{path:path}")
def read_entry(request: Request, path: str):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    full_path = path
    if not os.path.isabs(full_path):
        raise HTTPException(404, "Invalid path")

    entry = get_entry(full_path, session["user_key"])
    if entry is None:
        raise HTTPException(404, "Entry not found")
    return _format_entry(entry)


@router.put("/{path:path}")
def edit_entry(request: Request, path: str, body: EntryUpdate):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    if body.mood < 0 or body.mood > 6:
        raise HTTPException(400, "Mood must be between 0 and 6")

    entry_data = {
        "title": body.title,
        "date": body.date,
        "mood": body.mood,
        "tags": body.tags,
        "body": body.body,
        "author": session["username"],
    }
    update_entry(path, entry_data, session["user_key"])
    entry = get_entry(path, session["user_key"])
    return _format_entry(entry) if entry else {"status": "ok"}


@router.delete("/{path:path}")
def remove_entry(request: Request, path: str):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    delete_entry(path)
    return {"status": "ok"}
