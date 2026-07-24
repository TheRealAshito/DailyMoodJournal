# AGENTS.md — AI Agent Context for DailyMoodJournal

Read this file FIRST before making any changes. It contains the workflow, constraints, and hard-won lessons from previous AI sessions.

## What This App Is

DailyMood is a self-hosted, encrypted journaling app with mood tracking. Runs in Docker on a homelab. Multi-user, AES-256-GCM encrypted entries, React frontend, FastAPI backend. Full i18n (English + Brazilian Portuguese).

Read `architecture.md` for the full technical picture. Read `goal.md` for product vision.

## Development Workflow

1. Work on the LOCAL clone at `/home/agentic_ia/DailyMoodJournal` — do NOT clone to /tmp
2. `git pull` before starting work
3. Make changes, run tests: `cd /home/agentic_ia/DailyMoodJournal && source .venv/bin/activate && python -m pytest tests/ -q`
4. Commit with descriptive message
5. Push to GitHub: `git push`
6. The user pulls on their homelab: `git pull && docker compose up -d --build`

## Critical Constraints (NEVER violate these)

### Backward Compatibility
- **Zero manual migration steps**. Every change must survive `git pull && docker compose up -d --build`.
- **Existing `.enc` files must not break**. They are the source of truth.
- **`users.json` format must not break**. Existing accounts, passwords, settings must keep working.
- **`master.key` must not break**. It's the app encryption key.
- **API endpoint shapes must not break**. New fields are OK, removing/renaming is not.
- **`index.db` is a cache**. If missing or corrupt, it auto-rebuilds. Never depend on it existing.
- **`docker-compose.yml` volume mounts** (`./entries`, `./data`) must not change.

### Data Integrity
- `.enc` files = source of truth. Index = rebuildable cache. Free write JSON = standalone.
- New frontmatter fields must be optional (old entries without them must still work).
- Settings stored in `users.json` alongside auth fields. `AUTH_KEYS` set separates them.

### Security (low priority for homelab, but don't regress)
- UEK (encryption key) stays server-side, never sent to browser.
- Sessions are in-memory with 24h TTL. Docker restart = all users logged out. This is by design.
- Session cookie is HTTP-only, SameSite=Lax.

## Common Gotchas (things that broke previous sessions)

### Python Backend

**Monkeypatch pitfall**: `from config import X` creates a local binding. Monkeypatching `config.X` doesn't affect modules that already imported it. Must patch BOTH the source module AND each consumer:
```python
# WRONG — only patches the source
monkeypatch.setattr(config, 'ENTRIES_DIR', tmp_path)
# RIGHT — also patch the module that did `from config import ENTRIES_DIR`
monkeypatch.setattr(utils, 'ENTRIES_DIR', tmp_path)
```

**MOOD_COLORS is a dict, not array**: `{0: "#color", 1: "#color", ...}`. Serializes to JSON object. Frontend `.map()` fails on objects. Use `Object.entries()`.

**Route ordering**: `/{param}` catches everything. Put `/export/pdf` BEFORE `/{session_id}` in the same router.

**fpdf2 text encoding**: Use `_clean_pdf_text()` from `export_import.py` to strip emoji/SMP chars that DejaVuSans can't render. Always wrap user-provided text through it.

**PDF_LANG dict**: All user-facing PDF text must go through this dict in `export_import.py`. Currently has `en` and `pt-BR` keys. Add new keys there, not in individual PDF files.

### Frontend

**window.open doesn't trigger downloads**: For endpoints with `Content-Disposition: attachment`, use this pattern:
```javascript
const resp = await fetch(url, { credentials: 'include' })
const blob = await resp.blob()
const a = document.createElement('a')
a.href = URL.createObjectURL(blob)
a.download = filename
a.click()
URL.revokeObjectURL(a.href)
```

**axios baseURL**: `api.js` sets `baseURL: '/api'`. So `api.get('/stats')` calls `/api/stats`. But raw `fetch()` needs the full path: `fetch('/api/stats/pdf')`.

**Dict serialization from API**: Keys that are integers in Python (`{0: "#color"}`) become string keys in JSON (`{"0": "#color"}`). Use `Object.entries()` or `Object.values()`, not `.map()`.

**Theme default**: `ThemeContext.jsx` initializes to `'dark'`. The `dark` class is applied immediately in `useState` initializer to avoid flash. After login, `App.jsx` syncs the user's saved preference from backend.

### Testing

**Test fixtures**: `conftest.py` provides isolated `data_dir`, `user_key`, and `entries_dir` fixtures. Tests use `monkeypatch` to redirect all file I/O to temp directories.

**Running tests**: `source .venv/bin/activate && python -m pytest tests/ -q`

**Test count**: 121 tests. If count drops, something regressed. If adding features, add tests.

## Quick Reference — Which File Does What

| Need to... | File(s) |
|------------|---------|
| Add a new API endpoint | `backend/routers/` — create or extend a router |
| Change entry storage format | `backend/entry_crud.py` + `backend/utils.py` |
| Change encryption | `backend/crypto.py` |
| Add/change PDF content | `backend/export_import.py` (entry PDF), `backend/stats_pdf.py` (stats charts), `backend/freewrite_pdf.py` (free write) |
| Add PDF i18n strings | `backend/export_import.py` → `PDF_LANG` dict |
| Change the SQLite index | `backend/index.py` |
| Add frontend page | `frontend/src/components/` + add route in `App.jsx` |
| Change translations | `frontend/public/locales/en.json` + `pt-BR.json` |
| Change theme/styling | `frontend/src/contexts/ThemeContext.jsx`, `tailwind.config.js` |
| Add new mood/scale config | `backend/config.py` + `GET /api/constants` + `ConstantsContext.jsx` |
| Change auth flow | `backend/routers/auth.py`, `backend/sessions.py`, `backend/crypto.py` |
| Change settings model | `backend/config.py` (`get_user_settings`, `save_user_settings`, `AUTH_KEYS`, `KNOWN_SETTINGS`) |

## Deployment Verification Checklist

After making changes, verify locally before pushing:
```bash
source .venv/bin/activate && python -m pytest tests/ -q
```

After user pulls on homelab, they verify:
1. Login with existing account — must work
2. Calendar shows existing entries — must work
3. Create a new entry — must work
4. Stats page loads — must work
5. Search works — must work
6. Export entries — must work
7. PDF downloads work (stats + freewrite)
