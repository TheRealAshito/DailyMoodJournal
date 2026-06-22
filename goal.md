# DailyMood — Goal & Vision

## Purpose
DailyMood is a 100% offline, privacy-first journaling app designed to help users reflect on their day, track their mood, and challenge unhelpful thinking patterns using CBT (Cognitive Behavioral Therapy) principles. It runs on a homelab via Streamlit, accessible from any device on the local network.

## Core Philosophy
- **User owns their data** — every entry is an encrypted file on disk. The user can export unencrypted copies at any time. No cloud, no vendor lock-in.
- **Privacy by design** — all data is encrypted at rest. Authentication credentials are hashed/salted. Entry contents are AES-256-GCM encrypted. Only decrypted in memory during active use.
- **Therapeutic value** — optional CBT prompts educate users about cognitive distortions and encourage constructive reframing.
- **Simple & beautiful** — intuitive calendar-first UX, mood visualized with color gradients, dark/light mode for comfort.

## Target Users
- Individuals running a homelab who want a truly private journal
- Households with multiple users who need isolated, encrypted journals
- Anyone interested in CBT and mood tracking who rejects cloud services

## Core Features
1. **Multi-user authentication** — signup, login, password recovery via encrypted security question. Each user has an isolated encryption key.
2. **Encrypted storage** — all entries are AES-256-GCM encrypted at rest as `.enc` files. Decrypted only in-app, in memory.
3. **Calendar heatmap** — GitHub-style contribution grid with mood-colored cells; click a day to see entries.
4. **Journal entries** — title, body, mood (0–6), tags. Stored as encrypted Markdown with YAML frontmatter.
5. **Mood tracking** — 0 (dark purple, worst) → 3 (neutral grey) → 6 (bright green, best). Color-coded throughout the UI.
6. **Tags** — user-defined, filterable by tag and date range.
7. **CBT prompts** — optional toggle per entry. Educational content on cognitive distortions + mixed prompt styles (distortion identification, gratitude, reframing).
8. **Streaks & statistics** — consecutive days logged, mood averages, entry counts, bar charts with mood color gradient.
9. **Search** — filter entries by tags and date range.
10. **Editable entries** — past entries can be modified or deleted (always re-encrypted on save).
11. **Export / Import** — export all entries as unencrypted `.md` files in `.tar.gz` or `.zip` (optionally password-protected). Import from app exports or plain `.md`/`.txt` files.
12. **Dark / Light mode** — follows system preference by default, manual override in settings.

## Non-Goals
- Cloud sync or backup (user manages their own backups via export)
- Mobile native app (responsive web via browser is sufficient)
- Collaborative editing
- Offline-first PWA (homelab-adjacent by design)
