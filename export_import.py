import os
import io
import tarfile
import zipfile
from datetime import datetime
import yaml
import streamlit as st
from crypto import encrypt_entry, decrypt_entry
from entry_crud import get_entry
from utils import list_user_entries, parse_entry_text, build_entry_path, build_entry_text, validate_entry_data


def build_export_archive(username: str, fmt: str, password: str | None = None) -> bytes | None:
    user_key = st.session_state.get("user_key")
    if not user_key:
        return None

    entries = list_user_entries(username)
    if not entries:
        return None

    in_memory = {}

    for path in entries:
        entry = get_entry(path, user_key)
        if entry is None:
            continue

        dt_str = entry.get("date", "")
        try:
            dt = datetime.fromisoformat(dt_str) if isinstance(dt_str, str) else dt_str
        except ValueError:
            try:
                dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
            except ValueError:
                continue

        frontmatter = {
            "title": entry.get("title", ""),
            "date": dt.strftime("%Y-%m-%d %H:%M") if hasattr(dt, "strftime") else dt_str,
            "mood": entry.get("mood", 3),
            "tags": entry.get("tags", []),
            "author": entry.get("author", username),
        }
        body = entry.get("body", "")
        plaintext = build_entry_text(frontmatter, body)

        filename = f"{dt.strftime('%Y-%m-%d_%H%M') if hasattr(dt, 'strftime') else 'entry'}.md"
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


def process_import_files(username: str, uploaded_files) -> tuple[int, int]:
    user_key = st.session_state.get("user_key")
    if not user_key:
        return 0, 0

    imported = 0
    skipped = 0

    existing_paths = set(list_user_entries(username))

    for uploaded_file in uploaded_files:
        filename = uploaded_file.name.lower()
        content = uploaded_file.read()

        if filename.endswith(".tar.gz") or filename.endswith(".tgz"):
            result = _process_tar(content, username, user_key, existing_paths)
        elif filename.endswith(".zip"):
            result = _process_zip(content, username, user_key, existing_paths)
        elif filename.endswith(".md") or filename.endswith(".txt"):
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                skipped += 1
                continue
            result = _process_plain_file(text, uploaded_file.name, username, user_key, existing_paths)
        else:
            skipped += 1
            continue

        imported += result[0]
        skipped += result[1]

    return imported, skipped


def _process_tar(data: bytes, username: str, user_key: bytes, existing_paths: set) -> tuple[int, int]:
    imported = 0
    skipped = 0
    buf = io.BytesIO(data)
    with tarfile.open(fileobj=buf, mode="r:gz") as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            f = tar.extractfile(member)
            if f is None:
                continue
            text = f.read().decode("utf-8")
            result = _process_plain_file(text, member.name, username, user_key, existing_paths)
            imported += result[0]
            skipped += result[1]
    return imported, skipped


def _process_zip(data: bytes, username: str, user_key: bytes, existing_paths: set) -> tuple[int, int]:
    imported = 0
    skipped = 0
    buf = io.BytesIO(data)
    with zipfile.ZipFile(buf, "r") as zf:
        for name in zf.namelist():
            if name.endswith("/"):
                continue
            text = zf.read(name).decode("utf-8")
            result = _process_plain_file(text, name, username, user_key, existing_paths)
            imported += result[0]
            skipped += result[1]
    return imported, skipped


def _process_plain_file(text: str, source_name: str, username: str, user_key: bytes, existing_paths: set) -> tuple[int, int]:
    frontmatter, body = parse_entry_text(text)

    if "title" not in frontmatter:
        return 0, 1

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
            return 0, 1

    entry_data = {
        "title": title,
        "date": dt,
        "mood": mood,
        "tags": tags,
        "body": body,
        "author": username,
    }

    errors = validate_entry_data(entry_data)
    if errors:
        return 0, 1

    path = build_entry_path(username, dt)
    if path in existing_paths:
        return 0, 1

    os.makedirs(os.path.dirname(path), exist_ok=True)
    plaintext = build_entry_text(
        {
            "title": title,
            "date": dt.strftime("%Y-%m-%d %H:%M"),
            "mood": mood,
            "tags": tags,
            "author": username,
        },
        body,
    )
    ciphertext = encrypt_entry(plaintext, user_key)
    with open(path, "wb") as f:
        f.write(ciphertext)
    existing_paths.add(path)

    return 1, 0
