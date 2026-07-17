import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import auth, entries, export, search, stats, settings, freewrite
from backend.config import ensure_directories
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "form-action 'self'; "
            "base-uri 'self'"
        )
        return response


app = FastAPI(title="DailyMood API", version="1.0.0")

app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(entries.router)
app.include_router(export.router)
app.include_router(search.router)
app.include_router(stats.router)
app.include_router(settings.router)
app.include_router(freewrite.router)


@app.on_event("startup")
def startup():
    ensure_directories()
    # Initialize index table (no-op if already exists)
    try:
        from backend.index import init_index
        init_index()
    except Exception:
        pass


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/index-status")
def index_status():
    from backend.index import is_index_available, get_index_stats
    from backend.config import load_users, ENTRIES_DIR
    import os

    available = is_index_available()
    result = {"index_available": available, "users": []}

    if not available:
        return result

    users = load_users()
    for username in users:
        user_dir = os.path.join(ENTRIES_DIR, username)
        file_count = 0
        if os.path.exists(user_dir):
            for root, _, files in os.walk(user_dir):
                file_count += sum(1 for f in files if f.endswith(".enc"))

        stats = get_index_stats(username)
        result["users"].append({
            "username": username,
            "files_on_disk": file_count,
            "indexed": stats["indexed"],
            "status": "ok" if stats["indexed"] == file_count else f"mismatch (disk:{file_count} idx:{stats['indexed']})",
        })

    return result


FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")


@app.get("/{full_path:path}")
async def spa_serve(full_path: str):
    if not os.path.isdir(FRONTEND_DIR):
        raise HTTPException(404, "Frontend not built")

    file_path = os.path.join(FRONTEND_DIR, full_path)

    if full_path and os.path.isfile(file_path):
        return FileResponse(file_path)

    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")

    raise HTTPException(404)
