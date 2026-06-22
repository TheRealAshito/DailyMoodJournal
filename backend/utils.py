import os
import re
from datetime import datetime
import yaml
from backend.config import ENTRIES_DIR


def build_entry_path(username: str, dt: datetime) -> str:
    return os.path.join(
        ENTRIES_DIR,
        username,
        str(dt.year),
        f"{dt.month:02d}",
        f"{dt.strftime('%Y-%m-%d_%H%M')}.enc",
    )


def list_user_entries(username: str) -> list[str]:
    user_dir = os.path.join(ENTRIES_DIR, username)
    if not os.path.exists(user_dir):
        return []
    entries = []
    for root, _, files in os.walk(user_dir):
        for f in files:
            if f.endswith(".enc"):
                entries.append(os.path.join(root, f))
    entries.sort(reverse=True)
    return entries


def parse_entry_text(text: str) -> tuple[dict, str]:
    frontmatter = {}
    body = text

    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if match:
        try:
            frontmatter = yaml.safe_load(match.group(1)) or {}
        except yaml.YAMLError:
            pass
        body = text[match.end():]

    return frontmatter, body.strip()


def build_entry_text(frontmatter: dict, body: str) -> str:
    lines = ["---"]
    from datetime import datetime, date
    for key, value in frontmatter.items():
        if isinstance(value, datetime):
            value = value.strftime("%Y-%m-%d %H:%M")
        elif isinstance(value, date):
            value = value.strftime("%Y-%m-%d")
        elif isinstance(value, list):
            lines.append(f"{key}: [{', '.join(repr(v) for v in value)}]")
            continue
        lines.append(f"{key}: {value}")
    lines.append("---")
    lines.append("")
    lines.append(body)
    return "\n".join(lines)


def extract_date_from_path(path: str) -> datetime | None:
    basename = os.path.basename(path).replace(".enc", "")
    match = re.match(r"(\d{4}-\d{2}-\d{2})_(\d{4})", basename)
    if match:
        return datetime.strptime(f"{match.group(1)} {match.group(2)}", "%Y-%m-%d %H%M")
    return None


def extract_metadata_from_path(path: str) -> dict | None:
    basename = os.path.basename(path).replace(".enc", "")
    match = re.match(r"(\d{4}-\d{2}-\d{2})_(\d{4})", basename)
    if match:
        return {
            "date": match.group(1),
            "time": f"{match.group(2)[:2]}:{match.group(2)[2:]}",
        }
    return None


def get_username_from_path(path: str) -> str:
    relative = os.path.relpath(path, ENTRIES_DIR)
    parts = relative.split(os.sep)
    return parts[0]


def validate_entry_data(data: dict) -> list[str]:
    errors = []
    if not data.get("title", "").strip():
        errors.append("Title is required.")
    if "mood" not in data or not isinstance(data["mood"], int) or data["mood"] < 0 or data["mood"] > 6:
        errors.append("Mood must be an integer between 0 and 6.")
    if not data.get("date"):
        errors.append("Date is required.")
    return errors
