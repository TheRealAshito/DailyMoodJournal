# DailyMoodJournal - Refactor Plan

> Goal: Improve code quality, eliminate AI-generated code smells, fix
> performance bottlenecks, and make the codebase resilient to future
> changes (human or AI-driven).

---

## Phase 1 — Safety Net & Cleanup

### 1. Add Tests for Crypto + Entry CRUD
- **Files to create:** `tests/test_crypto.py`, `tests/test_entry_crud.py`, `tests/test_utils.py`, `tests/conftest.py`
- **What to test:**
  - crypto.py: encrypt/decrypt roundtrip, key generation, key wrap/unwrap, password hash/verify, PBKDFK derivation
  - entry_crud.py: create entry -> read it back, update entry, delete entry, list entries, get entries for date
  - utils.py: build_entry_path, parse_entry_text, build_entry_text, extract_date_from_path, validate_entry_data
  - export_import.py: export archive -> import back -> verify entries match, PDF generation doesn't crash
- **Framework:** pytest
- **Add to requirements.txt:** `pytest>=8.0`

### 9. Remove numpy Dependency
- **File:** `backend/routers/stats.py`
- **Change:** Replace `np.mean(all_moods)` with `sum(all_moods) / len(all_moods)` (already wrapped in round())
- **File:** `requirements.txt`
- **Change:** Remove `numpy>=1.24`
- **Why:** 50MB package for one function call. Faster Docker builds, smaller image.

### 4. Consolidate Imports and Remove Weird Patterns
- **File:** `backend/routers/freewrite.py`
  - Replace `__import__("json")` calls (lines 21, 28) with normal `import json` at top of file
- **File:** `backend/routers/stats.py`
  - Remove `import numpy as np` (covered by #9)
- **File:** `backend/export_import.py`
  - Line 9: `from backend.config import MOOD_COLORS as MOOD_COLORS_RGB` — rename to just `MOOD_COLORS` and adjust usage, or keep the alias but document why
- **General:** Audit all imports across backend for circular or indirect patterns

---

## Phase 2 — Metadata Index

### 2. Metadata Index (SQLite)
- **File to create:** `backend/index.py`
- **Schema:**
  ```sql
  CREATE TABLE entry_index (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,        -- ISO format YYYY-MM-DD
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      mood INTEGER NOT NULL,
      tags TEXT NOT NULL,        -- JSON array
      title TEXT NOT NULL,
      dailymood_version TEXT
  );
  CREATE INDEX idx_user_date ON entry_index(username, date);
  CREATE INDEX idx_user_year_month ON entry_index(username, year, month);
  ```
- **DB location:** `data/index.db` (alongside users.json)
- **Operations:**
  - `rebuild_index(username, user_key)` — full re-scan of entries dir, decrypt each, populate index. Run on startup or when index is missing/corrupt.
  - `add_to_index(username, entry_data, path)` — called after create_entry
  - `update_in_index(username, entry_data, path)` — called after update_entry
  - `remove_from_index(path)` — called after delete_entry
  - `query_entries(username, year=None, month=None, date_from=None, date_to=None, tags=None)` — replaces the decrypt-everything loops
- **Files to modify:**
  - `backend/entry_crud.py` — call index update on create/update/delete
  - `backend/routers/entries.py` — use index for list_entries_by_month, entries_for_day
  - `backend/routers/stats.py` — use index for date/tag filtering, only decrypt entries that pass filters
  - `backend/routers/search.py` — use index for date/tag filtering
  - `backend/main.py` — trigger index rebuild on startup if needed
- **Important:** Index stores metadata only (no body text, no encryption keys). The encrypted .enc files remain the source of truth. Index can always be rebuilt from files.

---

## Phase 3 — Single Source of Truth & Error Handling

### 3. Eliminate Duplicated Constants
- **File to create:** `backend/routers/constants.py` (or add route to existing router)
- **Endpoint:** `GET /api/constants` — returns MOOD_COLORS, MOOD_LABELS, MOOD_EMOJIS, DEFAULT_TAGS
- **File to modify:** `backend/config.py` — keep as the source, the endpoint reads from here
- **Frontend files to modify:**
  - `frontend/src/contexts/ConstantsContext.jsx` (new) — fetches /api/constants once on app load, provides via context
  - `frontend/src/components/Calendar.jsx` — remove local MOOD_COLORS, use context
  - `frontend/src/components/Stats.jsx` — remove local MOOD_COLORS, use context
  - `frontend/src/components/EntryForm.jsx` — remove local PROMPT_CATEGORIES if applicable
  - `frontend/src/components/EntryCard.jsx` — use context for mood colors
  - `frontend/src/components/MoodSlider.jsx` — use context for mood emojis/colors

### 6. Proper Error Boundaries
- **Backend changes:**
  - Replace bare `except Exception: continue` with `except Exception as e: logger.warning(f"Failed to process {path}: {e}")`
  - Add `import logging` and `logger = logging.getLogger(__name__)` in stats.py, entries.py, search.py
  - In entry_crud.py get_entry(): return a special result (e.g., `{"error": "decryption_failed", "path": path}`) instead of None when decryption fails, so the UI can show "unreadable entry" instead of silently hiding it
- **Frontend changes:**
  - When an entry has an error field, show it as a red card with "Entry unreadable" instead of hiding it
  - Add a React ErrorBoundary component wrapping ProtectedLayout that catches render crashes and shows a recovery UI

---

## Phase 4 — Code Structure

### 5. Extract Shared Patterns into Helpers
- **File to create:** `backend/deps.py`
- **Contents:**
  ```python
  def get_current_session(request: Request) -> dict:
      """Dependency that extracts and validates session. Raises 401 if not found."""
      session = _get_session(request)
      if session is None:
          raise HTTPException(401, "Not authenticated")
      return session
  ```
- **File to modify:** All routers — replace the repeated `_get_session` + null check pattern with `Depends(get_current_session)`
- **Benefit:** Each router endpoint loses 3-4 lines of boilerplate. The auth check is guaranteed consistent everywhere.
- **Additional helper in entry_crud.py or a new `backend/entry_helpers.py`:**
  - `get_entries_filtered(username, user_key, year=None, month=None, date_from=None, date_to=None, tags=None)` — uses the index (#2) and returns formatted entries. Replaces the copy-pasted loops in entries.py, search.py, and stats.py.

---

## Execution Order

| Order | Item | Depends On | Risk |
|-------|------|-----------|------|
| 1 | #1 Tests | nothing | low |
| 2 | #9 Drop numpy | nothing | low |
| 3 | #4 Fix imports | nothing | low |
| 4 | #6 Error boundaries | nothing | low |
| 5 | #5 Extract helpers (deps.py) | nothing | low |
| 6 | #3 Shared constants | nothing | low |
| 7 | #2 Metadata index | #1 (tests give confidence) | medium |
| 8 | #5 Extract helpers (index-based) | #2 (index must exist) | medium |
| 9 | #7 Async I/O | #2 (optional, only if perf matters) | low |

Items 1-6 can be done in any order. Item 7 (index) is the biggest change
and benefits from having tests in place first. Item 8 builds on the index.

---

## Migration & Backward Compatibility

CRITICAL RULE: A user running the old version must be able to `git pull`
and `docker compose up -d` (or restart uvicorn) with zero manual steps.

### Existing data that must NOT break
- `data/users.json` — existing user accounts, passwords, settings
- `data/master.key` — existing encryption key
- `entries/<username>/**/*.enc` — existing encrypted journal entries
- `docker-compose.yml` — existing volume mounts (./entries, ./data)
- All existing API endpoints and their response shapes

### Migration strategy per change

**#1 Tests** — No runtime impact. Tests live in `tests/` dir, not deployed.

**#2 SQLite Index** — MUST auto-create on first run.
  - On startup, check if `data/index.db` exists
  - If missing or corrupted: auto-rebuild from .enc files (background)
  - If present: use it. Validate on read (if a path in index doesn't
    exist on disk, remove from index; if a .enc file exists but isn't
    in index, add it)
  - The index is a CACHE, not the source of truth. It can always be
    deleted and rebuilt. No migration step needed from the user.

**#3 Shared Constants** — New endpoint `GET /api/constants`. Old frontend
  code doesn't call it so no conflict. New frontend calls it. The old
  hardcoded values in the frontend still work as fallback if the fetch
  fails (defensive coding).

**#4 Fix Imports** — Internal code change only. No API/data impact.

**#5 Extract Helpers** — Internal refactor. API responses stay identical.
  The `Depends(get_current_session)` pattern returns the same session
  dict. No behavior change.

**#6 Error Boundaries** — ADDITIVE. Currently broken entries are silently
  skipped. After this change, they show as "unreadable" in the UI.
  No data change. Old entries that were silently hidden will now appear
  (as unreadable cards), which is strictly better.

**#7 Async I/O** — Skipped unless needed. Not in current plan.

**#8 YAML -> JSON frontmatter** — DEFERRED. Not in current plan. Would
  require a migration script for existing .enc files. Not worth it now.

**#9 Drop numpy** — Internal change only. No API/data impact.

### Order of commits (merge strategy)
Each phase is ONE commit (or a small series) that can be tested
independently. If something breaks, `git revert` is clean.

Phase 1 commit: tests + numpy removal + import fixes
  -> Test: docker compose build && docker compose up -d
  -> Verify: existing entries still load, stats work

Phase 2 commit: SQLite index
  -> Test: docker compose build && docker compose up -d
  -> Verify: index.db auto-creates in data/, stats/search are faster
  -> Verify: delete data/index.db, restart, it rebuilds

Phase 3 commit: constants endpoint + error boundaries
  -> Test: docker compose build && docker compose up -d
  -> Verify: no visual changes, constants endpoint returns data
  -> Verify: corrupted .enc shows as "unreadable" not missing

Phase 4 commit: deps.py + shared helpers
  -> Test: docker compose build && docker compose up -d
  -> Verify: all pages work identically to before

### Testing procedure (for you on homelab)
After each `git pull && docker compose up -d --build`:
1. Login with existing account — must work
2. Calendar shows existing entries — must work
3. Create a new entry — must work
4. Stats page loads — must work
5. Search works — must work
6. Export entries — must work

---

## Constraints
- Homelab-only app, no external connections — security hardening is not a priority
- Must remain backward-compatible with existing encrypted .enc files
- Must remain Docker-deployable with the same docker-compose.yml
- No breaking changes to the frontend API contract (endpoints, response shapes)
- The encrypted .enc files are always the source of truth; the index is rebuildable
- Each phase must survive `git pull && docker compose up -d --build` with zero manual steps
