"""Shared FastAPI dependencies."""

from fastapi import Request, HTTPException
from backend.routers.auth import _get_session


def get_current_session(request: Request) -> dict:
    """Dependency that extracts and validates the session cookie.

    Use with FastAPI's Depends():
        @router.get("/protected")
        def protected(session: dict = Depends(get_current_session)):
            username = session["username"]
    """
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    return session
