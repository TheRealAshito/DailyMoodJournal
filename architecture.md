# DailyMood — Architecture

## Tech Stack
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | Python 3.11+ | Ubiquitous in homelabs, easy to maintain |
| Web framework | Streamlit | Minimal boilerplate, built-in theming, responsive |
| Data storage | Encrypted `.enc` files | AES-256-GCM, user owns the raw key material |
| Auth storage | JSON file (`data/users.json`) | Single file, easy to back up, fields are hashed/encrypted |
| Charts | Matplotlib | Lightweight, sufficient for bar charts and heatmaps |
| Encryption | `cryptography` library (AES-GCM, PBKDF2) | Industry standard, audited, pure Python |
| Archive | Python `tarfile` + `zipfile` | Standard library, no extra deps |
| Calendar heatmap | Custom matplotlib grid rendered to image | No external JS, full control over look |

## Project Structure
```
DailyMoodJournal/
├── app.py                    # Streamlit entry point, page router, session state init
├── auth.py                   # Login, signup, logout, password reset, session guard
├── crypto.py                 # All encryption: AES-GCM, PBKDF2, key wrap/unwrap
├── entry_crud.py             # CRUD operations on encrypted .enc entry files
├── export_import.py          # Export (decrypt -> archive), Import (archive/md -> encrypt)
├── config.py                 # App paths, first-run setup, theme defaults
├── ui/
│   ├── calendar.py           # Calendar heatmap rendering + date picker + entry list
│   ├── entry_form.py         # New/edit entry widget (with optional CBT prompts)
│   ├── stats.py              # Streaks, mood chart, entry counts, bar chart
│   └── search.py             # Tag + date filter UI, entry list
│   └── settings.py           # Profile, password change, theme toggle, export/import
├── prompts/
│   ├── __init__.py
│   └── cbt_prompts.py        # Cognitive distortion definitions + prompt banks
├── utils.py                  # Path builders, validators, frontmatter parser
├── entries/                  # Created at first run — encrypted entry files live here
├── data/
│   ├── users.json            # User credentials (hashed passwords, wrapped keys)
│   └── master.key            # Auto-generated Fernet key for security Q&A (first run)
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── .streamlit/
│   └── config.toml           # Streamlit server config (port, theme defaults)
└── requirements.txt
```

## Data Model

### Entry (encrypted on disk)

**Path pattern**: `entries/{username}/YYYY/MM/YYYY-MM-DD_HHmm.enc`

**On-disk binary format** (AES-256-GCM):
```
[12-byte IV][AES-256-GCM ciphertext][16-byte GCM authentication tag]
```

**Plaintext before encryption** — standard Markdown with YAML frontmatter:
```markdown
---
title: "Today's Reflection"
date: 2026-06-22 14:30
mood: 4
tags: [work, gratitude]
author: alice
---

**CBT Prompt**: What evidence supports this thought?
**Response**: I realized my initial reaction was exaggerated...

The rest of the journal entry continues here...
```

### User credentials (`data/users.json`)

```json
{
  "alice": {
    "created_at": "2026-06-22T10:00:00",
    "salt": "base64...",
    "password_hash": "sha256$base64...",
    "entry_key_encrypted_with_pwd": "base64...",
    "entry_key_salt_pwd": "base64...",
    "entry_key_encrypted_with_secret": "base64...",
    "entry_key_salt_secret": "base64...",
    "security_question": "What is your first pet's name?"
  }
}
```

## Encryption Design (Three-Key Hierarchy)

### Purpose
Users must be able to reset their password (via security question) **without** losing access to their journal entries.

### Flow
```
                    +--------------------------+
                    |  User Entry Key (UEK)    |
                    |  Random 256-bit AES key  |
                    +----+--------------+------+
                         |              |
              encrypts   |              |  encrypts
                 with    |              |  with
                         v              v
              +----------------+  +------------------+
              | KEK_pwd        |  | KEK_secret       |
              | derived from   |  | derived from     |
              | user password  |  | security answer  |
              | (PBKDF2)       |  | (PBKDF2)         |
              +----------------+  +------------------+
```

### Key derivation (PBKDF2HMAC)
- Algorithm: SHA-256
- Iterations: 600,000 (OWASP 2023 recommendation)
- Salt: 16 random bytes per user
- Output: 32 bytes (256-bit AES key)

### Entry encryption (AES-256-GCM)
- Algorithm: AES with 256-bit key in GCM mode (authenticated encryption)
- IV: 12 random bytes per entry
- Auth tag: 16 bytes (appended to ciphertext)
- Provides both confidentiality and integrity

## Mood Colors
| Mood | Label | Hex |
|------|-------|-----|
| 0 | Terrible | `#4a148c` (dark purple) |
| 1 | Bad | `#6a1b9a` (purple) |
| 2 | Poor | `#9c27b0` (lavender) |
| 3 | Okay | `#9e9e9e` (grey) |
| 4 | Good | `#66bb6a` (pale green) |
| 5 | Great | `#43a047` (green) |
| 6 | Amazing | `#2e7d32` (bright green) |

## Deployment

### Option A: Docker (recommended)
```bash
git clone <repo> && cd DailyMoodJournal
docker compose up -d
# Access at http://<homelab-ip>:8501
```

### Option B: Python directly
```bash
git clone <repo> && cd DailyMoodJournal
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
streamlit run app.py --server.port 8501
```

### Volumes (Docker)
| Host path | Container path | Purpose |
|-----------|---------------|---------|
| `./entries` | `/app/entries` | Encrypted journal entries |
| `./data` | `/app/data` | users.json + master.key |

### Reverse proxy (Caddy, optional)
```caddyfile
daily.example.com {
    reverse_proxy localhost:8501
    tls internal
}
```

## Dependencies
```
streamlit>=1.36
cryptography>=42.0
matplotlib>=3.8
pandas>=2.1
PyYAML>=6.0
bcrypt>=4.0
```
