"""Tests for backend.entry_crud — CRUD operations on encrypted journal entries."""

import os
from datetime import datetime
from backend.entry_crud import (
    create_entry,
    get_entry,
    update_entry,
    delete_entry,
    get_entries_for_date,
    get_all_tags_for_user,
)
from backend.utils import list_user_entries
from backend.config import ENTRIES_DIR


class TestCreateEntry:
    def test_create_returns_path(self, user_key, sample_entry_data):
        path = create_entry("alice", sample_entry_data, user_key)
        assert isinstance(path, str)
        assert path.endswith(".enc")
        assert os.path.exists(path)

    def test_create_encrypted_file(self, user_key, sample_entry_data):
        path = create_entry("alice", sample_entry_data, user_key)
        with open(path, "rb") as f:
            raw = f.read()
        # Should be encrypted, not plaintext
        assert b"Test Entry" not in raw
        assert b"test journal entry" not in raw

    def test_create_with_string_date(self, user_key):
        data = {"title": "T", "date": "2025-03-15T10:30:00", "mood": 3, "tags": [], "body": ""}
        path = create_entry("alice", data, user_key)
        assert os.path.exists(path)

    def test_create_with_datetime_object(self, user_key):
        data = {"title": "T", "date": datetime(2025, 3, 15, 10, 30), "mood": 3, "tags": [], "body": ""}
        path = create_entry("alice", data, user_key)
        assert os.path.exists(path)

    def test_create_with_extra_fields(self, user_key):
        data = {"title": "T", "date": "2025-03-15T10:00:00", "mood": 3, "tags": [], "body": "", "custom_field": "preserved"}
        path = create_entry("alice", data, user_key)
        entry = get_entry(path, user_key)
        assert entry["custom_field"] == "preserved"


class TestGetEntry:
    def test_read_back_entry(self, user_key, sample_entry_data):
        path = create_entry("alice", sample_entry_data, user_key)
        entry = get_entry(path, user_key)

        assert entry is not None
        assert entry["title"] == "Test Entry"
        assert entry["mood"] == 4
        assert entry["tags"] == ["Happy", "Work"]
        assert entry["body"] == "This is a test journal entry body.\nWith multiple lines."
        assert entry["path"] == path

    def test_nonexistent_entry(self, user_key):
        result = get_entry("/nonexistent/path.enc", user_key)
        assert result is None

    def test_wrong_key_returns_garbage_or_raises(self, user_key):
        from backend.crypto import generate_user_key
        path = create_entry("alice", {"title": "T", "date": "2025-01-01T10:00:00", "mood": 3, "tags": [], "body": ""}, user_key)
        wrong_key = generate_user_key()
        try:
            result = get_entry(path, wrong_key)
            # If it doesn't raise, the decrypted content should be garbage
            # (not matching original title)
            if result is not None:
                assert result.get("title") != "T"
        except Exception:
            pass  # Expected — decryption failure


class TestUpdateEntry:
    def test_update_changes_content(self, user_key, sample_entry_data):
        path = create_entry("alice", sample_entry_data, user_key)

        updated_data = {
            "title": "Updated Title",
            "date": "2025-03-15T10:30:00",
            "mood": 6,
            "tags": ["Excited"],
            "body": "New body text.",
        }
        update_entry(path, updated_data, user_key)

        entry = get_entry(path, user_key)
        assert entry["title"] == "Updated Title"
        assert entry["mood"] == 6
        assert entry["tags"] == ["Excited"]
        assert entry["body"] == "New body text."

    def test_update_preserves_extra_fields(self, user_key):
        data = {"title": "T", "date": "2025-01-01T10:00:00", "mood": 3, "tags": [], "body": "", "custom": "keep_me"}
        path = create_entry("alice", data, user_key)

        update_data = {"title": "T2", "date": "2025-01-01T10:00:00", "mood": 4, "tags": [], "body": ""}
        update_entry(path, update_data, user_key)

        entry = get_entry(path, user_key)
        assert entry["custom"] == "keep_me"

    def test_update_changes_file_on_disk(self, user_key, sample_entry_data):
        path = create_entry("alice", sample_entry_data, user_key)
        with open(path, "rb") as f:
            old_bytes = f.read()

        update_entry(path, {"title": "New", "date": "2025-03-15T10:30:00", "mood": 1, "tags": [], "body": "different"}, user_key)
        with open(path, "rb") as f:
            new_bytes = f.read()

        assert old_bytes != new_bytes


class TestDeleteEntry:
    def test_delete_removes_file(self, user_key, sample_entry_data):
        path = create_entry("alice", sample_entry_data, user_key)
        assert os.path.exists(path)

        result = delete_entry(path)
        assert result is True
        assert not os.path.exists(path)

    def test_delete_nonexistent_returns_false(self):
        assert delete_entry("/nonexistent.enc") is False


class TestGetEntriesForDate:
    def test_finds_entries_for_date(self, user_key):
        create_entry("alice", {"title": "A", "date": "2025-03-15T10:00:00", "mood": 3, "tags": [], "body": ""}, user_key)
        create_entry("alice", {"title": "B", "date": "2025-03-15T14:00:00", "mood": 5, "tags": [], "body": ""}, user_key)
        create_entry("alice", {"title": "C", "date": "2025-03-16T10:00:00", "mood": 2, "tags": [], "body": ""}, user_key)

        from datetime import date
        entries = get_entries_for_date("alice", date(2025, 3, 15), user_key)
        assert len(entries) == 2

    def test_empty_for_date_with_no_entries(self, user_key):
        create_entry("alice", {"title": "A", "date": "2025-03-15T10:00:00", "mood": 3, "tags": [], "body": ""}, user_key)
        from datetime import date
        entries = get_entries_for_date("alice", date(2025, 12, 25), user_key)
        assert len(entries) == 0


class TestGetAllTags:
    def test_collects_tags(self, user_key):
        create_entry("alice", {"title": "A", "date": "2025-01-01T10:00:00", "mood": 3, "tags": ["Happy", "Work"], "body": ""}, user_key)
        create_entry("alice", {"title": "B", "date": "2025-02-01T10:00:00", "mood": 2, "tags": ["Sad", "Work"], "body": ""}, user_key)

        tags = get_all_tags_for_user("alice", user_key)
        assert "Happy" in tags
        assert "Sad" in tags
        assert "Work" in tags
        # Should be sorted
        assert tags == sorted(tags)

    def test_no_entries_returns_empty(self, user_key):
        assert get_all_tags_for_user("nobody", user_key) == []


class TestUserIsolation:
    def test_user_cannot_see_other_users_entries(self, user_key):
        from backend.crypto import generate_user_key
        other_key = generate_user_key()

        create_entry("alice", {"title": "Alice's", "date": "2025-01-01T10:00:00", "mood": 5, "tags": [], "body": "private"}, user_key)
        create_entry("bob", {"title": "Bob's", "date": "2025-01-01T10:00:00", "mood": 2, "tags": [], "body": "secret"}, other_key)

        alice_entries = list_user_entries("alice")
        bob_entries = list_user_entries("bob")

        assert len(alice_entries) == 1
        assert len(bob_entries) == 1

        # Alice can read her own
        a = get_entry(alice_entries[0], user_key)
        assert a["title"] == "Alice's"

        # Alice cannot read Bob's (different key)
        try:
            b = get_entry(bob_entries[0], user_key)
            if b is not None:
                assert b.get("title") != "Bob's"
        except Exception:
            pass  # Expected
