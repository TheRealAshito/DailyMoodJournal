import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from base64 import b64encode, b64decode
from backend.config import get_user_settings, save_user_settings, load_users, save_users
from backend.deps import get_current_session
from backend.crypto import generate_salt, derive_kek, wrap_user_key

router = APIRouter(prefix="/api/settings", tags=["settings"])

_PIN_RE = re.compile(r"^\d{4,8}$")

class SettingsUpdate(BaseModel):
    theme: str | None = None
    language: str | None = None
    reflection_categories: list[str] | None = None
    tags: dict | None = None
    custom_scales: list | None = None
    date_format: str | None = None
    sticky_note: str | None = None
    reminder_enabled: bool | None = None
    reminder_time: str | None = None
    reminder_timezone: str | None = None
    ntfy_url: str | None = None
    ntfy_priority: int | None = None
    ntfy_token: str | None = None


class PinSetRequest(BaseModel):
    pin: str
    require_on_device: bool = False


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
    if body.date_format is not None:
        updates["date_format"] = body.date_format
    if body.sticky_note is not None:
        updates["sticky_note"] = body.sticky_note
    if body.reminder_enabled is not None:
        updates["reminder_enabled"] = body.reminder_enabled
    if body.reminder_time is not None:
        updates["reminder_time"] = body.reminder_time
    if body.reminder_timezone is not None:
        updates["reminder_timezone"] = body.reminder_timezone
    if body.ntfy_url is not None:
        updates["ntfy_url"] = body.ntfy_url.strip()
    if body.ntfy_priority is not None:
        updates["ntfy_priority"] = max(1, min(5, body.ntfy_priority))
    if body.ntfy_token is not None:
        updates["ntfy_token"] = body.ntfy_token.strip()

    save_user_settings(session["username"], updates)
    return get_user_settings(session["username"])


@router.post("/pin")
def set_pin(body: PinSetRequest, session: dict = Depends(get_current_session)):
    """Set or change the device PIN (4-8 digits). Opt-in convenience feature.

    The PIN wraps the UEK exactly like the security answer does, so it can
    unlock journal access without the password on remembered devices.
    """
    if not _PIN_RE.match(body.pin):
        raise HTTPException(400, "PIN must be 4-8 digits")

    users = load_users()
    user_data = users[session["username"]]
    salt = b64encode(generate_salt()).decode()
    kek = derive_kek(body.pin, b64decode(salt.encode()))
    user_data["entry_key_encrypted_with_pin"] = wrap_user_key(session["user_key"], kek)
    user_data["entry_key_salt_pin"] = salt
    user_data["pin_required_on_device"] = bool(body.require_on_device)
    user_data["pin_fails"] = 0
    user_data.pop("pin_locked_until", None)
    save_users(users)
    return get_user_settings(session["username"])


@router.delete("/pin")
def remove_pin(session: dict = Depends(get_current_session)):
    users = load_users()
    user_data = users[session["username"]]
    for key in ("entry_key_encrypted_with_pin", "entry_key_salt_pin",
                "pin_required_on_device", "pin_fails", "pin_locked_until"):
        user_data.pop(key, None)
    save_users(users)
    return get_user_settings(session["username"])
