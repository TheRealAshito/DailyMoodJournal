"""Mind maps — one encrypted file per map (data/mindmaps/<user>/<id>.enc).

Map kinds:
- mindmap: classic tree — one core node, branches break it down.
- radial:  hierarchical radial ("onion") — tier = depth from the root (T0).

Map document:
{
  "id", "title", "kind", "created_at", "updated_at",
  "nodes": [{"id", "parent": None|str, "label", "note", "color"?}],
  "links": [{"from", "to", "label"?}],  # cross-relations (not hierarchy)
}

Privacy: maps hold problems, triggers, health/emotional content — as
sensitive as journal entries. Encrypted at rest with the user's key.
"""

import json
import os
import re
import hashlib
import uuid
from datetime import datetime, timezone

from backend import config
from backend.crypto import encrypt_entry, decrypt_entry

KINDS = {"mindmap", "radial"}
MAX_NODES = 500
MAX_LINKS = 200
MAX_LABEL = 120
MAX_NOTE = 2000
MAX_TITLE = 80


def _now_dt(now=None) -> datetime:
    return now if now is not None else datetime.now(timezone.utc)


def _safe_name(username: str) -> str:
    if re.fullmatch(r"[a-zA-Z0-9_\-.]{1,64}", username):
        return username
    return "u_" + hashlib.sha256(username.encode()).hexdigest()[:16]


def _maps_dir(username: str) -> str:
    return os.path.join(config.DATA_DIR, "mindmaps", _safe_name(username))


def _map_path(username: str, map_id: str) -> str:
    if not re.fullmatch(r"[a-f0-9]{32}", map_id or ""):
        raise ValueError("Bad map id")
    return os.path.join(_maps_dir(username), f"{map_id}.enc")


def _read(username: str, user_key: bytes, map_id: str) -> dict | None:
    try:
        path = _map_path(username, map_id)
    except ValueError:
        return None
    if not os.path.exists(path):
        return None
    try:
        with open(path, "rb") as f:
            payload = json.loads(decrypt_entry(f.read(), user_key))
    except Exception:
        return None  # wrong key / corrupt: treat as missing
    return payload if isinstance(payload, dict) else None


def _write(username: str, user_key: bytes, doc: dict):
    os.makedirs(_maps_dir(username), exist_ok=True)
    with open(_map_path(username, doc["id"]), "wb") as f:
        f.write(encrypt_entry(json.dumps(doc), user_key))


# ---------- validation ----------

def _check_nodes(nodes) -> list:
    if not isinstance(nodes, list) or len(nodes) > MAX_NODES:
        raise ValueError(f"nodes must be a list of at most {MAX_NODES}")
    seen = set()
    cleaned = []
    for n in nodes:
        if not isinstance(n, dict):
            raise ValueError("bad node")
        nid = n.get("id")
        if not isinstance(nid, str) or not nid or len(nid) > 64 or nid in seen:
            raise ValueError("bad node id")
        seen.add(nid)
        label = n.get("label") or ""
        if not isinstance(label, str) or not label.strip() or len(label) > MAX_LABEL:
            raise ValueError(f"label must be 1-{MAX_LABEL} chars")
        note = n.get("note") or ""
        if not isinstance(note, str) or len(note) > MAX_NOTE:
            raise ValueError(f"note too long (max {MAX_NOTE})")
        parent = n.get("parent")
        if parent is not None and not isinstance(parent, str):
            raise ValueError("bad parent")
        cleaned.append({
            "id": nid,
            "parent": parent,
            "label": label.strip(),
            "note": note,
            **({"color": n["color"]} if isinstance(n.get("color"), str) else {}),
        })
    return cleaned


def _check_graph(nodes: list, links):
    ids = {n["id"] for n in nodes}
    parents = {n["id"]: n["parent"] for n in nodes}
    roots = [n for n in nodes if n["parent"] is None]
    if len(roots) != 1:
        raise ValueError("map must have exactly one root node")
    for n in nodes:
        if n["parent"] is not None and n["parent"] not in ids:
            raise ValueError("parent not found")
    # cycle check: walk every chain to root with a visited guard
    for n in nodes:
        seen = set()
        cur = n["id"]
        while parents[cur] is not None:
            if cur in seen:
                raise ValueError("cycle in hierarchy")
            seen.add(cur)
            cur = parents[cur]

    if not isinstance(links, list) or len(links) > MAX_LINKS:
        raise ValueError(f"links must be a list of at most {MAX_LINKS}")
    cleaned = []
    for l in links:
        if not isinstance(l, dict) or l.get("from") not in ids or l.get("to") not in ids:
            raise ValueError("link endpoints must exist")
        label = l.get("label") or ""
        if not isinstance(label, str) or len(label) > MAX_LABEL:
            raise ValueError("link label too long")
        cleaned.append({"from": l["from"], "to": l["to"], "label": label.strip()})
    return cleaned


def _check_title(title) -> str:
    title = (title or "").strip()
    if not title or len(title) > MAX_TITLE:
        raise ValueError(f"title must be 1-{MAX_TITLE} chars")
    return title


# ---------- public API ----------

def create_map(username: str, user_key: bytes, title: str, kind: str,
               now=None) -> dict:
    now_dt = _now_dt(now)
    title = _check_title(title)
    if kind not in KINDS:
        raise ValueError("kind must be 'mindmap' or 'radial'")
    doc = {
        "id": uuid.uuid4().hex,
        "title": title,
        "kind": kind,
        "created_at": now_dt.isoformat(),
        "updated_at": now_dt.isoformat(),
        "nodes": [],
        "links": [],
    }
    _write(username, user_key, doc)
    return doc


def get_map(username: str, user_key: bytes, map_id: str) -> dict | None:
    return _read(username, user_key, map_id)


def save_map(username: str, user_key: bytes, map_id: str,
             title: str | None = None, nodes=None, links=None,
             kind: str | None = None, now=None) -> dict:
    """Whole-document save. Only provided fields change; kind is immutable."""
    now_dt = _now_dt(now)
    doc = _read(username, user_key, map_id)
    if doc is None:
        raise ValueError("Map not found")
    if kind is not None and kind != doc["kind"]:
        raise ValueError("kind is immutable")
    if title is not None:
        doc["title"] = _check_title(title)
    if nodes is not None:
        doc["nodes"] = _check_nodes(nodes)
        _check_graph(doc["nodes"], doc.get("links", []))
    if links is not None:
        doc["links"] = _check_graph(doc["nodes"], links)
    doc["updated_at"] = now_dt.isoformat()
    _write(username, user_key, doc)
    return doc


def list_maps(username: str, user_key: bytes) -> list:
    base = _maps_dir(username)
    if not os.path.isdir(base):
        return []
    out = []
    for fname in os.listdir(base):
        if not fname.endswith(".enc"):
            continue
        doc = _read(username, user_key, fname[:-4])
        if doc is None:
            continue
        out.append({
            "id": doc["id"],
            "title": doc.get("title", ""),
            "kind": doc.get("kind", "mindmap"),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
            "node_count": len(doc.get("nodes", [])),
        })
    out.sort(key=lambda m: m.get("updated_at") or "", reverse=True)
    return out


def delete_map(username: str, user_key: bytes, map_id: str) -> bool:
    try:
        path = _map_path(username, map_id)
    except ValueError:
        return False
    if not os.path.exists(path):
        return False
    os.remove(path)
    return True
