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

router = APIRouter(prefix="/api/auth", tags=["auth"])

SESSION_COOKIE = "dailymood_session"


def _set_session_cookie(response: Response, sid: str):
    response.set_cookie(
        key=SESSION_COOKIE,
        value=sid,
        httponly=True,
        samesite="lax",
        max_age=86400,
    )


def _get_session(request: Request) -> dict | None:
    sid = request.cookies.get(SESSION_COOKIE)
    if not sid:
        return None
    return session_store.get(sid)


class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    username: str
    password: str
    security_question: str
    security_answer: str


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
def login(body: LoginRequest, response: Response):
    users = load_users()
    if body.username not in users:
        raise HTTPException(401, "Invalid credentials")
    user_data = users[body.username]
    if not verify_password(body.password, user_data["salt"], user_data["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    kek = derive_kek(body.password, b64decode(user_data["entry_key_salt_pwd"].encode()))
    user_key = unwrap_user_key(user_data["entry_key_encrypted_with_pwd"], kek)
    if user_key is None:
        raise HTTPException(500, "Failed to decrypt encryption key")

    sid = session_store.create(body.username, user_key)
    _set_session_cookie(response, sid)

    return {
        "username": body.username,
        "settings": get_user_settings(body.username),
    }


@router.post("/signup")
def signup(body: SignupRequest, response: Response):
    if not body.username.strip():
        raise HTTPException(400, "Username is required")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if not body.security_answer.strip():
        raise HTTPException(400, "Security answer is required")

    users = load_users()
    if body.username in users:
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

    users[body.username] = {
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
        "cbt_enabled_categories": ["distortions", "reframing"],
        "cbt_show_education": True,
    }
    save_users(users)

    sid = session_store.create(body.username, user_key)
    _set_session_cookie(response, sid)

    return {
        "username": body.username,
        "settings": get_user_settings(body.username),
    }


@router.post("/logout")
def logout(response: Response, request: Request):
    sid = request.cookies.get(SESSION_COOKIE)
    if sid:
        session_store.delete(sid)
    response.delete_cookie(SESSION_COOKIE)
    return {"status": "ok"}


@router.post("/password-reset-request")
def reset_request(body: LoginRequest):
    users = load_users()
    if body.username not in users:
        return {"question": None}
    return {"question": users[body.username]["security_question"]}


@router.post("/password-reset-verify")
def reset_verify(body: LoginRequest):
    users = load_users()
    if body.username not in users:
        raise HTTPException(404, "User not found")
    user_data = users[body.username]
    secret_salt = b64decode(user_data["entry_key_salt_secret"].encode())
    kek_secret = derive_kek(body.password, secret_salt)
    user_key = unwrap_user_key(user_data["entry_key_encrypted_with_secret"], kek_secret)
    if user_key is None:
        raise HTTPException(401, "Incorrect answer")

    reset_sid = session_store.create(body.username, user_key)
    return {"token": reset_sid}


class ResetCompleteRequest(BaseModel):
    username: str
    token: str
    new_password: str


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

    return {"status": "ok"}
