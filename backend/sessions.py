import uuid
import time
from threading import Lock


class SessionStore:
    def __init__(self, ttl_seconds: int = 86400):
        self._store: dict[str, dict] = {}
        self._ttl = ttl_seconds
        self._lock = Lock()

    def create(self, username: str, user_key: bytes) -> str:
        sid = uuid.uuid4().hex
        with self._lock:
            self._store[sid] = {
                "username": username,
                "user_key": user_key,
                "created_at": time.time(),
            }
        return sid

    def get(self, sid: str) -> dict | None:
        with self._lock:
            session = self._store.get(sid)
            if session is None:
                return None
            if time.time() - session["created_at"] > self._ttl:
                del self._store[sid]
                return None
            session["created_at"] = time.time()
            return session

    def delete(self, sid: str):
        with self._lock:
            self._store.pop(sid, None)


session_store = SessionStore()
