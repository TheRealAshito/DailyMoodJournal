import os
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from backend.routers.auth import _get_session
from backend.config import DATA_DIR

router = APIRouter(prefix="/api/freewrite", tags=["freewrite"])


def _freewrite_path(username: str) -> str:
    return os.path.join(DATA_DIR, f"{username}_freewrite.md")


class FreeWriteBody(BaseModel):
    content: str


@router.get("")
def get_freewrite(request: Request):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    path = _freewrite_path(session["username"])
    if not os.path.exists(path):
        return {"content": ""}
    with open(path, "r", encoding="utf-8") as f:
        return {"content": f.read()}


@router.put("")
def save_freewrite(request: Request, body: FreeWriteBody):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    path = _freewrite_path(session["username"])
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(body.content)
    return {"status": "ok"}
