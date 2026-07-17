"""SQLite metadata index for fast entry lookups.

The index is a CACHE — the encrypted .enc files are always the source
of truth. The index can be deleted and rebuilt at any time.

Usage:
    from backend.index import init_index, rebuild_index, add_to_index, \
        update_in_index, remove_from_index, query_entries
"""

import json
import logging
import os
import sqlite3
from datetime import date, datetime
from typing import Optional

from backend.config import DATA_DIR, ENTRIES_DIR

logger = logging.getLogger(__name__)

DB_FILENAME = "index.db"


def _db_path() -> str:
    return os.path.join(DATA_DIR, DB_FILENAME)


def _connect() -> sqlite3.Connection:
    """Return a connection with WAL mode and row_factory."""
    conn = sqlite3.connect(_db_path(), timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.row_factory = sqlite3.Row
    return conn


def init_index():
    """Create the index table if it doesn't exist."""
    conn = _connect()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS entry_index (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                path TEXT NOT NULL,
                date TEXT NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                mood INTEGER NOT NULL,
                tags TEXT NOT NULL,
                title TEXT NOT NULL,
                dailymood_version TEXT
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_path ON entry_index(path);
            CREATE INDEX IF NOT EXISTS idx_user_date ON entry_index(username, date);
            CREATE INDEX IF NOT EXISTS idx_user_year_month ON entry_index(username, year, month);
        """)
        conn.commit()
    finally:
        conn.close()


def is_index_available() -> bool:
    """Check if the index DB file exists and has the table."""
    if not os.path.exists(_db_path()):
        return False
    try:
        conn = _connect()
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='entry_index'"
        ).fetchone()
        conn.close()
        return row is not None
    except Exception:
        return False


def rebuild_index(username: str, user_key: bytes):
    """Full re-scan of a user's entries. Decrypts each .enc file to
    extract metadata and populates the index.

    This is the only function that does bulk decryption — all other
    reads should use the index.
    """
    from backend.entry_crud import get_entry
    from backend.utils import list_user_entries, extract_date_from_path

    init_index()
    entries = list_user_entries(username)
    conn = _connect()
    try:
        # Clear existing entries for this user
        conn.execute("DELETE FROM entry_index WHERE username = ?", (username,))

        for path in entries:
            try:
                entry = get_entry(path, user_key)
                if entry is None:
                    continue

                dt = extract_date_from_path(path)
                if dt is None:
                    continue

                tags = entry.get("tags", [])
                if isinstance(tags, list):
                    tags_json = json.dumps(tags)
                else:
                    tags_json = json.dumps([])

                conn.execute(
                    """INSERT OR REPLACE INTO entry_index
                       (username, path, date, year, month, mood, tags, title, dailymood_version)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        username,
                        path,
                        dt.strftime("%Y-%m-%d"),
                        dt.year,
                        dt.month,
                        entry.get("mood", 3),
                        tags_json,
                        entry.get("title", "Untitled"),
                        entry.get("dailymood_version", ""),
                    ),
                )
            except Exception as e:
                logger.warning(f"Index: failed to process {path}: {e}")
                continue

        conn.commit()
        logger.info(f"Index rebuilt for {username}: {len(entries)} entries scanned")
    finally:
        conn.close()


def add_to_index(username: str, entry_data: dict, path: str):
    """Add a single entry to the index (called after create_entry)."""
    init_index()
    dt_str = entry_data.get("date", "")
    if isinstance(dt_str, str):
        try:
            dt = datetime.fromisoformat(dt_str)
        except ValueError:
            dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
    elif isinstance(dt_str, datetime):
        dt = dt_str
    else:
        return

    tags = entry_data.get("tags", [])
    tags_json = json.dumps(tags) if isinstance(tags, list) else json.dumps([])

    conn = _connect()
    try:
        conn.execute(
            """INSERT OR REPLACE INTO entry_index
               (username, path, date, year, month, mood, tags, title, dailymood_version)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                username,
                path,
                dt.strftime("%Y-%m-%d"),
                dt.year,
                dt.month,
                entry_data.get("mood", 3),
                tags_json,
                entry_data.get("title", "Untitled"),
                entry_data.get("dailymood_version", ""),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def update_in_index(entry_data: dict, path: str):
    """Update an existing entry in the index (called after update_entry)."""
    init_index()
    dt_str = entry_data.get("date", "")
    if isinstance(dt_str, str):
        try:
            dt = datetime.fromisoformat(dt_str)
        except ValueError:
            dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
    elif isinstance(dt_str, datetime):
        dt = dt_str
    else:
        return

    tags = entry_data.get("tags", [])
    tags_json = json.dumps(tags) if isinstance(tags, list) else json.dumps([])

    conn = _connect()
    try:
        conn.execute(
            """UPDATE entry_index
               SET date = ?, year = ?, month = ?, mood = ?, tags = ?, title = ?, dailymood_version = ?
               WHERE path = ?""",
            (
                dt.strftime("%Y-%m-%d"),
                dt.year,
                dt.month,
                entry_data.get("mood", 3),
                tags_json,
                entry_data.get("title", "Untitled"),
                entry_data.get("dailymood_version", ""),
                path,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def remove_from_index(path: str):
    """Remove an entry from the index (called after delete_entry)."""
    if not is_index_available():
        return
    conn = _connect()
    try:
        conn.execute("DELETE FROM entry_index WHERE path = ?", (path,))
        conn.commit()
    finally:
        conn.close()


def query_entries(
    username: str,
    year: Optional[int] = None,
    month: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    tags: Optional[list[str]] = None,
) -> list[dict]:
    """Query the index for entries matching filters.

    Returns list of dicts with keys: path, date, year, month, mood, tags, title.
    Only metadata is returned — decrypt the entry separately if you need the body.
    """
    if not is_index_available():
        return []

    conditions = ["username = ?"]
    params: list = [username]

    if year is not None:
        conditions.append("year = ?")
        params.append(year)
    if month is not None:
        conditions.append("month = ?")
        params.append(month)
    if date_from is not None:
        conditions.append("date >= ?")
        params.append(date_from.isoformat())
    if date_to is not None:
        conditions.append("date <= ?")
        params.append(date_to.isoformat())

    where = " AND ".join(conditions)
    sql = f"SELECT path, date, year, month, mood, tags, title FROM entry_index WHERE {where} ORDER BY date DESC, path DESC"

    conn = _connect()
    try:
        rows = conn.execute(sql, params).fetchall()
    finally:
        conn.close()

    results = []
    for row in rows:
        entry_tags = json.loads(row["tags"])
        # Tag filter (must match ALL selected tags)
        if tags and not all(t in entry_tags for t in tags):
            continue
        results.append({
            "path": row["path"],
            "date": row["date"],
            "year": row["year"],
            "month": row["month"],
            "mood": row["mood"],
            "tags": entry_tags,
            "title": row["title"],
        })

    return results


def get_entry_metadata(path: str) -> Optional[dict]:
    """Get metadata for a single entry by path."""
    if not is_index_available():
        return None
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT path, date, year, month, mood, tags, title FROM entry_index WHERE path = ?",
            (path,),
        ).fetchone()
    finally:
        conn.close()

    if row is None:
        return None
    return {
        "path": row["path"],
        "date": row["date"],
        "year": row["year"],
        "month": row["month"],
        "mood": row["mood"],
        "tags": json.loads(row["tags"]),
        "title": row["title"],
    }


def get_all_tags(username: str) -> list[str]:
    """Get all unique tags for a user from the index."""
    if not is_index_available():
        return []
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT tags FROM entry_index WHERE username = ?", (username,)
        ).fetchall()
    finally:
        conn.close()

    tags_set = set()
    for row in rows:
        for tag in json.loads(row["tags"]):
            tags_set.add(tag)
    return sorted(tags_set)


def get_index_stats(username: str) -> dict:
    """Get index statistics for a user."""
    if not is_index_available():
        return {"indexed": 0}
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM entry_index WHERE username = ?", (username,)
        ).fetchone()
    finally:
        conn.close()
    return {"indexed": row["cnt"]}
