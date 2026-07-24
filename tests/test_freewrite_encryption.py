"""Tests for freewrite encryption and migration."""

import json
import os
import pytest
from backend.routers.freewrite import (
    _load_sessions,
    _save_sessions,
    _sessions_path,
    _legacy_sessions_path,
    migrate_freewrite,
)
from backend.crypto import generate_user_key


SAMPLE_SESSIONS = [
    {
        "id": "abc123",
        "title": "Morning Thoughts",
        "content": "Today I woke up feeling grateful.",
        "created_at": "2025-03-15T08:00:00",
        "updated_at": "2025-03-15T08:30:00",
    },
    {
        "id": "def456",
        "title": "Evening Reflection",
        "content": "What a productive day!",
        "created_at": "2025-03-15T20:00:00",
        "updated_at": "2025-03-15T20:45:00",
    },
]


@pytest.fixture
def user_key():
    return generate_user_key()


@pytest.fixture
def isolated_freewrite(monkeypatch, tmp_path):
    """Redirect freewrite file operations to a temp directory."""
    monkeypatch.setattr("backend.routers.freewrite.DATA_DIR", str(tmp_path))
    return tmp_path


class TestEncryptedFreewrite:
    def test_save_and_load_roundtrip(self, isolated_freewrite, user_key):
        _save_sessions("alice", SAMPLE_SESSIONS, user_key)
        loaded = _load_sessions("alice", user_key)
        assert len(loaded) == 2
        assert loaded[0]["id"] == "abc123"
        assert loaded[0]["title"] == "Morning Thoughts"
        assert loaded[1]["content"] == "What a productive day!"

    def test_encrypted_file_exists(self, isolated_freewrite, user_key):
        _save_sessions("alice", SAMPLE_SESSIONS, user_key)
        enc_path = _sessions_path("alice")
        assert os.path.exists(enc_path)
        assert enc_path.endswith("_freewrite.enc")

    def test_encrypted_file_is_binary(self, isolated_freewrite, user_key):
        _save_sessions("alice", SAMPLE_SESSIONS, user_key)
        enc_path = _sessions_path("alice")
        with open(enc_path, "rb") as f:
            data = f.read()
        # Should NOT be parseable as JSON (it's encrypted binary)
        with pytest.raises((json.JSONDecodeError, UnicodeDecodeError)):
            json.loads(data)

    def test_load_empty_when_no_file(self, isolated_freewrite, user_key):
        loaded = _load_sessions("nonexistent", user_key)
        assert loaded == []

    def test_load_returns_empty_on_wrong_key(self, isolated_freewrite, user_key):
        _save_sessions("alice", SAMPLE_SESSIONS, user_key)
        wrong_key = generate_user_key()
        loaded = _load_sessions("alice", wrong_key)
        assert loaded == []

    def test_empty_sessions(self, isolated_freewrite, user_key):
        _save_sessions("alice", [], user_key)
        loaded = _load_sessions("alice", user_key)
        assert loaded == []

    def test_unicode_content(self, isolated_freewrite, user_key):
        sessions = [{"id": "x", "title": "Café résumé 日本語", "content": "olá mundo", "created_at": "", "updated_at": ""}]
        _save_sessions("alice", sessions, user_key)
        loaded = _load_sessions("alice", user_key)
        assert loaded[0]["title"] == "Café résumé 日本語"


class TestFreewriteMigration:
    def test_migrate_plaintext_to_encrypted(self, isolated_freewrite, user_key, tmp_path):
        """Write a plaintext .json file, migrate it, verify encrypted .enc exists."""
        legacy_path = _legacy_sessions_path("alice")
        enc_path = _sessions_path("alice")

        # Write plaintext legacy file
        with open(legacy_path, "w", encoding="utf-8") as f:
            json.dump(SAMPLE_SESSIONS, f)

        assert os.path.exists(legacy_path)
        assert not os.path.exists(enc_path)

        # Migrate
        result = migrate_freewrite("alice", user_key)
        assert result is True

        # Legacy file should be deleted
        assert not os.path.exists(legacy_path)
        # Encrypted file should exist
        assert os.path.exists(enc_path)

        # Content should be readable and match
        loaded = _load_sessions("alice", user_key)
        assert len(loaded) == 2
        assert loaded[0]["title"] == "Morning Thoughts"

    def test_migrate_skips_when_no_legacy(self, isolated_freewrite, user_key):
        """No legacy file = no migration."""
        result = migrate_freewrite("alice", user_key)
        assert result is False

    def test_migrate_deletes_stale_legacy_when_enc_exists(self, isolated_freewrite, user_key, tmp_path):
        """If both .enc and .json exist, delete the stale .json."""
        # Save encrypted version
        _save_sessions("alice", SAMPLE_SESSIONS, user_key)

        # Also create a stale legacy file
        legacy_path = _legacy_sessions_path("alice")
        with open(legacy_path, "w") as f:
            json.dump([{"id": "stale"}], f)

        assert os.path.exists(legacy_path)
        assert os.path.exists(_sessions_path("alice"))

        result = migrate_freewrite("alice", user_key)
        assert result is False  # No actual migration needed

        # Legacy should be cleaned up
        assert not os.path.exists(legacy_path)
        # Encrypted file should still exist with original data
        loaded = _load_sessions("alice", user_key)
        assert len(loaded) == 2

    def test_migrate_empty_sessions(self, isolated_freewrite, user_key, tmp_path):
        """Migrate an empty sessions list."""
        legacy_path = _legacy_sessions_path("alice")
        with open(legacy_path, "w") as f:
            json.dump([], f)

        result = migrate_freewrite("alice", user_key)
        assert result is True

        loaded = _load_sessions("alice", user_key)
        assert loaded == []

    def test_migrate_rejects_non_list(self, isolated_freewrite, user_key, tmp_path):
        """Legacy file with non-list content should not be migrated."""
        legacy_path = _legacy_sessions_path("alice")
        with open(legacy_path, "w") as f:
            json.dump({"not": "a list"}, f)

        result = migrate_freewrite("alice", user_key)
        assert result is False
        # Legacy file should still exist (not migrated)
        assert os.path.exists(legacy_path)
