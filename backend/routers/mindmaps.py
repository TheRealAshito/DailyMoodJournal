"""Mind-map API — CRUD + PDF export from a client-computed layout."""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

from backend.routers.auth import _get_session
from backend import mindmaps as store
from backend.mindmap_pdf import build_mindmap_pdf
from backend.config import get_user_settings

router = APIRouter(prefix="/api/mindmaps", tags=["mindmaps"])


def _session(request: Request):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    return session


def _call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ValueError as e:
        if str(e) == "Map not found":
            raise HTTPException(404, "Map not found")
        raise HTTPException(400, str(e))


class MapCreate(BaseModel):
    title: str
    kind: str


class MapPatch(BaseModel):
    title: str | None = None
    nodes: list | None = None
    links: list | None = None


class ExportBody(BaseModel):
    layout: dict


def _check_layout(layout: dict) -> dict:
    """Loose shape check + caps so a hostile payload can't bloat the PDF."""
    if not isinstance(layout, dict):
        raise HTTPException(400, "layout must be an object")
    nodes = layout.get("nodes")
    links = layout.get("links")
    if not isinstance(nodes, list) or not isinstance(links, list):
        raise HTTPException(400, "layout.nodes and layout.links must be lists")
    if len(nodes) > 2000 or len(links) > 2000:
        raise HTTPException(400, "layout too large")
    for n in nodes[:2000]:
        if not isinstance(n, dict):
            raise HTTPException(400, "bad node")
        lines = n.get("lines")
        if lines is not None:
            if not isinstance(lines, list) or len(lines) > 6:
                raise HTTPException(400, "bad node lines")
            if any(not isinstance(x, str) or len(x) > 200 for x in lines):
                raise HTTPException(400, "bad node line")
        if not isinstance(n.get("label", ""), str) or len(str(n.get("label", ""))) > 300:
            raise HTTPException(400, "bad node label")
    return layout


@router.get("")
def list_maps(request: Request):
    session = _session(request)
    return {"maps": store.list_maps(session["username"], session["user_key"])}


@router.post("")
def create_map(body: MapCreate, request: Request):
    session = _session(request)
    m = _call(store.create_map, session["username"], session["user_key"],
              body.title, body.kind)
    return m


@router.get("/{map_id}")
def get_map(map_id: str, request: Request):
    session = _session(request)
    m = store.get_map(session["username"], session["user_key"], map_id)
    if m is None:
        raise HTTPException(404, "Map not found")
    return m


@router.patch("/{map_id}")
def patch_map(map_id: str, body: MapPatch, request: Request):
    session = _session(request)
    m = _call(store.save_map, session["username"], session["user_key"], map_id,
              title=body.title, nodes=body.nodes, links=body.links)
    return m


@router.delete("/{map_id}")
def delete_map(map_id: str, request: Request):
    session = _session(request)
    if not _call(store.delete_map, session["username"], session["user_key"], map_id):
        raise HTTPException(404, "Map not found")
    return {"status": "ok"}


@router.post("/{map_id}/export/pdf")
def export_pdf(map_id: str, body: ExportBody, request: Request):
    session = _session(request)
    m = store.get_map(session["username"], session["user_key"], map_id)
    if m is None:
        raise HTTPException(404, "Map not found")
    layout = _check_layout(body.layout)
    lang = get_user_settings(session["username"]).get("language", "en")
    pdf = build_mindmap_pdf(m, layout, lang=lang)
    filename = f"dailymood_mindmap_{map_id[:8]}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
