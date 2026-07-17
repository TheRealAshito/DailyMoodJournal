import json
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from backend.routers.auth import _get_session
from backend.config import DATA_DIR

router = APIRouter(prefix="/api/freewrite", tags=["freewrite"])


def _sessions_path(username: str) -> str:
    return os.path.join(DATA_DIR, f"{username}_freewrite.json")


def _load_sessions(username: str) -> list:
    path = _sessions_path(username)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_sessions(username: str, sessions: list):
    path = _sessions_path(username)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sessions, f, indent=2, ensure_ascii=False)


class CreateFreeWrite(BaseModel):
    title: str = ""


class UpdateFreeWrite(BaseModel):
    title: str = ""
    content: str = ""


@router.get("")
def list_sessions(request: Request):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    sessions = _load_sessions(session["username"])
    return {
        "sessions": [
            {
                "id": s["id"],
                "title": s["title"],
                "created_at": s["created_at"],
                "updated_at": s["updated_at"],
            }
            for s in sessions
        ]
    }


@router.post("")
def create_session(request: Request, body: CreateFreeWrite):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    sessions = _load_sessions(session["username"])
    now = datetime.now().isoformat()
    new_id = uuid.uuid4().hex[:12]
    new_s = {
        "id": new_id,
        "title": body.title or f"Free Write {len(sessions) + 1}",
        "content": "",
        "created_at": now,
        "updated_at": now,
    }
    sessions.insert(0, new_s)
    _save_sessions(session["username"], sessions)
    return new_s


@router.get("/{session_id}")
def get_session(request: Request, session_id: str):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    for s in _load_sessions(session["username"]):
        if s["id"] == session_id:
            return s
    raise HTTPException(404, "Session not found")


@router.put("/{session_id}")
def update_session(request: Request, session_id: str, body: UpdateFreeWrite):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    sessions = _load_sessions(session["username"])
    for s in sessions:
        if s["id"] == session_id:
            if body.title:
                s["title"] = body.title
            if body.content is not None:
                s["content"] = body.content
            s["updated_at"] = datetime.now().isoformat()
            _save_sessions(session["username"], sessions)
            return s
    raise HTTPException(404, "Session not found")


@router.delete("/{session_id}")
def delete_session(request: Request, session_id: str):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    sessions = _load_sessions(session["username"])
    sessions = [s for s in sessions if s["id"] != session_id]
    _save_sessions(session["username"], sessions)
    return {"status": "ok"}
