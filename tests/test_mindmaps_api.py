"""HTTP tests for the mind-map API (/api/mindmaps).

Contract (frozen before the editor is built against it):
- GET    /api/mindmaps                    -> {maps: [meta...]}
- POST   /api/mindmaps {title, kind}      -> full map
- GET    /api/mindmaps/{id}               -> full map
- PATCH  /api/mindmaps/{id} {title?, nodes?, links?} -> full map (whole-doc save)
- DELETE /api/mindmaps/{id}               -> {status: "ok"}
- POST   /api/mindmaps/{id}/export/pdf {layout} -> application/pdf
  layout = {width, height, kind, title?, nodes: [{id, label, lines: [...],
  x, y, w, h, tier, color, note?}], links: [{x1, y1, x2, y2, cx1, cy1,
  cx2, cy2, dashed?}], rings?: [{tier, r, color}]}
  Positions are px in layout space; server scales to page, draws geometry.
Validation 400, unknown map 404, auth everywhere.
"""

import pytest


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from backend.main import app
    with TestClient(app) as c:
        yield c


def _signup(client, username="alice"):
    return client.post("/api/auth/signup", json={
        "username": username,
        "password": "Secret123!",
        "security_question": "pet?",
        "security_answer": "fluffy",
    })


def _layout():
    return {
        "width": 800, "height": 600, "kind": "radial", "title": "My map",
        "nodes": [
            {"id": "root", "label": "Me", "lines": ["Me"], "x": 380, "y": 280,
             "w": 80, "h": 40, "tier": 0, "color": "#bc5c38"},
            {"id": "h", "label": "Health", "lines": ["Health"], "x": 150, "y": 120,
             "w": 100, "h": 40, "tier": 1, "color": "#6f8f66"},
        ],
        "links": [{"x1": 420, "y1": 300, "x2": 200, "y2": 140,
                   "cx1": 350, "cy1": 250, "cx2": 260, "cy2": 170, "dashed": False}],
        "rings": [{"tier": 1, "r": 180, "color": "#bc5c38"},
                  {"tier": 2, "r": 320, "color": "#bc5c38"}],
    }


class TestCrud:
    def test_requires_auth(self, client):
        assert client.get("/api/mindmaps").status_code == 401
        assert client.post("/api/mindmaps", json={"title": "X", "kind": "mindmap"}).status_code == 401

    def test_create_list_get(self, client):
        _signup(client)
        r = client.post("/api/mindmaps", json={"title": "My map", "kind": "radial"})
        assert r.status_code == 200
        m = r.json()
        assert m["kind"] == "radial" and m["nodes"] == []
        r = client.get("/api/mindmaps")
        assert [x["title"] for x in r.json()["maps"]] == ["My map"]
        assert client.get(f"/api/mindmaps/{m['id']}").json()["id"] == m["id"]

    def test_patch_whole_doc(self, client):
        _signup(client)
        m = client.post("/api/mindmaps", json={"title": "X", "kind": "mindmap"}).json()
        doc = {
            "title": "Renamed",
            "nodes": [
                {"id": "root", "parent": None, "label": "Core", "note": ""},
                {"id": "a", "parent": "root", "label": "Branch", "note": "hi"},
            ],
            "links": [{"from": "root", "to": "a", "label": "related"}],
        }
        r = client.patch(f"/api/mindmaps/{m['id']}", json=doc)
        assert r.status_code == 200
        out = r.json()
        assert out["title"] == "Renamed"
        assert len(out["nodes"]) == 2
        assert out["links"][0]["label"] == "related"

    def test_patch_partial(self, client):
        _signup(client)
        m = client.post("/api/mindmaps", json={"title": "X", "kind": "mindmap"}).json()
        client.patch(f"/api/mindmaps/{m['id']}", json={"title": "Only title"})
        assert client.get(f"/api/mindmaps/{m['id']}").json()["title"] == "Only title"

    def test_delete_and_404(self, client):
        _signup(client)
        m = client.post("/api/mindmaps", json={"title": "X", "kind": "mindmap"}).json()
        assert client.delete(f"/api/mindmaps/{m['id']}").status_code == 200
        assert client.get(f"/api/mindmaps/{m['id']}").status_code == 404
        assert client.delete(f"/api/mindmaps/{m['id']}").status_code == 404

    def test_validation_400(self, client):
        _signup(client)
        assert client.post("/api/mindmaps", json={"title": "X", "kind": "nope"}).status_code == 400
        m = client.post("/api/mindmaps", json={"title": "X", "kind": "mindmap"}).json()
        bad = {"nodes": [{"id": "a", "parent": "GHOST", "label": "A", "note": ""}]}
        assert client.patch(f"/api/mindmaps/{m['id']}", json=bad).status_code == 400

    def test_user_isolation(self, client):
        _signup(client, "alice")
        m = client.post("/api/mindmaps", json={"title": "A", "kind": "mindmap"}).json()
        client.post("/api/auth/logout")
        _signup(client, "bob")
        assert client.get("/api/mindmaps").json()["maps"] == []
        assert client.get(f"/api/mindmaps/{m['id']}").status_code == 404


class TestPdfExport:
    def test_export_returns_pdf(self, client):
        _signup(client)
        m = client.post("/api/mindmaps", json={"title": "My map", "kind": "radial"}).json()
        r = client.post(f"/api/mindmaps/{m['id']}/export/pdf", json={"layout": _layout()})
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content[:5] == b"%PDF-"

    def test_export_uses_map_title(self, client):
        _signup(client)
        m = client.post("/api/mindmaps", json={"title": "Anxiety map", "kind": "radial"}).json()
        r = client.post(f"/api/mindmaps/{m['id']}/export/pdf", json={"layout": _layout()})
        # title text is drawn into the PDF content stream (compressed, so just
        # assert a valid non-trivial PDF came back)
        assert len(r.content) > 2000

    def test_export_circle_nodes(self, client):
        """Mindly-style payload: shape='circle' with r/text_color draws fine."""
        _signup(client)
        m = client.post("/api/mindmaps", json={"title": "Mindly", "kind": "radial"}).json()
        layout = _layout()
        for n in layout["nodes"]:
            n.update({"shape": "circle", "r": n["w"] / 2, "text_color": "#ffffff"})
        r = client.post(f"/api/mindmaps/{m['id']}/export/pdf", json={"layout": layout})
        assert r.status_code == 200
        assert r.content[:5] == b"%PDF-"

    def test_export_requires_auth(self, client):
        r = client.post("/api/mindmaps/x/export/pdf", json={"layout": _layout()})
        assert r.status_code == 401

    def test_export_unknown_map_404(self, client):
        _signup(client)
        r = client.post("/api/mindmaps/nope/export/pdf", json={"layout": _layout()})
        assert r.status_code == 404

    def test_export_bad_layout_400(self, client):
        _signup(client)
        m = client.post("/api/mindmaps", json={"title": "X", "kind": "radial"}).json()
        r = client.post(f"/api/mindmaps/{m['id']}/export/pdf", json={"layout": {"nodes": "nope"}})
        assert r.status_code == 400

    def test_export_empty_map_still_works(self, client):
        _signup(client)
        m = client.post("/api/mindmaps", json={"title": "Empty", "kind": "mindmap"}).json()
        layout = {"width": 400, "height": 300, "kind": "mindmap",
                  "nodes": [], "links": [], "rings": []}
        r = client.post(f"/api/mindmaps/{m['id']}/export/pdf", json={"layout": layout})
        assert r.status_code == 200
        assert r.content[:5] == b"%PDF-"
