import os
import io
import tarfile
import zipfile
from datetime import datetime
from backend.crypto import encrypt_entry
from backend.entry_crud import get_entry
from backend.utils import list_user_entries, parse_entry_text, build_entry_path, build_entry_text, validate_entry_data
from backend.config import MOOD_LABELS, MOOD_COLORS as MOOD_COLORS_RGB, DATA_VERSION, get_user_settings

from fpdf import FPDF


MOOD_COLORS_PDF = {k: tuple(int(v.lstrip('#')[i:i+2], 16) for i in (0, 2, 4)) for k, v in MOOD_COLORS_RGB.items()}


FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
FONT_PATH = os.path.join(FONT_DIR, "DejaVuSans.ttf")
# Fallback to system font if bundled one doesn't exist
_SYSTEM_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
if not os.path.exists(FONT_PATH):
    FONT_PATH = _SYSTEM_FONT


def _init_pdf() -> FPDF:
    pdf = FPDF()
    pdf.add_font("DejaVuSans", "", FONT_PATH)
    pdf.add_font("DejaVuSans", "B", FONT_PATH)
    return pdf


def _clean_pdf_text(text: str) -> str:
    """Strip characters that DejaVuSans can't render (emoji and other SMP chars)."""
    cleaned = []
    for ch in text:
        if ord(ch) <= 0xFFFF and ch not in "\ud800\udc00":
            cleaned.append(ch)
    return "".join(cleaned)


PDF_LANG = {
    "en": {
        "title": "DailyMood Journal",
        "user": "User",
        "exported": "Exported",
        "entries": "Total entries",
        "mood": "Mood",
        "tags": "Tags",
        "unknown": "Unknown",
        "date_fmt": "%d/%m/%Y %H:%M",
        "labels": ["Terrible", "Bad", "Poor", "Okay", "Good", "Great", "Amazing"],
    },
    "pt-BR": {
        "title": "Diário do Humor",
        "user": "Usuário",
        "exported": "Exportado em",
        "entries": "Total de entradas",
        "mood": "Humor",
        "tags": "Tags",
        "unknown": "Desconhecido",
        "date_fmt": "%d/%m/%Y %H:%M",
        "labels": ["Péssimo", "Ruim", "Fraco", "Neutro", "Bom", "Ótimo", "Incrível"],
    },
}


def _fmt_date(dt: datetime, lang: str) -> str:
    fmt = PDF_LANG.get(lang, PDF_LANG["en"])["date_fmt"]
    return dt.strftime(fmt)


def build_pdf_export(username: str, user_key: bytes, date_from=None, date_to=None) -> bytes | None:
    entries = list_user_entries(username)
    if not entries:
        return None

    from datetime import datetime as dt_parse

    # Get user's language setting
    settings = get_user_settings(username)
    lang = settings.get("language", "en")
    lang_data = PDF_LANG.get(lang, PDF_LANG["en"])
    mood_labels = lang_data["labels"]

    decoded = []
    for path in entries:
        entry = get_entry(path, user_key)
        if entry is None:
            continue

        if date_from or date_to:
            try:
                entry_date_str = entry.get("date", "")
                entry_dt = dt_parse.strptime(entry_date_str, "%Y-%m-%d %H:%M").date()
            except (ValueError, TypeError):
                continue
            if date_from and entry_dt < date_from:
                continue
            if date_to and entry_dt > date_to:
                continue

        decoded.append(entry)

    if not decoded:
        return None

    decoded.sort(key=lambda e: e.get("date", ""), reverse=True)

    pdf = _init_pdf()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    pdf.set_font("DejaVuSans", "B", 22)
    pdf.cell(0, 12, lang_data["title"], align="C", ln=True)
    pdf.set_font("DejaVuSans", "", 10)
    pdf.cell(0, 7, f"{lang_data['user']}: {username}", align="C", ln=True)
    pdf.cell(0, 7, f"{lang_data['exported']}: {datetime.now().strftime('%d/%m/%Y')}", align="C", ln=True)
    pdf.cell(0, 7, f"{lang_data['entries']}: {len(decoded)}", align="C", ln=True)
    pdf.ln(8)

    for i, entry in enumerate(decoded):
        if i > 0:
            pdf.add_page()

        mood = entry.get("mood", 3)
        color = MOOD_COLORS_PDF.get(mood, (158, 158, 158))
        label = mood_labels[mood] if 0 <= mood < len(mood_labels) else lang_data["unknown"]

        header_color = color
        pdf.set_fill_color(*header_color)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("DejaVuSans", "B", 14)
        pdf.cell(0, 10, f"  {_clean_pdf_text(entry.get('title', 'Untitled'))}", fill=True, ln=True)

        pdf.set_text_color(60, 60, 60)
        pdf.set_font("DejaVuSans", "", 9)
        entry_date = entry.get("date", "")
        try:
            dt_obj = dt_parse.strptime(entry_date, "%Y-%m-%d %H:%M")
            entry_date = _fmt_date(dt_obj, lang)
        except (ValueError, TypeError):
            pass
        pdf.cell(0, 6, f"  {entry_date}  |  {lang_data['mood']}: {label} ({mood})", ln=True)

        tags = entry.get("tags", [])
        if tags:
            pdf.cell(0, 6, f"  {lang_data['tags']}: {_clean_pdf_text(', '.join(tags))}", ln=True)

        pdf.ln(3)
        body = entry.get("body", "")
        pdf.set_font("DejaVuSans", "", 10)
        for line in body.split("\n"):
            line = _clean_pdf_text(line.strip())
            if not line:
                pdf.ln(2)
                continue
            pdf.multi_cell(0, 5, line)
            pdf.x = pdf.l_margin

    return bytes(pdf.output(dest="S"))


def build_export_archive(username: str, fmt: str, user_key: bytes) -> bytes | None:
    entries = list_user_entries(username)
    if not entries:
        return None

    in_memory = {}

    for path in entries:
        entry = get_entry(path, user_key)
        if entry is None:
            continue

        body = entry.pop("body", "")
        path_val = entry.pop("path", "")

        try:
            dt = datetime.strptime(entry.get("date", ""), "%Y-%m-%d %H:%M")
        except (ValueError, TypeError):
            try:
                dt = datetime.fromisoformat(entry.get("date", ""))
            except (ValueError, TypeError):
                continue

        entry["date"] = dt.strftime("%Y-%m-%d %H:%M")
        frontmatter = dict(entry)
        plaintext = build_entry_text(frontmatter, body)

        filename = f"{dt.strftime('%Y-%m-%d_%H%M')}.md"
        counter = 1
        original = filename
        while filename in in_memory:
            name_parts = original.rsplit(".", 1)
            filename = f"{name_parts[0]}_{counter}.md"
            counter += 1
        in_memory[filename] = plaintext

    buf = io.BytesIO()

    if fmt == "tar.gz":
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            for filename, content in in_memory.items():
                info = tarfile.TarInfo(name=filename)
                info.size = len(content.encode("utf-8"))
                tar.addfile(info, io.BytesIO(content.encode("utf-8")))
    elif fmt == "zip":
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for filename, content in in_memory.items():
                zf.writestr(filename, content)

    return buf.getvalue()


def process_import_files(username: str, files: list, user_key: bytes) -> dict:
    total_imported = 0
    total_skipped = 0
    file_results = []
    existing_paths = set(list_user_entries(username))

    for uploaded_file in files:
        filename = uploaded_file.filename.lower()
        content = uploaded_file.file.read()

        if filename.endswith(".tar.gz") or filename.endswith(".tgz"):
            result = _process_tar(content, username, user_key, existing_paths, filename)
        elif filename.endswith(".zip"):
            result = _process_zip(content, username, user_key, existing_paths, filename)
        elif filename.endswith(".md") or filename.endswith(".txt"):
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                total_skipped += 1
                file_results.append({"filename": filename, "status": "skipped", "reason": "Unicode decode error"})
                continue
            result = _process_plain_file(text, username, user_key, existing_paths, filename)
        else:
            total_skipped += 1
            file_results.append({"filename": filename, "status": "skipped", "reason": "Unsupported file type"})
            continue

        total_imported += result["imported"]
        total_skipped += result["skipped"]
        file_results.extend(result["files"])

    return {
        "imported": total_imported,
        "skipped": total_skipped,
        "files": file_results,
    }


def _process_tar(data: bytes, username: str, user_key: bytes, existing_paths: set, archive_name: str = "archive.tar.gz") -> dict:
    imported = 0
    skipped = 0
    files = []
    buf = io.BytesIO(data)
    with tarfile.open(fileobj=buf, mode="r:gz") as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            f = tar.extractfile(member)
            if f is None:
                continue
            text = f.read().decode("utf-8")
            result = _process_plain_file(text, username, user_key, existing_paths, member.name)
            imported += result["imported"]
            skipped += result["skipped"]
            files.extend(result["files"])
    return {"imported": imported, "skipped": skipped, "files": files}


def _process_zip(data: bytes, username: str, user_key: bytes, existing_paths: set, archive_name: str = "archive.zip") -> dict:
    imported = 0
    skipped = 0
    files = []
    buf = io.BytesIO(data)
    with zipfile.ZipFile(buf, "r") as zf:
        for name in zf.namelist():
            if name.endswith("/"):
                continue
            text = zf.read(name).decode("utf-8")
            result = _process_plain_file(text, username, user_key, existing_paths, name)
            imported += result["imported"]
            skipped += result["skipped"]
            files.extend(result["files"])
    return {"imported": imported, "skipped": skipped, "files": files}


def _process_plain_file(text: str, username: str, user_key: bytes, existing_paths: set, filename: str = "unknown") -> dict:
    frontmatter, body = parse_entry_text(text)

    if "title" not in frontmatter:
        return {"imported": 0, "skipped": 1, "files": [{"filename": filename, "status": "skipped", "reason": "Missing title in frontmatter"}]}

    title = frontmatter.get("title", "Untitled")
    mood = frontmatter.get("mood", 3)
    tags = frontmatter.get("tags", [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]

    try:
        mood = int(mood)
    except (ValueError, TypeError):
        mood = 3

    if mood < 0 or mood > 6:
        mood = 3

    date_str = frontmatter.get("date", "")
    try:
        dt = datetime.fromisoformat(date_str) if isinstance(date_str, str) else date_str
    except (ValueError, TypeError):
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
        except ValueError:
            return {"imported": 0, "skipped": 1, "files": [{"filename": filename, "status": "skipped", "reason": f"Invalid date: {date_str}"}]}

    entry_data = {
        "title": title,
        "date": dt,
        "mood": mood,
        "tags": tags,
        "body": body,
        "author": username,
    }

    for key, value in frontmatter.items():
        if key not in ("title", "date", "mood", "tags", "author", "body"):
            entry_data[key] = value

    errors = validate_entry_data(entry_data)
    if errors:
        return {"imported": 0, "skipped": 1, "files": [{"filename": filename, "status": "skipped", "reason": "; ".join(errors)}]}

    path = build_entry_path(username, dt)
    if path in existing_paths:
        for offset in range(1, 60):
            new_dt = dt.replace(minute=(dt.minute + offset) % 60)
            new_path = build_entry_path(username, new_dt)
            if new_path not in existing_paths:
                path = new_path
                dt = new_dt
                break
        else:
            return {"imported": 0, "skipped": 1, "files": [{"filename": filename, "status": "skipped", "reason": "Could not deconflict timestamp (60 attempts)"}]}

    os.makedirs(os.path.dirname(path), exist_ok=True)

    frontmatter_out = {
        "title": title,
        "date": dt.strftime("%Y-%m-%d %H:%M"),
        "mood": mood,
        "tags": tags,
        "author": username,
    }
    for key, value in frontmatter.items():
        if key not in frontmatter_out:
            frontmatter_out[key] = value

    plaintext = build_entry_text(frontmatter_out, body)
    ciphertext = encrypt_entry(plaintext, user_key)
    with open(path, "wb") as f:
        f.write(ciphertext)
    existing_paths.add(path)

    return {"imported": 1, "skipped": 0, "files": [{"filename": filename, "status": "imported"}]}
