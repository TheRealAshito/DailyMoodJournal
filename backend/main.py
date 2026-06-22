import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.routers import auth, entries, export, search, stats, settings
from backend.config import ensure_directories

app = FastAPI(title="DailyMood API", version="1.0.0")

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


@app.on_event("startup")
def startup():
    ensure_directories()


@app.get("/api/health")
def health():
    return {"status": "ok"}


frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
