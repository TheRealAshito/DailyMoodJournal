# DailyMood — Goal & Vision

## Purpose
DailyMood is a 100% offline, privacy-first journaling app designed to help users reflect on their day, track their mood, and engage in structured self-reflection. It runs on a homelab via Docker, accessible from any device on the local network through a modern web interface.

## Core Philosophy
- **User owns their data** — every entry is an encrypted `.enc` file on disk. The user can export unencrypted `.md` copies at any time. No cloud, no vendor lock-in.
- **Privacy by design** — all data is encrypted at rest. Authentication credentials use PBKDF2 hashing. Entry contents are AES-256-GCM encrypted. The encryption key (UEK) stays server-side, never touches the browser.
- **Therapeutic value** — optional reflection prompts with 64+ questions across 8 categories (self-reflection, gratitude, growth, emotions, relationships, goals, mindfulness, resilience). Plus CBT education about 12 cognitive distortions.
- **Beautiful & functional** — modern React UI with Tailwind CSS, emoji-based mood selector, dark/light mode, responsive design. Full i18n in English and Brazilian Portuguese.

## Target Users
- Individuals running a homelab who want a truly private journal
- Households with multiple users who need isolated, encrypted journals
- Anyone interested in mood tracking and self-reflection who rejects cloud services
- Brazilian Portuguese speakers (full PT-BR translation built-in)

## Core Features
1. **Multi-user authentication** — signup, login, password recovery via security question. Each user has an isolated encryption key (UEK).
2. **Encrypted storage** — all entries are AES-256-GCM encrypted at rest as `.enc` files. Decrypted only server-side, in memory, during active use.
3. **Calendar heatmap** — month grid with mood-colored day cells. Click a day to see entries. Previous/next month navigation.
4. **Journal entries** — title, body, mood (0–6 with emojis), tags. Stored as encrypted Markdown with YAML frontmatter.
5. **Mood tracking** — 0 (dark purple, 😞) → 3 (neutral grey, 😐) → 6 (bright green, 🤩). Visual emoji selector in the entry form.
6. **Tags** — user-defined, filterable by tag and date range.
7. **Reflection prompts** — optional toggle per entry. 64+ questions across 8 configurable categories in Settings (Self-Reflection, Gratitude, Growth & Learning, Emotional Awareness, Relationships, Goals & Purpose, Mindfulness, Resilience).
8. **Streaks & statistics** — consecutive days logged, mood average, entry count, mood over time bar chart (recharts), mood distribution histogram.
9. **Search** — filter entries by tags and date range.
10. **Editable entries** — past entries can be modified or deleted (always re-encrypted on save).
11. **Export / Import** — export all entries as unencrypted `.md` files in `.tar.gz` or `.zip`. Import from app exports or plain `.md`/`.txt` files.
12. **PDF export** — compile all entries (or a date range) into a single PDF. No encryption, readable by anyone. Great for sharing with a therapist.
13. **Dark / Light mode** — toggle in top navigation bar, persists in user settings.
14. **i18n — English & Portuguese** — full UI in English (default) or Brazilian Portuguese. Language switcher in navbar.
15. **Cognitive Behavioral Therapy education** — dedicated About CBT page explaining 12 common cognitive distortions with examples.

## Security & Privacy
- 100% offline — zero external network calls, zero telemetry, zero cloud dependencies
- Path traversal protection on all file endpoints
- Username validation (restricted character set)
- Generic login errors (prevents username enumeration)
- users.json and master.key with 0o600 permissions
- Session via HTTP-only cookies, UEK stays server-side
- Forward-compatible data model — export preserves unknown frontmatter fields, import preserves them

## Non-Goals
- Cloud sync or backup (user manages via export)
- Native mobile app (responsive web is sufficient)
- Real-time collaboration
- Offline-first PWA (homelab-adjacent by design)
