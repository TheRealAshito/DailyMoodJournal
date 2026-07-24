import json
import os
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from backend.routers.auth import _get_session
from backend.config import DATA_DIR, get_user_settings, EXPORT_NAMES
from backend.crypto import encrypt_entry, decrypt_entry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/freewrite", tags=["freewrite"])


def _sessions_path(username: str) -> str:
    """Path to encrypted freewrite file."""
    return os.path.join(DATA_DIR, f"{username}_freewrite.enc")


def _legacy_sessions_path(username: str) -> str:
    """Path to old plaintext freewrite file (pre-encryption)."""
    return os.path.join(DATA_DIR, f"{username}_freewrite.json")


def _load_sessions(username: str, user_key: bytes) -> list:
    """Load and decrypt freewrite sessions."""
    path = _sessions_path(username)
    if not os.path.exists(path):
        return []
    try:
        with open(path, "rb") as f:
            ciphertext = f.read()
        plaintext = decrypt_entry(ciphertext, user_key)
        return json.loads(plaintext)
    except Exception as e:
        logger.error(f"Failed to decrypt freewrite for {username}: {e}")
        return []


def _save_sessions(username: str, sessions: list, user_key: bytes):
    """Encrypt and save freewrite sessions."""
    path = _sessions_path(username)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    plaintext = json.dumps(sessions, indent=2, ensure_ascii=False)
    ciphertext = encrypt_entry(plaintext, user_key)
    with open(path, "wb") as f:
        f.write(ciphertext)


def migrate_freewrite(username: str, user_key: bytes) -> bool:
    """Migrate plaintext freewrite JSON to encrypted .enc.

    Called on login. If a plaintext .json file exists, encrypts it
    to .enc and deletes the plaintext version.

    Returns True if migration was performed.
    """
    legacy_path = _legacy_sessions_path(username)
    enc_path = _sessions_path(username)

    # Skip if no legacy file, or if encrypted file already exists
    if not os.path.exists(legacy_path):
        return False
    if os.path.exists(enc_path):
        # Both exist — legacy is stale, just delete it
        try:
            os.remove(legacy_path)
            logger.info(f"Deleted stale plaintext freewrite for {username}")
        except OSError as e:
            logger.warning(f"Failed to delete stale freewrite for {username}: {e}")
        return False

    try:
        with open(legacy_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Validate it's a list
        if not isinstance(data, list):
            logger.warning(f"Legacy freewrite for {username} is not a list, skipping migration")
            return False

        # Encrypt and save
        _save_sessions(username, data, user_key)

        # Delete plaintext
        os.remove(legacy_path)
        logger.info(f"Migrated freewrite for {username}: encrypted {len(data)} sessions")
        return True

    except Exception as e:
        logger.error(f"Failed to migrate freewrite for {username}: {e}")
        return False


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
    sessions = _load_sessions(session["username"], session["user_key"])
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


@router.get("/export/pdf")
def export_pdf(request: Request, ids: str = Query("")):
    """Export free write sessions as PDF. Pass ?ids=id1,id2 for specific sessions, or omit for all."""
    from backend.freewrite_pdf import build_freewrite_pdf

    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    username = session["username"]
    all_sessions = _load_sessions(username, session["user_key"])

    if ids:
        id_list = [i.strip() for i in ids.split(",") if i.strip()]
        selected = [s for s in all_sessions if s["id"] in id_list]
    else:
        selected = all_sessions

    if not selected:
        raise HTTPException(404, "No sessions to export")

    pdf_bytes = build_freewrite_pdf(username, selected)
    if pdf_bytes is None:
        raise HTTPException(500, "Failed to generate PDF")

    settings = get_user_settings(username)
    lang = settings.get("language", "en")
    base_name = EXPORT_NAMES.get(lang, EXPORT_NAMES["en"])["journal"]
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={base_name}_freewrite_{username}_{ts}.pdf"},
    )


@router.post("")
def create_session(request: Request, body: CreateFreeWrite):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    sessions = _load_sessions(session["username"], session["user_key"])
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
    _save_sessions(session["username"], sessions, session["user_key"])
    return new_s


@router.get("/{session_id}")
def get_session(request: Request, session_id: str):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    for s in _load_sessions(session["username"], session["user_key"]):
        if s["id"] == session_id:
            return s
    raise HTTPException(404, "Session not found")


@router.put("/{session_id}")
def update_session(request: Request, session_id: str, body: UpdateFreeWrite):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    sessions = _load_sessions(session["username"], session["user_key"])
    for s in sessions:
        if s["id"] == session_id:
            if body.title:
                s["title"] = body.title
            if body.content is not None:
                s["content"] = body.content
            s["updated_at"] = datetime.now().isoformat()
            _save_sessions(session["username"], sessions, session["user_key"])
            return s
    raise HTTPException(404, "Session not found")


@router.delete("/{session_id}")
def delete_session(request: Request, session_id: str):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    sessions = _load_sessions(session["username"], session["user_key"])
    sessions = [s for s in sessions if s["id"] != session_id]
    _save_sessions(session["username"], sessions, session["user_key"])
    return {"status": "ok"}
