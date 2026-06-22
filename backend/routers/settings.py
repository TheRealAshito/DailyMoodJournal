from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from backend.config import get_user_settings, save_user_settings
from backend.routers.auth import _get_session

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    theme: str | None = None
    language: str | None = None
    cbt_enabled_categories: list[str] | None = None
    cbt_show_education: bool | None = None


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
    if body.cbt_enabled_categories is not None:
        updates["cbt_enabled_categories"] = body.cbt_enabled_categories
    if body.cbt_show_education is not None:
        updates["cbt_show_education"] = body.cbt_show_education

    save_user_settings(session["username"], updates)
    return get_user_settings(session["username"])
