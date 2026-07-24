# 📔 DailyMood

**A 100% offline, encrypted, self-hosted journaling app with mood tracking, reflection prompts, and CBT education.**

Built for homelab users who want a private, therapist-friendly journal that runs on their own hardware. No cloud, no telemetry, no data ever leaves your machine.

---

## ✨ Features

- **Multi-user** — each person has their own isolated, encrypted journal
- **Encrypted at rest** — all entries are AES-256-GCM encrypted. Even if someone steals your disk, they can't read your journal
- **Mood tracking** — rate your day from 0 (😞) to 6 (🤩) with a visual emoji slider
- **Custom scales** — define your own numeric scales (e.g. Anxiety 0-10, Energy 1-5) and track them per entry
- **Calendar heatmap** — month grid with mood-colored cells, date picker, per-day entry view
- **Free Write** — notebook-style free-form writing with multiple sessions, auto-save, and word count
- **Reflection prompts** — 64+ questions across 8 categories (self-reflection, gratitude, growth, emotions, relationships, goals, mindfulness, resilience). Configurable in Settings
- **Cognitive Behavioral Therapy (CBT) education** — learn about 12 common cognitive distortions with examples
- **Tag system** — per-language tags, filter entries by tag and date range
- **Streaks & statistics** — current streak, longest streak, mood over time, mood distribution, mood by day of week, mood by tag
- **Search** — filter by tags and date range
- **Export / Import** — export all entries as unencrypted `.md` files (`.tar.gz` or `.zip`), or import from archives or plain `.md`/`.txt` files
- **PDF export** — three kinds: entry PDF (mood-colored headers), stats PDF (matplotlib charts), free write PDF (formatted sessions). All fully localized
- **Dark / Light mode** — default dark mode, toggle in the top navigation bar
- **i18n** — English and Brazilian Portuguese (PT-BR), switchable in Settings

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                      │
│  Tailwind CSS · recharts · react-router-dom · axios        │
└──────────────────────┬──────────────────────────────────────┘
                       │  HTTP (same origin, or proxy)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (Python)                    │
│  · Auth (login, signup, password reset via security Q&A)    │
│  · Entry CRUD (create, read, update, delete encrypted .enc) │
│  · Stats (streaks, mood averages, distribution, charts)     │
│  · Search (tag + date range, via SQLite index)              │
│  · Export/Import (tar.gz, zip, MD, TXT)                     │
│  · PDF generation (fpdf2 + matplotlib for charts)           │
│  · Server-side sessions (UEK stays in RAM, never to client) │
└──────────┬──────────────────────────────────────┬───────────┘
           │                                      │
           ▼                                      ▼
   ┌──────────────┐                     ┌──────────────────┐
   │   entries/    │                     │      data/       │
   │  *.enc files  │                     │  users.json      │
   │  AES-256-GCM  │                     │  master.key      │
   └──────────────┘                     │  index.db        │
                                        └──────────────────┘
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite + Tailwind CSS |
| **Backend** | Python 3.11+ · FastAPI · Uvicorn |
| **Charts** | recharts (web) · matplotlib (PDF) |
| **Encryption** | cryptography (AES-256-GCM, PBKDF2 600K iterations) |
| **Index** | SQLite (WAL mode, auto-rebuildable) |
| **PDF** | fpdf2 + matplotlib |
| **Deployment** | Docker (multi-stage: Node build → Python serve) |

### Encryption Model (Three-Key Hierarchy)
```
                    ┌──────────────────────┐
                    │   User Entry Key     │
                    │  (UEK) · 256-bit AES │
                    └──────┬───────────────┘
                           │
               ┌───────────┴───────────┐
               │                       │
     encrypted with            encrypted with
     password-derived         security-answer-derived
     KEK (PBKDF2)             KEK (PBKDF2)
               │                       │
               ▼                       ▼
     ┌─────────────────┐   ┌─────────────────────┐
     │ KEK_pwd         │   │ KEK_secret          │
     │ 600K iterations │   │ 600K iterations     │
     └─────────────────┘   └─────────────────────┘
```
This means: if you forget your password, your security question answer can still recover your entries. Password reset never loses data.

---

## 🔒 Privacy & Security

DailyMood is designed with **privacy as the default**. Here's what that means:

### 100% Offline
- **Zero network calls** to external services. All API calls go to `localhost` or your homelab IP
- **No telemetry**, no analytics, no crash reporting
- **No cloud dependencies** — no AWS, no Firebase, no Stripe, no nothing
- **No user tracking**, no cookies from third parties

### Encryption
- All journal entries are **encrypted at rest** using AES-256-GCM
- Each user has a **unique random encryption key** (UEK)
- The UEK itself is encrypted with a key derived from your password (PBKDF2, 600K iterations)
- The encryption key **never leaves the server** — only a session ID cookie is sent to the browser
- Even if someone gains access to your disk, your `.enc` files are gibberish without the key

### Data Ownership
- Your journal is stored as `.enc` files in a directory you control
- You can **delete any file** directly — no app needed
- You can **export all entries** as unencrypted `.md` files at any time
- You can **import/export** your entire journal for backups
- The app runs on **your machine, your network** — nobody else has access

### Authentication
- Passwords are **never stored in plaintext** — salted PBKDF2 hash
- Security question answers are **encrypted** (not hashed — we need to decrypt them for password recovery)
- Session IDs are **HTTP-only cookies** (not accessible via JavaScript)
- Server-side sessions with **24-hour TTL**, automatically cleaned

### File Permissions
- `users.json`: **0o600** (only the app process owner can read)
- `master.key`: **0o600**
- Entry files: created with default umask

### Vulnerabilities & Bugs
> This app was developed with assistance from **DeepSeek V4** and an AI agent (opencode). While we've done our best to write secure code, **this is a v0.5 release**. There may be undiscovered bugs, edge cases, or security issues. Use at your own risk. Always keep backups of your `entries/` and `data/` directories.

---

## 🚀 Quick Start

### Docker (recommended)
```bash
git clone https://github.com/TheRealAshito/DailyMoodJournal.git
cd DailyMoodJournal
docker compose up -d
# Open http://localhost:8501
```

### Development (without Docker)

**Terminal 1 — Backend**
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r ../requirements.txt
uvicorn main:app --reload --port 8501
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### First Run
1. Open the app in your browser
2. Create an account (username, password, security question)
3. Start journaling! Click ✏️ **New Entry** in the top nav

---

## 📦 Project Structure
```
DailyMoodJournal/
├── backend/                  # FastAPI Python backend
│   ├── main.py              # App entry, CORS, security headers, static files
│   ├── sessions.py          # In-memory session store (24h TTL)
│   ├── routers/             # API route handlers
│   ├── crypto.py            # AES-256-GCM, PBKDF2, key wrap
│   ├── entry_crud.py        # CRUD on encrypted .enc files
│   ├── index.py             # SQLite metadata index (WAL mode, auto-rebuildable)
│   ├── deps.py              # FastAPI auth dependencies
│   ├── export_import.py     # Archive/PDF export, import, PDF_LANG dict
│   ├── stats_pdf.py         # Stats PDF with matplotlib charts
│   ├── freewrite_pdf.py     # Free Write PDF export
│   ├── config.py            # Paths, user I/O, settings
│   ├── utils.py             # Path builders, YAML frontmatter
│   └── prompts/             # CBT content (distortions + prompts)
├── frontend/                # React SPA (Vite + Tailwind)
│   ├── src/components/      # UI pages and components
│   ├── src/contexts/        # Auth, Theme, Constants
│   ├── src/api.js           # Axios HTTP client
│   ├── src/i18n.jsx         # Translation system
│   └── public/locales/      # en.json + pt-BR.json
├── tests/                   # pytest test suite (121 tests)
├── Dockerfile               # Multi-stage build
├── docker-compose.yml       # Single-service deployment
├── entries/                 # Created at runtime — encrypted journals
├── data/                    # Created at runtime — users.json + master.key + index.db
├── requirements.txt
├── goal.md                  # Product vision
├── architecture.md          # Full architecture doc
└── README.md                # This file
```

---

## 🤝 Contributing

This is a personal project, but issues and pull requests are welcome. Before contributing, please read `goal.md` and `architecture.md` to understand the design philosophy.

**Known limitations (v0.5):**
- Session state is in-memory (not persisted across server restarts). Users need to re-login after restart.
- No rate limiting on login (acceptable for homelab usage)
- No CSRF tokens (SameSite=Lax cookie provides basic protection)
- Single-server only (no horizontal scaling)

---

## 📝 License

MIT

---

*Built with Python, React, and DeepSeek V4.*
