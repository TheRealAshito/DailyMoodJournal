# DailyMood — Architecture

## Tech Stack
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | Python 3.11+ | Ubiquitous in homelabs, easy to maintain |
| Backend framework | FastAPI | Modern async Python, built-in validation, OpenAPI docs |
| Frontend framework | React 18 + Vite + Tailwind CSS | Full UI control, professional look, fast HMR |
| Charts | recharts (frontend), matplotlib (PDF) | recharts for interactive web charts, matplotlib for chart images embedded in PDFs |
| Data storage | Encrypted `.enc` files | AES-256-GCM, user owns the raw key material |
| Metadata index | SQLite (`data/index.db`) | Fast lookups for stats/search/calendar without decrypting every entry |
| Auth storage | JSON file (`data/users.json`) | Single file, easy to back up, fields are hashed/encrypted |
| Encryption | `cryptography` library (AES-GCM, PBKDF2) | Industry standard, audited |
| PDF generation | fpdf2 + matplotlib + DejaVuSans | fpdf2 for text PDFs, matplotlib for chart images in stats PDFs. Unicode font supports emoji/accents/CJK. All PDFs fully localized via `PDF_LANG` dict |
| Archive | Python `tarfile` + `zipfile` | Standard library |
| Sessions | In-memory dict (server-side, 24h TTL) | Session ID via HTTP-only cookie, UEK never touches frontend |
| i18n | JSON locale files | `en.json` + `pt-BR.json` loaded by React context |
| Testing | pytest (121 tests) | Covers crypto, entry CRUD, utils, export/import, index, stats PDF, freewrite PDF |
| Deployment | Docker multi-stage | Builds React static files, serves via uvicorn |

## Project Structure
```
DailyMoodJournal/
├── backend/                  # FastAPI Python backend
│   ├── main.py              # App entry, CORS, security headers, SPA catch-all, /api/constants, /api/index-status
│   ├── sessions.py          # In-memory session store (24h TTL)
│   ├── routers/
│   │   ├── auth.py          # Login, signup, password reset, /me, change password, lazy index rebuild
│   │   ├── entries.py       # CRUD /entries, /day/{date}, /tags, path traversal protection (uses index)
│   │   ├── search.py        # /search?tags=&from_date=&to_date= (uses index for filtering)
│   │   ├── stats.py         # /stats + /stats/pdf (uses index for filtering, decrypts only for scales)
│   │   ├── settings.py      # /settings (uses FastAPI Depends() for auth)
│   │   ├── freewrite.py     # /freewrite CRUD + /freewrite/export/pdf
│   │   └── export.py        # /export (archive), /export/pdf (PDF), /export/import
│   ├── crypto.py            # AES-256-GCM, PBKDF2 600K, key wrap/unwrap
│   ├── entry_crud.py        # CRUD on encrypted .enc files, auto-updates index on write
│   ├── index.py             # SQLite metadata index (WAL mode, auto-rebuildable)
│   ├── deps.py              # FastAPI dependencies (get_current_session via Depends())
│   ├── export_import.py     # Build archives, PDF export (fpdf2), process imports, PDF_LANG dict
│   ├── stats_pdf.py         # Stats PDF with matplotlib charts (mood time, distribution, day-of-week, tag, custom scales)
│   ├── freewrite_pdf.py     # Free Write PDF export (fpdf2, multi-session, fully localized)
│   ├── utils.py             # Path builders, YAML frontmatter (via PyYAML)
│   ├── config.py            # Paths, user I/O, settings migration, mood maps, per-language tags
│   └── prompts/
│       └── cbt_prompts.py   # 12 cognitive distortions + 30 CBT prompts
├── frontend/                # React SPA (Vite + Tailwind)
│   ├── public/locales/
│   │   ├── en.json          # English translations
│   │   └── pt-BR.json       # Brazilian Portuguese translations
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoginPage.jsx / SignupPage.jsx / ResetPasswordPage.jsx
│   │   │   ├── Navbar.jsx   # Top nav bar + theme toggle
│   │   │   ├── Calendar.jsx # Month grid with mood colors from ConstantsContext
│   │   │   ├── EntryForm.jsx # New/edit entry + mood + reflection prompts + tags + scales
│   │   │   ├── EntryCard.jsx # Read-only entry with edit/delete (uses ConstantsContext)
│   │   │   ├── MoodSlider.jsx # Emoji mood selector (uses ConstantsContext)
│   │   │   ├── Search.jsx   # Tag + date range filter
│   │   │   ├── Stats.jsx    # recharts bar charts + PDF download button (uses ConstantsContext)
│   │   │   ├── Settings.jsx # Theme, language, tags, scales, export/import, password
│   │   │   ├── HowToUse.jsx # How-to guide
│   │   │   ├── FreeWrite.jsx # Notebook layout with auto-save + PDF export (single/multi-select)
│   │   │   ├── AboutCBT.jsx # CBT education
│   │   │   └── ErrorBoundary.jsx # Catches render crashes, shows recovery UI
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx # login, signup, logout, session restore
│   │   │   ├── ThemeContext.jsx # dark/light via Tailwind class (default: dark)
│   │   │   └── ConstantsContext.jsx # Fetches /api/constants once (mood colors, labels, emojis, tags)
│   │   ├── api.js           # Axios instance (withCredentials: true)
│   │   ├── i18n.jsx         # Translation hook + locale loader with caching
│   │   ├── App.jsx          # Router + auth guard + ErrorBoundary
│   │   └── main.jsx         # React entry (StrictMode, all providers)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js       # Dev proxy /api → localhost:8501
│   ├── tailwind.config.js   # Custom mood color palette
│   └── postcss.config.js
├── tests/                   # pytest test suite (121 tests)
│   ├── conftest.py          # Fixtures: isolated data dir, user_key, sample entry
│   ├── test_crypto.py       # Encryption roundtrips, key wrapping, password hashing
│   ├── test_entry_crud.py   # CRUD operations, user isolation
│   ├── test_utils.py        # Path building, YAML parsing, validation
│   ├── test_export_import.py # Export/import roundtrip, PDF generation
│   ├── test_index.py        # SQLite index operations, CRUD integration
│   ├── test_stats_pdf.py    # Stats PDF chart generation + full PDF build
│   └── test_freewrite_pdf.py # Free Write PDF generation
├── entries/                 # Created at runtime — encrypted .enc files
├── data/
│   ├── users.json           # User credentials + settings (0o600)
│   ├── master.key           # Auto-generated key (0o600)
│   ├── index.db             # SQLite metadata index (auto-created, rebuildable)
│   └── {username}_freewrite.json  # Free Write sessions
├── AGENTS.md                # AI agent context: workflow, gotchas, constraints
├── Dockerfile               # Multi-stage (Node build → Python serve)
├── docker-compose.yml
├── .gitignore
├── .dockerignore            # Excludes tests/, requirements-dev.txt
├── requirements.txt         # Production dependencies
├── requirements-dev.txt     # Dev dependencies (+ pytest)
├── goal.md                  # Product vision
├── architecture.md          # This file
└── README.md                # Public GitHub readme
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Server health check |
| GET | `/api/constants` | Mood colors, labels, emojis, default tags (single source of truth) |
| GET | `/api/index-status` | Index diagnostics (per-user entry counts, disk vs indexed) |
| GET | `/api/auth/me` | Current user info + settings |
| POST | `/api/auth/login` | Login, sets session cookie, triggers lazy index rebuild if needed |
| POST | `/api/auth/signup` | Create account + auto-login |
| POST | `/api/auth/logout` | Clear session |
| POST | `/api/auth/password-reset-request` | Get security question |
| POST | `/api/auth/password-reset-verify` | Verify answer, get reset token |
| POST | `/api/auth/password-reset-complete` | Set new password |
| PUT | `/api/auth/password` | Change password (authenticated) |
| GET | `/api/entries?year=&month=` | List entry metadata for a month (uses index) |
| GET | `/api/entries/day/{date}` | Entries for a specific day (uses index) |
| GET | `/api/entries/tags/all` | All unique tags for user (uses index) |
| GET | `/api/entries/{path}` | Get single entry (decrypted, path-validated) |
| POST | `/api/entries` | Create entry (auto-updates index) |
| PUT | `/api/entries/{path}` | Update entry (auto-updates index) |
| DELETE | `/api/entries/{path}` | Delete entry (auto-updates index) |
| GET | `/api/search?tags=&from_date=&to_date=` | Search entries (uses index for filtering) |
| GET | `/api/stats?period=day\|week\|month&from_date=&to_date=&tags=` | Stats (uses index for filtering, decrypts only for scales) |
| GET | `/api/stats/pdf?period=day\|week\|month&from_date=&to_date=&tags=` | Stats PDF with matplotlib charts. Fully localized. Uses fetch+blob download on frontend |
| GET | `/api/settings` | Get user preferences |
| PUT | `/api/settings` | Update user preferences (uses FastAPI Depends()) |
| GET | `/api/freewrite` | List all free write sessions |
| POST | `/api/freewrite` | Create a new free write session |
| GET | `/api/freewrite/export/pdf?ids=id1,id2` | Export free write sessions as PDF. Omit `ids` for all. Fully localized |
| GET | `/api/freewrite/{id}` | Get full session content |
| PUT | `/api/freewrite/{id}` | Update session title and content |
| DELETE | `/api/freewrite/{id}` | Delete a free write session |
| GET | `/api/export?format=tar.gz\|zip` | Download decrypted archive |
| GET | `/api/export/pdf?from_date=&to_date=` | Download PDF with optional date range |
| POST | `/api/export/import` | Upload archive or .md/.txt files |
| GET | `/{full_path:path}` | SPA catch-all — serves index.html |

## Authentication & Sessions

1. **Login flow**: password → PBKDF2(600K) → KEK_pwd → AES-GCM unwrap → UEK (256-bit)
2. **Session**: UEK stored server-side in dict (24h TTL), session ID sent as HTTP-only cookie (SameSite=Lax). Cookie name: `session_id` (set in `auth.py` as `SESSION_COOKIE = "session_id"`).
3. **Session store**: `SessionStore` class in `sessions.py`. Thread-safe (Lock). Holds `{username, user_key, created_at}` per session. Sliding TTL — activity resets the timer.
4. **Password reset**: Three-key hierarchy — UEK encrypted with both password-KEK and security-answer-KEK
5. **Logout**: Session deleted, cookie cleared, UEK discarded
6. **Path traversal**: All entry endpoints validate the requested path is within the user's entries directory
7. **Username validation**: Regex `^[a-zA-Z0-9_\\-\\.]{2,32}$`
8. **Login errors**: Generic "Invalid credentials" for both wrong username and wrong password

## Settings Model

User settings are stored in `data/users.json` alongside auth fields. The `get_user_settings()` function in `config.py` returns:

```python
{
    "theme": "dark",              # "dark" | "light" (default: "light" in backend, "dark" in frontend)
    "language": "en",             # "en" | "pt-BR"
    "reflection_categories": ["self_reflection", "gratitude", ...],  # which prompt categories are enabled
    "tags": {"en": [...], "pt-BR": [...]},  # per-language tag lists
    "custom_scales": {"Anxiety": {"min": 0, "max": 10}, ...},  # user-defined numeric scales
    "sticky_note": "...",         # optional sticky note text
}
```

Auth fields (password hash, salts, encrypted keys, security question) are separated from settings via `AUTH_KEYS` set in `config.py`. The `KNOWN_SETTINGS` set defines what fields the PUT `/api/settings` endpoint accepts.

The frontend initializes with `theme: "dark"` (in `ThemeContext.jsx`). After login, `App.jsx` syncs the user's saved theme from backend settings, overriding the default.

## Data Model & Versioning

### Entry Schema (encrypted `.enc` files)

Each entry is stored as AES-256-GCM ciphertext. When decrypted, the plaintext is Markdown with YAML frontmatter:

```yaml
---
title: My Day
date: 2026-06-23 12:00
mood: 4
tags: [work, gratitude]
author: username
dailymood_version: '1.0'
scales:
  Anxiety: 6
  Energy: 8
---
Body text here...
```

- `dailymood_version` is stamped on every create/update and preserved through export/import
- `scales` is an optional dict of user-defined scale names → numeric values (defined in user settings `custom_scales`)
- Unknown frontmatter fields are never dropped — they survive the full CRUD + export + import cycle
- The version field enables future schema migrations

### User Database (`data/users.json`)

```json
{
  "_data_version": "1.0",
  "alice": {
    "salt": "...",
    "password_hash": "...",
    "entry_key_encrypted_with_pwd": "...",
    "entry_key_salt_pwd": "...",
    "entry_key_encrypted_with_secret": "...",
    "entry_key_salt_secret": "...",
    "security_question": "What is your pet's name?",
    "created_at": "...",
    "theme": "dark",
    "language": "en",
    "reflection_categories": ["self_reflection", "gratitude"],
    "tags": {"en": ["Happy", ...], "pt-BR": ["Feliz", ...]},
    "custom_scales": {"Anxiety": {"min": 0, "max": 10}}
  }
}
```

### Free Write Sessions (`data/{username}_freewrite.json`)

```json
[
  {
    "id": "abc123def456",
    "title": "Morning Thoughts",
    "content": "Free-form text...",
    "created_at": "2026-06-23T08:00:00",
    "updated_at": "2026-06-23T08:30:00"
  }
]
```

Sessions are ordered newest-first. IDs are 12-char hex (uuid4). Auto-saved 800ms after typing stops.

### Export Format

Exported `.md` files are plaintext YAML frontmatter + Markdown body. They carry `dailymood_version` so re-importing preserves the originating schema version. Timestamp collisions on re-import are automatically deconflicted by minute offsets (1–59). The import API returns per-file results: `{imported, skipped, files: [{filename, status, reason?}]}`.

### Encryption (Three-Key Hierarchy)

```
                    +--------------------------+
                    |  User Entry Key (UEK)    |
                    |  Random 256-bit AES key  |
                    +----+--------------+------+
                         |              |
              encrypted  |              |  encrypted
              with KEK   |              |  with KEK
              (password) |              |  (secret answer)
                         v              v
              +----------------+  +------------------+
              | KEK_pwd        |  | KEK_secret       |
              | PBKDF2(600K)   |  | PBKDF2(600K)     |
              +----------------+  +------------------+
```

- Entry files: AES-256-GCM with random 12-byte IV per entry
- User key encrypted with KEK derived from password (PBKDF2 HMAC-SHA256, 600K iterations)
- Security answer also derives a KEK — password reset without data loss

## PDF Export System

The app has three kinds of PDF export, all fully localized based on the user's language setting:

### 1. Entry PDF (`/api/export/pdf`)
Generated by `export_import.py`. Uses fpdf2 with DejaVuSans. Each entry gets a mood-colored header, date, mood label, tags, scales, and body text. Supports optional date range filtering.

### 2. Stats PDF (`/api/stats/pdf`)
Generated by `stats_pdf.py`. Uses **matplotlib** to render charts as PNG images (with value labels on bars), then embeds them in an fpdf2 PDF. Charts:
- Mood Over Time (bar chart, period-grouped)
- Mood by Day of Week (bar chart)
- Mood Distribution (bar chart, 0-6)
- Mood by Tag (horizontal bar chart)
- Custom Scales (bar chart per scale)

The stats endpoint reuses `get_stats()` for data, passes it to `build_stats_pdf()`.

### 3. Free Write PDF (`/api/freewrite/export/pdf`)
Generated by `freewrite_pdf.py`. Exports selected or all free write sessions. Each session gets a cyan header bar, timestamp, and formatted content. Multi-page when exporting multiple sessions.

### Frontend PDF Downloads
Both Stats and FreeWrite use a `fetch` + blob + programmatic `<a>` click pattern for reliable downloads. The `window.open` approach was unreliable — browsers don't always trigger attachment downloads from new tabs.

### Localization (`PDF_LANG` dict)
All PDF text is localized via the `PDF_LANG` dict in `export_import.py`. Keys cover:
- General: title, user, exported, entries, mood, tags, labels
- Stats: summary, total_entries, avg_mood, streaks, chart titles, axis labels
- Free Write: suffix, untitled, last_updated

Currently supports `en` and `pt-BR`. The user's language is read from their settings via `get_user_settings()`.

## SQLite Metadata Index

The index (`data/index.db`) stores entry metadata for fast lookups without decrypting files.

### Schema
```sql
CREATE TABLE entry_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    date TEXT NOT NULL,        -- YYYY-MM-DD
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

### How it works
- **Write path**: `create_entry()`, `update_entry()`, `delete_entry()` automatically update the index
- **Read path**: Stats, search, and entries routers query the index first, then decrypt only matching entries
- **Migration**: On first login, if user has entries but no index, a background thread rebuilds it
- **Rebuild**: Index can be deleted and rebuilt at any time from .enc files (it's a cache)
- **Startup**: `init_index()` creates the table if it doesn't exist
- **WAL mode**: SQLite uses Write-Ahead Logging for better concurrent access

### Performance impact
- Before: Every stats/search/calendar page decrypted ALL entries
- After: Only entries matching date/tag filters are decrypted
- For scales data (not in index), matching entries are decrypted on demand

## Security

### Headers

Every response includes security headers via Starlette middleware:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `Referrer-Policy` | `same-origin` | Only send Referer on same-origin requests |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'self'` | Restricts all resources to same-origin only |

### 100% Local Design

The app makes **zero external network calls**:
- **Frontend**: All API requests go to `/api` (same origin). No CDN, no external fonts, no analytics.
- **Backend**: No HTTP/HTTPS client calls to any external service.
- **Dependencies**: No telemetry/analytics packages in npm or Python dependencies.
- **CORS**: Only allows `localhost` origins.
- **Docker HEALTHCHECK**: Hits `http://localhost:8501/api/health` — container-internal only.

## Mood System

| Mood | Label | Emoji | Color |
|------|-------|-------|-------|
| 0 | Terrible/Péssimo | 😞 | `#4a148c` |
| 1 | Bad/Ruim | 😢 | `#6a1b9a` |
| 2 | Poor/Fraco | 😕 | `#9c27b0` |
| 3 | Okay/Neutro | 😐 | `#9e9e9e` |
| 4 | Good/Bom | 🙂 | `#66bb6a` |
| 5 | Great/Ótimo | 😊 | `#43a047` |
| 6 | Amazing/Incrível | 🤩 | `#2e7d32` |

Mood colors, labels, and emojis are served from `/api/constants` (single source of truth). The frontend fetches them once via `ConstantsContext` and shares them across all components. Labels are fully localized via `t('mood_0')`–`t('mood_6')` keys.

## Frontend Architecture

- **SPA routing**: FastAPI catch-all route serves `index.html` for all client-side routes
- **Navigation**: Top navbar with tabs (Journal, New Entry, Free Write, Search, Stats, About CBT). Settings and How to Use are icon buttons. Language switcher is in Settings.
- **Auth guard**: App.jsx checks `AuthContext.user` — unauthenticated users see login/signup/reset routes
- **Error boundary**: `ErrorBoundary.jsx` wraps the protected layout — catches render crashes and shows a recovery UI with reload button
- **Constants**: `ConstantsContext.jsx` fetches `/api/constants` once on app load, provides mood colors/labels/emojis/tags via context. Fallback values used if fetch fails.
- **i18n**: Locale files loaded via fetch, cached in memory, fallback to English if key missing. Locale and theme are synced from backend user settings on login.
- **Theme**: Tailwind `class` strategy — `dark` class on `<html>` via `ThemeContext`. Default is dark mode. After login, user's saved preference overrides. Server-authoritative (no localStorage).
- **Date/time**: All timestamps use the browser's local timezone via `Date` getters.
- **Stats**: Full analytics suite with date range filter, tag multi-select, and period grouping (daily/weekly/monthly). Uses SQLite index for fast filtering. PDF download button in filter bar.
- **Tags**: Stored per-language as a dict `{"en": [...], "pt-BR": [...]}` in user settings.
- **Custom Scales**: Users can create numeric scales in Settings (name + min/max range). Data stored per-entry in `scales` frontmatter field as `{scale_name: numeric_value}`.
- **Free Write**: Notebook layout with session list sidebar + editor. Auto-saves 800ms after typing stops. PDF export with Select mode (checkboxes for multi-select) or Export All button. Individual PDF button on each session header.
- **PDF Downloads**: Both Stats and FreeWrite use `fetch` + blob + programmatic `<a>` click. Credentials included for authenticated endpoints. Content-Disposition header parsed for filename.
- **Brand color**: Cyan-500 (`#06b6d4`) is the primary accent.

## Backward Compatibility Rules

**CRITICAL**: A user running the old version must be able to `git pull && docker compose up -d --build` with zero manual steps.

### Data that must NEVER break
- `data/users.json` — existing user accounts, passwords, settings
- `data/master.key` — existing encryption key
- `entries/<username>/**/*.enc` — existing encrypted journal entries
- `data/index.db` — if missing or corrupt, auto-rebuild (it's a cache)
- `data/{username}_freewrite.json` — free write sessions
- `docker-compose.yml` — existing volume mounts (./entries, ./data)
- All existing API endpoints and their response shapes

### Rules for changes
1. The encrypted `.enc` files are always the source of truth; the index is rebuildable
2. New endpoints are additive (no conflict with old frontend)
3. New frontmatter fields are optional (old entries without them still work)
4. The `index.db` auto-creates on first run, auto-rebuilds if corrupt
5. Each change must survive `git pull && docker compose up -d --build` with zero manual steps

## Known Gotchas

Things that have broken previous AI sessions. Read before making changes.

### Python

- **Monkeypatch pitfall**: `from config import X` creates a local binding. Monkeypatching `config.X` doesn't affect modules that already imported it. Must patch both the source module AND each module with a local binding (e.g., `monkeypatch.setattr(utils, 'ENTRIES_DIR', ...)` alongside `monkeypatch.setattr(config, 'ENTRIES_DIR', ...)`).

- **MOOD_COLORS is a dict, not an array**: `{0: "#color", 1: "#color", ...}`. When returned from a FastAPI endpoint, it serializes to a JSON object (not array). Frontend JavaScript `.map()` only works on arrays. Use `Object.entries()`, `Object.keys()`, or `Object.values()` to iterate.

- **Route ordering in FastAPI**: `/{session_id}` catches everything including `/export/pdf`. Put specific routes (like `/export/pdf`) BEFORE parameterized routes in the same router.

### Frontend

- **window.open doesn't trigger downloads**: For PDF endpoints with `Content-Disposition: attachment`, `window.open(url, '_blank')` opens a blank tab but doesn't download. Use `fetch` + `blob` + programmatic `<a>` click instead.

- **axios baseURL**: The `api.js` axios instance has `baseURL: '/api'`. So `api.get('/stats')` calls `/api/stats`. But raw `fetch()` calls need the full path: `fetch('/api/stats/pdf')`.

- **Dict serialization**: API responses with dict keys that are integers (like `mood_colors: {0: "#color"}`) serialize as JSON objects with string keys. Use `Object.entries()` on the frontend, not `.map()`.

### Deployment

- **Docker volume mounts**: `./entries` and `./data` are bind-mounted. Files created inside the container are owned by root if the container runs as root. The `save_users()` function calls `os.chmod(USERS_FILE, 0o600)` but this only works if the container user owns the file.

- **Session loss on restart**: Sessions are in-memory. Docker restart or `docker compose down` logs out all users. This is by design — the UEK is never persisted to disk.

## Deployment

### Docker (recommended)
```bash
docker compose up -d
# Access at http://<homelab-ip>:8501
```

### Development (no Docker)
```bash
# Terminal 1 — Backend
cd backend && pip install -r ../requirements.txt && uvicorn main:app --reload --port 8501

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
# Access at http://localhost:5173 (proxies API to :8501)
```

### Testing
```bash
pip install -r requirements-dev.txt
pytest tests/ -v
```

### Volumes
| Host path | Container path | Purpose |
|-----------|---------------|---------|
| `./entries` | `/app/entries` | Encrypted journal entries |
| `./data` | `/app/data` | users.json + master.key + index.db + freewrite JSON |

### Docker Image

Multi-stage build: Node 20 slim builds the React frontend → Python 3.11 slim runs the app. The image installs `fonts-dejavu-core` (DejaVuSans.ttf for PDF), `gcc` (build dependency), and Python packages from `requirements.txt`. Tests and dev dependencies are excluded via `.dockerignore`.

## Dependencies

### Backend (requirements.txt)
```
cryptography>=42.0
PyYAML>=6.0
fastapi>=0.110
uvicorn>=0.29
python-multipart>=0.0.9
fpdf2>=2.7
matplotlib>=3.8
```

### Dev (requirements-dev.txt)
```
(all of the above)
pytest>=8.0
```

### Frontend (package.json)
```
react, react-dom, react-router-dom, axios, recharts
dev: vite, @vitejs/plugin-react, tailwindcss, postcss, autoprefixer
```
