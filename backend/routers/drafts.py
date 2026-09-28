"""Encrypted draft autosave for the diary entry form.

Drafts persist unsaved entry-form state while typing (same idea as the
free write autosave). Stored encrypted at rest in
`data/{username}_drafts.enc` as a JSON dict:

    {key: {"payload": {...form state...}, "updated_at": iso8601}}

Keys are "new" for a new entry draft, or the entry's absolute path when
editing an existing entry. Drafts are a cache-like convenience layer:
deleting the file is harmless (the user just loses unsaved work).
"""

import json
import logging
import os
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import backend.config as config
from backend.crypto import encrypt_entry, decrypt_entry
from backend.routers.auth import _get_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/drafts", tags=["drafts"])


def _drafts_path(username: str) -> str:
    """Path to the encrypted drafts file for a user."""
    return os.path.join(config.DATA_DIR, f"{username}_drafts.enc")


def _load_drafts(username: str, user_key: bytes) -> dict:
    """Load and decrypt all drafts for a user. Returns {} on any failure."""
    path = _drafts_path(username)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "rb") as f:
            ciphertext = f.read()
        plaintext = decrypt_entry(ciphertext, user_key)
        return json.loads(plaintext)
    except Exception as e:
        logger.error(f"Failed to decrypt drafts for {username}: {e}")
        return {}


def _save_drafts(username: str, drafts: dict, user_key: bytes):
    """Encrypt and save the drafts dict."""
    path = _drafts_path(username)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    plaintext = json.dumps(drafts, indent=2, ensure_ascii=False)
    ciphertext = encrypt_entry(plaintext, user_key)
    with open(path, "wb") as f:
        f.write(ciphertext)


def get_draft(username: str, key: str, user_key: bytes) -> dict | None:
    """Return the draft record for a key, or None."""
    return _load_drafts(username, user_key).get(key)


def save_draft(username: str, key: str, payload: dict, user_key: bytes) -> dict:
    """Upsert a draft and return its record (payload + updated_at)."""
    drafts = _load_drafts(username, user_key)
    record = {"payload": payload, "updated_at": datetime.now().isoformat()}
    drafts[key] = record
    _save_drafts(username, drafts, user_key)
    return record


def delete_draft(username: str, key: str, user_key: bytes) -> bool:
    """Delete a draft. Returns True if one existed."""
    drafts = _load_drafts(username, user_key)
    if key not in drafts:
        return False
    del drafts[key]
    _save_drafts(username, drafts, user_key)
    return True


class DraftPayload(BaseModel):
    """Full entry-form state. All fields optional so old/new clients mix fine."""
    title: str | None = None
    body: str | None = None
    mood: int | None = None
    tags: list[str] | None = None
    scales: dict | None = None
    date: str | None = None
    time: str | None = None
    include_prompts: bool | None = None
    prompts: list | None = None
    responses: list[str] | None = None


@router.get("/{key:path}")
def read_draft(request: Request, key: str):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    record = get_draft(session["username"], key, session["user_key"])
    if record is None:
        raise HTTPException(404, "Draft not found")
    return {"key": key, **record}


@router.put("/{key:path}")
def write_draft(request: Request, key: str, body: DraftPayload):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    record = save_draft(
        session["username"], key, body.model_dump(exclude_none=True), session["user_key"]
    )
    return {"key": key, **record}


@router.delete("/{key:path}")
def remove_draft(request: Request, key: str):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    delete_draft(session["username"], key, session["user_key"])
    return {"status": "ok"}
