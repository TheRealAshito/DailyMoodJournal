from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from backend.config import get_user_settings, save_user_settings
from backend.routers.auth import _get_session

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    theme: str | None = None
    language: str | None = None
    reflection_categories: list[str] | None = None
    tags: dict | None = None
    custom_scales: list | None = None


@router.get("")
def read_settings(request: Request):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    return get_user_settings(session["username"])


@router.put("")
def update_settings(request: Request, body: SettingsUpdate):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    updates = {}
    if body.theme is not None:
        updates["theme"] = body.theme
    if body.language is not None:
        updates["language"] = body.language
    if body.reflection_categories is not None:
        updates["reflection_categories"] = body.reflection_categories
    if body.tags is not None:
        updates["tags"] = body.tags
    if body.custom_scales is not None:
        updates["custom_scales"] = body.custom_scales

    save_user_settings(session["username"], updates)
    return get_user_settings(session["username"])
