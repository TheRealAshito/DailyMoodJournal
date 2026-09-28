"""Tests for entry-form draft autosave storage (backend.routers.drafts)."""

import json
import os
import pytest
from backend.routers.drafts import (
    _load_drafts,
    _save_drafts,
    _drafts_path,
    get_draft,
    save_draft,
    delete_draft,
)
from backend.crypto import generate_user_key


SAMPLE_PAYLOAD = {
    "title": "Half-written entry",
    "body": "I was typing this and then...",
    "mood": 2,
    "tags": ["Anxious"],
    "scales": {"Energy": 3},
    "date": "2025-03-15",
    "time": "22:10",
    "include_prompts": True,
    "prompts": [{"category": "gratitude", "key": "prompt_gratitude_2"}],
    "responses": [" grateful for..."],
}


class TestDraftStorage:
    def test_save_and_load_roundtrip(self, isolated_data_dir, user_key):
        record = save_draft("alice", "new", SAMPLE_PAYLOAD, user_key)
        loaded = get_draft("alice", "new", user_key)
        assert loaded is not None
        assert loaded["payload"]["title"] == "Half-written entry"
        assert loaded["payload"]["responses"] == [" grateful for..."]
        assert loaded["updated_at"] == record["updated_at"]

    def test_get_missing_draft(self, isolated_data_dir, user_key):
        assert get_draft("alice", "new", user_key) is None

    def test_save_sets_updated_at(self, isolated_data_dir, user_key):
        record = save_draft("alice", "new", SAMPLE_PAYLOAD, user_key)
        assert record["updated_at"]

    def test_upsert_overwrites(self, isolated_data_dir, user_key):
        save_draft("alice", "new", {"title": "old"}, user_key)
        save_draft("alice", "new", {"title": "new"}, user_key)
        loaded = get_draft("alice", "new", user_key)
        assert loaded is not None
        assert loaded["payload"] == {"title": "new"}
        assert len(_load_drafts("alice", user_key)) == 1

    def test_delete_draft(self, isolated_data_dir, user_key):
        save_draft("alice", "new", SAMPLE_PAYLOAD, user_key)
        assert delete_draft("alice", "new", user_key) is True
        assert get_draft("alice", "new", user_key) is None

    def test_delete_missing_draft(self, isolated_data_dir, user_key):
        assert delete_draft("alice", "new", user_key) is False

    def test_multiple_keys_are_independent(self, isolated_data_dir, user_key):
        edit_key = "/entries/alice/2025/03/2025-03-15_1030.enc"
        save_draft("alice", "new", {"title": "draft A"}, user_key)
        save_draft("alice", edit_key, {"title": "draft B"}, user_key)
        draft_a = get_draft("alice", "new", user_key)
        draft_b = get_draft("alice", edit_key, user_key)
        assert draft_a is not None and draft_b is not None
        assert draft_a["payload"]["title"] == "draft A"
        assert draft_b["payload"]["title"] == "draft B"
        delete_draft("alice", "new", user_key)
        assert get_draft("alice", edit_key, user_key) is not None

    def test_users_are_isolated(self, isolated_data_dir, user_key):
        save_draft("alice", "new", {"title": "alice's"}, user_key)
        assert get_draft("bob", "new", user_key) is None
        save_draft("bob", "new", {"title": "bob's"}, user_key)
        alice_draft = get_draft("alice", "new", user_key)
        assert alice_draft is not None
        assert alice_draft["payload"]["title"] == "alice's"


class TestEncryptedDraftsFile:
    def test_encrypted_file_exists(self, isolated_data_dir, user_key):
        save_draft("alice", "new", SAMPLE_PAYLOAD, user_key)
        path = _drafts_path("alice")
        assert os.path.exists(path)
        assert path.endswith("_drafts.enc")

    def test_file_is_not_plaintext(self, isolated_data_dir, user_key):
        save_draft("alice", "new", SAMPLE_PAYLOAD, user_key)
        with open(_drafts_path("alice"), "rb") as f:
            raw = f.read()
        assert b"Half-written entry" not in raw
        assert b"grateful" not in raw
        # And not parseable as JSON
        with pytest.raises((json.JSONDecodeError, UnicodeDecodeError)):
            json.loads(raw)

    def test_load_empty_when_no_file(self, isolated_data_dir, user_key):
        assert _load_drafts("nonexistent", user_key) == {}

    def test_load_empty_on_wrong_key(self, isolated_data_dir, user_key):
        save_draft("alice", "new", SAMPLE_PAYLOAD, user_key)
        wrong_key = generate_user_key()
        assert _load_drafts("alice", wrong_key) == {}

    def test_unicode_payload(self, isolated_data_dir, user_key):
        payload = {"title": "Café 日本語", "body": "olá mundo ☀️"}
        save_draft("alice", "new", payload, user_key)
        loaded = get_draft("alice", "new", user_key)
        assert loaded is not None
        assert loaded["payload"]["title"] == "Café 日本語"

    def test_empty_payload(self, isolated_data_dir, user_key):
        save_draft("alice", "new", {}, user_key)
        loaded = get_draft("alice", "new", user_key)
        assert loaded is not None
        assert loaded["payload"] == {}


class TestDraftAPI:
    """HTTP-level tests. These catch route-shape bugs the helper tests can't
    (e.g. draft keys that are full entry paths containing slashes)."""

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from backend.main import app
        with TestClient(app) as c:
            yield c

    def _signup(self, client, username="alice"):
        r = client.post("/api/auth/signup", json={
            "username": username,
            "password": "Secret123!",
            "security_question": "pet?",
            "security_answer": "fluffy",
        })
        assert r.status_code == 200
        return r

    def test_unauthenticated_get_is_401(self, client):
        assert client.get("/api/drafts/new").status_code == 401

    def test_missing_draft_is_404(self, client):
        self._signup(client)
        assert client.get("/api/drafts/new").status_code == 404

    def test_put_get_delete_roundtrip(self, client):
        self._signup(client)
        payload = {"title": "Half-written", "body": "typing..."}
        r = client.put("/api/drafts/new", json=payload)
        assert r.status_code == 200
        assert r.json()["payload"] == payload
        assert r.json()["updated_at"]

        r = client.get("/api/drafts/new")
        assert r.status_code == 200
        assert r.json()["payload"]["title"] == "Half-written"

        assert client.delete("/api/drafts/new").status_code == 200
        assert client.get("/api/drafts/new").status_code == 404

    def test_edit_draft_key_with_slashes(self, client):
        """Regression: entry-path keys contain slashes and must route correctly."""
        self._signup(client)
        key = "/workspace/DailyMoodJournal/entries/alice/2026/09/2026-09-28_0000.enc"
        r = client.put(f"/api/drafts/{key}", json={"title": "edit draft"})
        assert r.status_code == 200

        r = client.get(f"/api/drafts/{key}")
        assert r.status_code == 200
        assert r.json()["key"] == key
        assert r.json()["payload"] == {"title": "edit draft"}

        assert client.delete(f"/api/drafts/{key}").status_code == 200

    def test_new_and_edit_drafts_are_independent(self, client):
        self._signup(client)
        client.put("/api/drafts/new", json={"title": "draft A"})
        client.put("/api/drafts/x/y/z.enc", json={"title": "draft B"})
        assert client.get("/api/drafts/new").json()["payload"]["title"] == "draft A"
        assert client.get("/api/drafts/x/y/z.enc").json()["payload"]["title"] == "draft B"
        client.delete("/api/drafts/new")
        assert client.get("/api/drafts/new").status_code == 404
        assert client.get("/api/drafts/x/y/z.enc").status_code == 200

    def test_drafts_do_not_leak_between_users(self, client):
        self._signup(client, username="alice")
        client.put("/api/drafts/new", json={"title": "alice's"})
        client.post("/api/auth/logout")
        self._signup(client, username="bob")
        assert client.get("/api/drafts/new").status_code == 404
