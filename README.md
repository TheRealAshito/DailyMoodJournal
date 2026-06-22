# 📔 DailyMood

**A 100% offline, encrypted, self-hosted journaling app with mood tracking, reflection prompts, and CBT education.**

Built for homelab users who want a private, therapist-friendly journal that runs on their own hardware. No cloud, no telemetry, no data ever leaves your machine.

---

## ✨ Features

- **Multi-user** — each person has their own isolated, encrypted journal
- **Encrypted at rest** — all entries are AES-256-GCM encrypted. Even if someone steals your disk, they can't read your journal
- **Mood tracking** — rate your day from 0 (😞) to 6 (🤩) with a visual emoji slider
- **Calendar heatmap** — month grid with mood-colored cells, date picker, per-day entry view
- **Reflection prompts** — 64+ questions across 8 categories (self-reflection, gratitude, growth, emotions, relationships, goals, mindfulness, resilience). Configurable in Settings
- **Cognitive Behavioral Therapy (CBT) education** — learn about 12 common cognitive distortions with examples
- **Tag system** — filter entries by tag and date range
- **Streaks & statistics** — current streak, longest streak, mood over time (recharts bar charts), mood distribution
- **Search** — filter by tags and date range
- **Export / Import** — export all entries as unencrypted `.md` files (`.tar.gz` or `.zip`), or import from archives or plain `.md`/`.txt` files
- **PDF export** — compile all entries (or a date range) into a single PDF, no encryption, readable by anyone. Great for sharing with a therapist
- **Dark / Light mode** — toggle in the top navigation bar
- **i18n** — English and Brazilian Portuguese (PT-BR), switchable in the navbar

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
│  · Stats (streaks, mood averages, distribution)             │
│  · Search (tag + date range)                                │
│  · Export/Import (tar.gz, zip, MD, TXT)                     │
│  · PDF generation (fpdf2)                                   │
│  · Server-side sessions (UEK stays in RAM, never to client) │
└──────────┬──────────────────────────────────────┬───────────┘
           │                                      │
           ▼                                      ▼
   ┌──────────────┐                     ┌──────────────────┐
   │   entries/    │                     │      data/       │
   │  *.enc files  │                     │  users.json      │
   │  AES-256-GCM  │                     │  master.key      │
   └──────────────┘                     └──────────────────┘
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite + Tailwind CSS |
| **Backend** | Python 3.11+ · FastAPI · Uvicorn |
| **Charts** | recharts |
| **Encryption** | cryptography (AES-256-GCM, PBKDF2 600K iterations) |
| **PDF** | fpdf2 |
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
│   ├── main.py              # App entry, CORS, static files
│   ├── sessions.py          # In-memory session store
│   ├── routers/             # API route handlers
│   ├── crypto.py            # AES-256-GCM, PBKDF2, key wrap
│   ├── entry_crud.py        # CRUD on encrypted .enc files
│   ├── export_import.py     # Archive/PDF export, import
│   ├── config.py            # Paths, user I/O, settings
│   ├── utils.py             # Path builders, YAML frontmatter
│   └── prompts/             # CBT content (distortions + prompts)
├── frontend/                # React SPA (Vite + Tailwind)
│   ├── src/components/      # UI pages and components
│   ├── src/contexts/        # Auth, Theme, i18n
│   ├── src/api.js           # Axios HTTP client
│   ├── src/i18n.jsx         # Translation system
│   └── public/locales/      # en.json + pt-BR.json
├── Dockerfile               # Multi-stage build
├── docker-compose.yml       # Single-service deployment
├── entries/                 # Created at runtime — encrypted journals
├── data/                    # Created at runtime — users.json + master.key
├── requirements.txt
├── goal.md                  # Product vision
└── architecture.md          # Full architecture doc
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
