from fastapi import APIRouter, Depends
from pydantic import BaseModel
from backend.config import get_user_settings, save_user_settings
from backend.deps import get_current_session

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    theme: str | None = None
    language: str | None = None
    reflection_categories: list[str] | None = None
    tags: dict | None = None
    custom_scales: list | None = None


@router.get("")
def read_settings(session: dict = Depends(get_current_session)):
    return get_user_settings(session["username"])


@router.put("")
def update_settings(body: SettingsUpdate, session: dict = Depends(get_current_session)):
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
