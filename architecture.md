# DailyMood — Architecture

## Tech Stack
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | Python 3.11+ | Ubiquitous in homelabs, easy to maintain |
| Backend framework | FastAPI | Modern async Python, built-in validation, OpenAPI docs |
| Frontend framework | React 18 + Vite + Tailwind CSS | Full UI control, professional look, fast HMR |
| Charts | recharts | React-native charting, interactive, no server-side render |
| Data storage | Encrypted `.enc` files | AES-256-GCM, user owns the raw key material |
| Auth storage | JSON file (`data/users.json`) | Single file, easy to back up, fields are hashed/encrypted |
| Encryption | `cryptography` library (AES-GCM, PBKDF2) | Industry standard, audited |
| PDF generation | fpdf2 + DejaVuSans | Unicode font supports emoji/accents/CJK, auto-detects user language |
| Archive | Python `tarfile` + `zipfile` | Standard library |
| Sessions | In-memory dict (server-side, 24h TTL) | Session ID via HTTP-only cookie, UEK never touches frontend |
| i18n | JSON locale files | `en.json` + `pt-BR.json` loaded by React context |
| Deployment | Docker multi-stage | Builds React static files, serves via uvicorn |

## Project Structure
```
DailyMoodJournal/
├── backend/                  # FastAPI Python backend
│   ├── main.py              # App entry, CORS, SPA catch-all route
│   ├── sessions.py          # In-memory session store (24h TTL)
│   ├── routers/
│   │   ├── auth.py          # Login, signup, password reset, /me, change password
│   │   ├── entries.py       # CRUD /entries, /day/{date}, /tags, path traversal protection
│   │   ├── search.py        # /search?tags=&from_date=&to_date=
│   │   ├── stats.py         # /stats (streaks, mood data, distribution)
│   │   ├── settings.py      # /settings (theme, lang, reflection categories)
│   │   └── export.py        # /export (archive), /export/pdf (PDF), /export/import
│   ├── crypto.py            # AES-256-GCM, PBKDF2 600K, key wrap/unwrap
│   ├── entry_crud.py        # CRUD on encrypted .enc files (preserves unknown fields)
│   ├── export_import.py     # Build archives, PDF export (fpdf2), process imports
│   ├── utils.py             # Path builders, YAML frontmatter (via PyYAML)
│   ├── config.py            # Paths, user I/O, settings migration, mood maps
│   └── prompts/
│       └── cbt_prompts.py   # 12 cognitive distortions + 30 CBT prompts
├── frontend/                # React SPA (Vite + Tailwind)
│   ├── public/locales/
│   │   ├── en.json          # English translations (UI + 64 reflection prompts)
│   │   └── pt-BR.json       # Brazilian Portuguese translations
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoginPage.jsx / SignupPage.jsx / ResetPasswordPage.jsx
│   │   │   ├── Navbar.jsx   # Top nav bar + theme toggle + language switcher
│   │   │   ├── Calendar.jsx # Mood-colored month grid — click a day opens new entry with that date pre-filled; heatmap shows most recent entry's mood color
│   │   │   ├── EntryForm.jsx # New/edit entry + mood emojis + reflection prompts
│   │   │   ├── EntryCard.jsx # Read-only entry with edit/delete buttons
│   │   │   ├── MoodSlider.jsx # Emoji-based mood selector (0-6) using String.fromCodePoint
│   │   │   ├── Search.jsx   # Tag + date range filter with results
│   │   │   ├── Stats.jsx    # recharts bar charts, streak counters, distribution
│   │   │   ├── Settings.jsx # Theme, language, reflection categories, export/import, PDF, password
│   │   │   └── AboutCBT.jsx # 12 cognitive distortions with examples
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx # login, signup, logout, session restore
│   │   │   └── ThemeContext.jsx # dark/light via Tailwind class
│   │   ├── api.js           # Axios instance (withCredentials: true)
│   │   ├── i18n.jsx         # Translation hook + locale loader with caching
│   │   ├── App.jsx          # Router + auth guard + protected layout
│   │   └── main.jsx         # React entry (StrictMode)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js       # Dev proxy /api → localhost:8501
│   ├── tailwind.config.js   # Custom mood color palette
│   └── postcss.config.js
├── entries/                 # Created at runtime — encrypted .enc files
├── data/
│   ├── users.json           # User credentials + settings (0o600)
│   └── master.key           # Auto-generated Fernet key (0o600)
├── Dockerfile               # Multi-stage (Node build → Python serve)
├── docker-compose.yml
├── .gitignore
├── .dockerignore
├── requirements.txt
├── goal.md
└── architecture.md
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Server health check |
| GET | `/api/auth/me` | Current user info + settings |
| POST | `/api/auth/login` | Login, sets session cookie |
| POST | `/api/auth/signup` | Create account + auto-login |
| POST | `/api/auth/logout` | Clear session |
| POST | `/api/auth/password-reset-request` | Get security question |
| POST | `/api/auth/password-reset-verify` | Verify answer, get reset token |
| POST | `/api/auth/password-reset-complete` | Set new password |
| PUT | `/api/auth/password` | Change password (authenticated) |
| GET | `/api/entries?year=&month=` | List entry metadata for a month |
| GET | `/api/entries/day/{date}` | Entries for a specific day |
| GET | `/api/entries/tags/all` | All unique tags for user |
| GET | `/api/entries/{path}` | Get single entry (decrypted, path-validated) |
| POST | `/api/entries` | Create entry |
| PUT | `/api/entries/{path}` | Update entry |
| DELETE | `/api/entries/{path}` | Delete entry |
| GET | `/api/search?tags=&from_date=&to_date=` | Search entries |
| GET | `/api/stats` | Streaks, mood averages, counts, distribution |
| GET | `/api/settings` | Get user preferences |
| PUT | `/api/settings` | Update user preferences |
| GET | `/api/export?format=tar.gz|zip` | Download decrypted archive |
| GET | `/api/export/pdf?from_date=&to_date=` | Download PDF with optional date range |
| POST | `/api/export/import` | Upload archive or .md/.txt files — returns `{imported, skipped, files[]}` with per-file status |
| GET | `/{full_path:path}` | SPA catch-all — serves index.html for all client-side routes |

## Authentication & Sessions

1. **Login flow**: password → PBKDF2(600K) → KEK_pwd → AES-GCM unwrap → UEK (256-bit)
2. **Session**: UEK stored server-side in dict (24h TTL), session ID sent as HTTP-only cookie (SameSite=Lax)
3. **Password reset**: Three-key hierarchy — UEK encrypted with both password-KEK and security-answer-KEK
4. **Logout**: Session deleted, cookie cleared, UEK discarded
5. **Path traversal**: All entry endpoints validate the requested path is within the user's entries directory
6. **Username validation**: Regex `^[a-zA-Z0-9_\\-\\.]{2,32}$`
7. **Login errors**: Generic \"Invalid credentials\" for both wrong username and wrong password

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
dailymood_version: '1.0'       # ← schema version of the app that created this entry
---
Body text here...
```

- `dailymood_version` is stamped on every create/update and preserved through export/import
- Unknown frontmatter fields are never dropped — they survive the full CRUD + export + import cycle
- The version field enables future schema migrations (old entries can be identified and migrated on read)

### User Database (`data/users.json`)

```json
{
  "_data_version": "1.0",       # ← schema version, stripped on load
  "username": {
    "salt": "...",
    "password_hash": "...",
    ...
  }
}
```

- `_data_version` is auto-added on every write, silently stripped on read
- Missing `_data_version` implies v1.0 (backward compatible with unversioned files)

### Export Format

Exported `.md` files are plaintext YAML frontmatter + Markdown body. They carry `dailymood_version` so re-importing preserves the originating schema version. Timestamp collisions on re-import are automatically deconflicted by minute offsets (1–59). The import API returns per-file results: `{imported, skipped, files: [{filename, status, reason?}]}`.

### PDF Export

PDFs are generated with fpdf2 using DejaVuSans Unicode font (installed via `fonts-dejavu-core` in the Docker image; falls back to bundled/system path). The PDF is fully localized based on the user's language setting:

| Label | English | Portuguese (pt-BR) |
|-------|---------|-------------------|
| Title | DailyMood Journal | Diário do Humor |
| Mood labels | Terrible → Amazing | Péssimo → Incrível |
| Date format | DD/MM/YYYY HH:MM | DD/MM/YYYY HH:MM |

Characters above U+FFFF (emoji supplementary plane) are stripped gracefully to prevent font rendering errors. The x position is reset after `multi_cell()` calls to prevent fpdf2 2.8.x from leaving the cursor at the right margin.

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

### Forward Compatibility

- **create_entry / update_entry**: Preserve any unknown frontmatter fields passed in entry_data. `dailymood_version` is auto-stamped.
- **build_export_archive**: Export ALL frontmatter fields (not just known ones), including `dailymood_version`
- **_process_plain_file**: Import/restore unknown fields from exported .md files; timestamp collisions auto-deconflicted
- **get_user_settings**: Falls back from `reflection_categories` → `cbt_enabled_categories` (migration path)
- **save_user_settings**: Saves any key passed (not restricted to a fixed list)

## Mood System

| Mood | Label | Emoji | Color |
|------|-------|-------|-------|
| 0 | Terrible | 😞 | `#4a148c` |
| 1 | Bad | 😢 | `#6a1b9a` |
| 2 | Poor | 😕 | `#9c27b0` |
| 3 | Okay | 😐 | `#9e9e9e` |
| 4 | Good | 🙂 | `#66bb6a` |
| 5 | Great | 😊 | `#43a047` |
| 6 | Amazing | 🤩 | `#2e7d32` |

Emoji characters use `String.fromCodePoint()` in JSX expressions to avoid encoding issues when pushing through GitHub's API.

## Frontend Architecture

- **SPA routing**: FastAPI catch-all route `/{full_path:path}` serves `index.html` for all client-side routes
- **Navigation**: Top navbar with tabs (Journal, New Entry, Search, Stats, About CBT, Settings)
- **Auth guard**: App.jsx checks `AuthContext.user` — unauthenticated users see login/signup/reset routes
- **i18n**: Locale files loaded via fetch, cached in memory, fallback to English if key missing. Contains ~180 keys including UI strings, 64 reflection prompts, and 42 CBT education keys (12 distortions × 3 fields + 6 headers).
- **Theme**: Tailwind `class` strategy — `dark` class on `<html>` via `ThemeContext`

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

### Volumes
| Host path | Container path | Purpose |
|-----------|---------------|---------|
| `./entries` | `/app/entries` | Encrypted journal entries |
| `./data` | `/app/data` | users.json + master.key |

### Docker Image

Multi-stage build: Node 20 slim builds the React frontend → Python 3.11 slim runs the app. The image installs `fonts-dejavu-core` (provides DejaVuSans.ttf for PDF Unicode support), `gcc` (build dependency), and all Python packages from `requirements.txt`.

## Dependencies

### Backend (requirements.txt)
```
cryptography>=42.0
PyYAML>=6.0
fastapi>=0.110
uvicorn>=0.29
python-multipart>=0.0.9
numpy>=1.24
fpdf2>=2.7
```

### Frontend (package.json)
```
react, react-dom, react-router-dom, axios, recharts
dev: vite, @vitejs/plugin-react, tailwindcss, postcss, autoprefixer
```
