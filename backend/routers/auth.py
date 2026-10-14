import re
import time
from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel
from datetime import datetime
from base64 import b64encode, b64decode
from backend.crypto import (
    generate_user_key,
    generate_salt,
    derive_kek,
    wrap_user_key,
    unwrap_user_key,
    hash_password,
    verify_password,
)
from backend.config import load_users, save_users, ensure_directories, get_user_settings
from backend.sessions import session_store
from backend import device_tokens

router = APIRouter(prefix="/api/auth", tags=["auth"])

_SANE_USERNAME = re.compile(r"^[a-zA-Z0-9_\-\.]{2,32}$")
SESSION_COOKIE = "dailymood_session"
DEVICE_COOKIE = device_tokens.COOKIE_NAME
DEVICE_COOKIE_MAX_AGE = 180 * 86400

PIN_LOCK_THRESHOLD = 5
PIN_LOCK_SECONDS = 900


def _resolve_username(users: dict, raw: str) -> str | None:
    """Map a submitted username to the stored key in users.json.

    Lookup order preserves backward compatibility:
    1. Exact raw match — behavior is unchanged for every existing account.
    2. Trimmed match — stray leading/trailing spaces typed at login are ignored.
    3. Any stored key equal to the trimmed input — legacy accounts whose key
       contains whitespace stay reachable without migrating users.json.
    """
    if raw in users:
        return raw
    trimmed = raw.strip()
    if not trimmed:
        return None
    if trimmed in users:
        return trimmed
    for key in users:
        if key.strip() == trimmed:
            return key
    return None


def _set_session_cookie(response: Response, sid: str):
    response.set_cookie(
        key=SESSION_COOKIE,
        value=sid,
        httponly=True,
        samesite="lax",
        max_age=86400,
    )


def _set_device_cookie(response: Response, cookie_value: str):
    response.set_cookie(
        key=DEVICE_COOKIE,
        value=cookie_value,
        httponly=True,
        samesite="lax",
        max_age=DEVICE_COOKIE_MAX_AGE,
    )


def _pin_locked(user_data: dict) -> bool:
    try:
        return time.time() < float(user_data.get("pin_locked_until", 0))
    except (TypeError, ValueError):
        return False


def _register_pin_failure(users: dict, username: str, user_data: dict):
    """Count failures and lock the PIN briefly after too many (brute force)."""
    fails = int(user_data.get("pin_fails", 0)) + 1
    user_data["pin_fails"] = fails
    if fails >= PIN_LOCK_THRESHOLD:
        user_data["pin_locked_until"] = time.time() + PIN_LOCK_SECONDS
        user_data["pin_fails"] = 0
    save_users(users)


def _verify_pin(users: dict, username: str, user_data: dict, pin: str | None) -> bytes | None:
    """Return the user key if the PIN is correct, else None. Lockout-aware."""
    if not pin or not user_data.get("entry_key_encrypted_with_pin"):
        return None
    if _pin_locked(user_data):
        return None
    try:
        salt = b64decode(user_data["entry_key_salt_pin"].encode())
    except (KeyError, ValueError):
        return None
    kek = derive_kek(pin, salt)
    user_key = unwrap_user_key(user_data["entry_key_encrypted_with_pin"], kek)
    if user_key is None:
        _register_pin_failure(users, username, user_data)
        return None
    user_data["pin_fails"] = 0
    return user_key


def _get_session(request: Request) -> dict | None:
    sid = request.cookies.get(SESSION_COOKIE)
    if not sid:
        return None
    return session_store.get(sid)


class LoginRequest(BaseModel):
    username: str
    password: str = ""
    pin: str | None = None
    remember_device: bool = False
    device_label: str | None = None


class SignupRequest(BaseModel):
    username: str
    password: str
    security_question: str
    security_answer: str


class DeviceLoginRequest(BaseModel):
    username: str
    pin: str | None = None


class LogoutRequest(BaseModel):
    forget_device: bool = False


class ResetUsernameRequest(BaseModel):
    username: str


class ResetAnswerRequest(BaseModel):
    username: str
    answer: str


class ResetCompleteRequest(BaseModel):
    username: str
    token: str
    new_password: str


class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str


@router.get("/me")
def me(request: Request):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    return {
        "username": session["username"],
        "settings": get_user_settings(session["username"]),
    }


@router.post("/login")
def login(body: LoginRequest, response: Response, request: Request):
    users = load_users()
    username = _resolve_username(users, body.username)
    if username is None:
        raise HTTPException(401, "Invalid credentials")
    user_data = users[username]

    # Primary auth: password. Opt-in alternative: PIN (4-8 digits).
    user_key = None
    if body.password:
        if not verify_password(body.password, user_data["salt"], user_data["password_hash"]):
            raise HTTPException(401, "Invalid credentials")
        kek = derive_kek(body.password, b64decode(user_data["entry_key_salt_pwd"].encode()))
        user_key = unwrap_user_key(user_data["entry_key_encrypted_with_pwd"], kek)
        if user_key is None:
            raise HTTPException(401, "Invalid credentials")
    elif body.pin:
        user_key = _verify_pin(users, username, user_data, body.pin)
        if user_key is None:
            raise HTTPException(401, "Invalid credentials")
        save_users(users)  # persist pin_fails reset
    else:
        raise HTTPException(401, "Invalid credentials")

    sid = session_store.create(username, user_key)
    _set_session_cookie(response, sid)

    # Remember this device: long-lived token cookie, separate from the session.
    if body.remember_device:
        label = (body.device_label or "").strip() or request.headers.get("user-agent", "Unknown device")[:100]
        device_cookie = request.cookies.get(DEVICE_COOKIE)
        if device_cookie and device_tokens.verify_device(device_cookie):
            device_tokens.add_user_to_device(device_cookie, username, user_key, label)
        else:
            new_cookie, _ = device_tokens.create_device(username, user_key, label)
            _set_device_cookie(response, new_cookie)

    # Lazy index rebuild for migration (existing entries but no index)
    try:
        from backend.index import is_index_available, get_index_stats, rebuild_index
        from backend.utils import list_user_entries
        import threading
        if is_index_available():
            stats = get_index_stats(username)
            file_count = len(list_user_entries(username))
            if stats["indexed"] == 0 and file_count > 0:
                threading.Thread(target=rebuild_index, args=(username, user_key), daemon=True).start()
    except Exception:
        pass

    # Migrate plaintext freewrite files to encrypted
    try:
        from backend.routers.freewrite import migrate_freewrite
        migrate_freewrite(username, user_key)
    except Exception:
        pass

    return {
        "username": username,
        "settings": get_user_settings(username),
    }


@router.post("/signup")
def signup(body: SignupRequest, response: Response):
    username = body.username.strip()
    if not username:
        raise HTTPException(400, "Username is required")
    if not _SANE_USERNAME.match(username):
        raise HTTPException(400, "Username must be 2-32 characters: letters, numbers, hyphens, dots, underscores")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if not body.security_answer.strip():
        raise HTTPException(400, "Security answer is required")

    users = load_users()
    if _resolve_username(users, username) is not None:
        raise HTTPException(409, "Username already exists")

    ensure_directories()

    user_key = generate_user_key()
    salt = b64encode(generate_salt()).decode()

    kek_pwd = derive_kek(body.password, b64decode(salt.encode()))
    wrapped_pwd = wrap_user_key(user_key, kek_pwd)

    salt_secret = b64encode(generate_salt()).decode()
    kek_secret = derive_kek(body.security_answer, b64decode(salt_secret.encode()))
    wrapped_secret = wrap_user_key(user_key, kek_secret)

    password_hash = hash_password(body.password, salt)

    users[username] = {
        "created_at": datetime.now().isoformat(),
        "salt": salt,
        "password_hash": password_hash,
        "entry_key_encrypted_with_pwd": wrapped_pwd,
        "entry_key_salt_pwd": salt,
        "entry_key_encrypted_with_secret": wrapped_secret,
        "entry_key_salt_secret": salt_secret,
        "security_question": body.security_question,
        "theme": "light",
        "language": "en",
        "reflection_categories": ["self_reflection", "gratitude", "growth_learning", "emotional_awareness"],
    }
    save_users(users)

    sid = session_store.create(username, user_key)
    _set_session_cookie(response, sid)

    return {
        "username": username,
        "settings": get_user_settings(username),
    }


@router.post("/logout")
def logout(response: Response, request: Request, body: LogoutRequest | None = None):
    sid = request.cookies.get(SESSION_COOKIE)
    session = session_store.get(sid) if sid else None
    if sid:
        session_store.delete(sid)
    if body and body.forget_device and session:
        device_cookie = request.cookies.get(DEVICE_COOKIE)
        if device_cookie:
            device_tokens.remove_user(device_cookie, session["username"])
    response.delete_cookie(SESSION_COOKIE)
    return {"status": "ok"}


@router.get("/devices")
def remembered_devices(request: Request):
    """Users remembered on this device (login-page picker). No session needed."""
    device_cookie = request.cookies.get(DEVICE_COOKIE)
    if not device_cookie:
        return {"users": []}
    return {"users": device_tokens.get_remembered_users(device_cookie)}


@router.post("/device-login")
def device_login(body: DeviceLoginRequest, request: Request, response: Response):
    """Sign in via device token alone ('continue as'). PIN is asked only when
    the user configured require_on_device."""
    device_cookie = request.cookies.get(DEVICE_COOKIE)
    if not device_cookie:
        raise HTTPException(401, "Device not remembered")

    users = load_users()
    username = _resolve_username(users, body.username)
    if username is None:
        raise HTTPException(401, "Device not remembered")
    user_data = users[username]

    if user_data.get("pin_required_on_device"):
        if _verify_pin(users, username, user_data, body.pin) is None:
            save_users(users)  # persist pin_fails counter
            raise HTTPException(401, "PIN required")

    user_key = device_tokens.device_login(device_cookie, username)
    if user_key is None:
        raise HTTPException(401, "Device not remembered")

    sid = session_store.create(username, user_key)
    _set_session_cookie(response, sid)
    return {"username": username, "settings": get_user_settings(username)}


@router.get("/my-devices")
def my_devices(request: Request):
    """All devices remembering the signed-in user (Settings page)."""
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    username = session["username"]
    device_cookie = request.cookies.get(DEVICE_COOKIE)
    current_id = device_tokens.verify_device(device_cookie) if device_cookie else None
    devices = device_tokens.list_devices_for_user(username)
    for d in devices:
        d["current"] = d["device_id"] == current_id
    return {"devices": devices}


@router.delete("/my-devices/{device_id}")
def revoke_device(device_id: str, request: Request):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    device_tokens.revoke_device_for_user(device_id, session["username"])
    return {"status": "ok"}


@router.delete("/my-devices")
def revoke_all_devices(request: Request):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    device_tokens.revoke_user_everywhere(session["username"])
    return {"status": "ok"}


@router.post("/password-reset-request")
def reset_request(body: ResetUsernameRequest):
    users = load_users()
    username = _resolve_username(users, body.username)
    if username is None:
        return {"question": None}
    return {"question": users[username]["security_question"]}


@router.post("/password-reset-verify")
def reset_verify(body: ResetAnswerRequest):
    users = load_users()
    username = _resolve_username(users, body.username)
    if username is None:
        raise HTTPException(404, "User not found")
    user_data = users[username]
    secret_salt = b64decode(user_data["entry_key_salt_secret"].encode())
    kek_secret = derive_kek(body.answer, secret_salt)
    user_key = unwrap_user_key(user_data["entry_key_encrypted_with_secret"], kek_secret)
    if user_key is None:
        raise HTTPException(401, "Incorrect answer")

    reset_sid = session_store.create(username, user_key)
    return {"token": reset_sid}


@router.post("/password-reset-complete")
def reset_complete(body: ResetCompleteRequest):
    session = session_store.get(body.token)
    if session is None:
        raise HTTPException(401, "Invalid or expired reset token")

    if len(body.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    users = load_users()
    username = session["username"]
    user_key = session["user_key"]

    new_salt = b64encode(generate_salt()).decode()
    new_kek = derive_kek(body.new_password, b64decode(new_salt.encode()))
    new_wrapped = wrap_user_key(user_key, new_kek)
    new_hash = hash_password(body.new_password, new_salt)

    users[username]["salt"] = new_salt
    users[username]["password_hash"] = new_hash
    users[username]["entry_key_encrypted_with_pwd"] = new_wrapped
    users[username]["entry_key_salt_pwd"] = new_salt
    save_users(users)

    device_tokens.revoke_user_everywhere(username)
    session_store.delete(body.token)
    return {"status": "ok"}


@router.put("/password")
def change_password(body: PasswordChangeRequest, request: Request):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    users = load_users()
    username = session["username"]
    user_data = users[username]
    user_key = session["user_key"]

    if not verify_password(body.old_password, user_data["salt"], user_data["password_hash"]):
        raise HTTPException(401, "Current password is incorrect")

    if len(body.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")

    new_salt = b64encode(generate_salt()).decode()
    new_kek = derive_kek(body.new_password, b64decode(new_salt.encode()))
    new_wrapped = wrap_user_key(user_key, new_kek)
    new_hash = hash_password(body.new_password, new_salt)

    users[username]["salt"] = new_salt
    users[username]["password_hash"] = new_hash
    users[username]["entry_key_encrypted_with_pwd"] = new_wrapped
    users[username]["entry_key_salt_pwd"] = new_salt
    save_users(users)

    # A password change invalidates remembered devices (defensive default).
    device_tokens.revoke_user_everywhere(username)
    return {"status": "ok"}
