"""Tests for the mind-map store (backend.mindmaps).

One encrypted file per map (data/mindmaps/<user>/<id>.enc), same AES-256-GCM
model as entries/trackers — maps hold personal psychology content (problems,
triggers, health) and are journal-grade sensitive.

Map shape:
{
  "id", "title", "kind": "mindmap" | "radial",
  "created_at", "updated_at",
  "nodes": [{"id", "parent": None|str, "label", "note", "color"?}],
  "links": [{"from", "to", "label"?}],   # cross-relations, not hierarchy
}
Hierarchy: exactly one root (parent None); tier = depth from root.
"""

import pytest
from datetime import datetime, timezone

from backend import mindmaps
from backend.crypto import generate_user_key

NOW = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)


def simple_map(**over):
    m = {
        "title": "My map",
        "kind": "mindmap",
        "nodes": [
            {"id": "root", "parent": None, "label": "Core problem", "note": ""},
            {"id": "a", "parent": "root", "label": "Branch A", "note": ""},
            {"id": "a1", "parent": "a", "label": "Chunk A1", "note": ""},
        ],
        "links": [],
    }
    m.update(over)
    return m


class TestCrud:
    def test_create_and_read(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "My map", "mindmap", now=NOW)
        assert m["title"] == "My map"
        assert m["kind"] == "mindmap"
        assert m["nodes"] == [] and m["links"] == []
        loaded = mindmaps.get_map("alice", key, m["id"])
        assert loaded["id"] == m["id"]

    def test_list(self, isolated_data_dir):
        key = generate_user_key()
        mindmaps.create_map("alice", key, "One", "mindmap", now=NOW)
        mindmaps.create_map("alice", key, "Two", "radial", now=NOW)
        listing = mindmaps.list_maps("alice", key)
        assert sorted(x["title"] for x in listing) == ["One", "Two"]
        assert all("node_count" in x and "updated_at" in x for x in listing)

    def test_save_map_roundtrip(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "My map", "mindmap", now=NOW)
        out = mindmaps.save_map("alice", key, m["id"], now=NOW, **simple_map())
        assert out["title"] == "My map"
        loaded = mindmaps.get_map("alice", key, m["id"])
        assert [n["id"] for n in loaded["nodes"]] == ["root", "a", "a1"]
        assert loaded["links"] == []

    def test_delete(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "My map", "mindmap", now=NOW)
        assert mindmaps.delete_map("alice", key, m["id"]) is True
        assert mindmaps.get_map("alice", key, m["id"]) is None
        assert mindmaps.delete_map("alice", key, m["id"]) is False

    def test_missing_user_is_empty(self, isolated_data_dir):
        key = generate_user_key()
        assert mindmaps.list_maps("ghost", key) == []
        assert mindmaps.get_map("ghost", key, "x") is None

    def test_users_isolated(self, isolated_data_dir):
        ka, kb = generate_user_key(), generate_user_key()
        m = mindmaps.create_map("alice", ka, "A", "mindmap", now=NOW)
        assert mindmaps.get_map("bob", kb, m["id"]) is None

    def test_no_plaintext_on_disk(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "SECRETTITLE", "mindmap", now=NOW)
        mindmaps.save_map("alice", key, m["id"], now=NOW,
                          **simple_map(nodes=[{"id": "r", "parent": None,
                                               "label": "SECRETLABEL", "note": "SECRETNOTE"}]))
        import os
        raw = b""
        base = mindmaps._maps_dir("alice")
        for f in os.listdir(base):
            raw += open(os.path.join(base, f), "rb").read()
        for marker in (b"SECRETTITLE", b"SECRETLABEL", b"SECRETNOTE"):
            assert marker not in raw

    def test_wrong_key_is_none(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "A", "mindmap", now=NOW)
        assert mindmaps.get_map("alice", generate_user_key(), m["id"]) is None


class TestValidation:
    def test_bad_kind(self, isolated_data_dir):
        key = generate_user_key()
        with pytest.raises(ValueError):
            mindmaps.create_map("alice", key, "X", "flowchart", now=NOW)

    def test_empty_title(self, isolated_data_dir):
        key = generate_user_key()
        with pytest.raises(ValueError):
            mindmaps.create_map("alice", key, "  ", "mindmap", now=NOW)

    def test_unknown_map(self, isolated_data_dir):
        key = generate_user_key()
        with pytest.raises(ValueError):
            mindmaps.save_map("alice", key, "nope", now=NOW, **simple_map())

    def test_two_roots_rejected(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "X", "radial", now=NOW)
        bad = simple_map(nodes=[
            {"id": "r1", "parent": None, "label": "One", "note": ""},
            {"id": "r2", "parent": None, "label": "Two", "note": ""},
        ])
        with pytest.raises(ValueError):
            mindmaps.save_map("alice", key, m["id"], now=NOW, **bad)

    def test_dangling_parent_rejected(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "X", "mindmap", now=NOW)
        bad = simple_map(nodes=[{"id": "r", "parent": None, "label": "Root", "note": ""},
                                {"id": "c", "parent": "GHOST", "label": "C", "note": ""}])
        with pytest.raises(ValueError):
            mindmaps.save_map("alice", key, m["id"], now=NOW, **bad)

    def test_cycle_rejected(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "X", "mindmap", now=NOW)
        bad = simple_map(nodes=[
            {"id": "r", "parent": None, "label": "Root", "note": ""},
            {"id": "a", "parent": "b", "label": "A", "note": ""},
            {"id": "b", "parent": "a", "label": "B", "note": ""},
        ])
        with pytest.raises(ValueError):
            mindmaps.save_map("alice", key, m["id"], now=NOW, **bad)

    def test_duplicate_node_id_rejected(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "X", "mindmap", now=NOW)
        bad = simple_map(nodes=[
            {"id": "r", "parent": None, "label": "Root", "note": ""},
            {"id": "r", "parent": "r", "label": "Clone", "note": ""},
        ])
        with pytest.raises(ValueError):
            mindmaps.save_map("alice", key, m["id"], now=NOW, **bad)

    def test_link_endpoints_must_exist(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "X", "radial", now=NOW)
        bad = simple_map(links=[{"from": "root", "to": "GHOST"}])
        with pytest.raises(ValueError):
            mindmaps.save_map("alice", key, m["id"], now=NOW, **bad)

    def test_too_many_nodes_rejected(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "X", "mindmap", now=NOW)
        nodes = [{"id": f"n{i}", "parent": None if i == 0 else "n0",
                  "label": "x", "note": ""} for i in range(mindmaps.MAX_NODES + 1)]
        with pytest.raises(ValueError):
            mindmaps.save_map("alice", key, m["id"], now=NOW,
                              **simple_map(nodes=nodes))

    def test_long_label_rejected(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "X", "mindmap", now=NOW)
        bad = simple_map(nodes=[{"id": "r", "parent": None, "label": "x" * 500, "note": ""}])
        with pytest.raises(ValueError):
            mindmaps.save_map("alice", key, m["id"], now=NOW, **bad)

    def test_root_required(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "X", "mindmap", now=NOW)
        with pytest.raises(ValueError):
            mindmaps.save_map("alice", key, m["id"], now=NOW,
                              **simple_map(nodes=[{"id": "a", "parent": "a", "label": "A", "note": ""}]))


class TestDerived:
    def test_node_count_in_listing(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "X", "mindmap", now=NOW)
        mindmaps.save_map("alice", key, m["id"], now=NOW, **simple_map())
        listing = mindmaps.list_maps("alice", key)
        assert listing[0]["node_count"] == 3

    def test_updated_at_changes(self, isolated_data_dir):
        key = generate_user_key()
        m = mindmaps.create_map("alice", key, "X", "mindmap", now=NOW)
        later = datetime(2026, 10, 30, 12, 0, tzinfo=timezone.utc)
        out = mindmaps.save_map("alice", key, m["id"], now=later, **simple_map())
        assert out["updated_at"] != out["created_at"]
