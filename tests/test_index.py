"""Tests for backend.index — SQLite metadata index."""

import json
import os
from datetime import date
from backend.index import (
    init_index,
    is_index_available,
    rebuild_index,
    add_to_index,
    update_in_index,
    remove_from_index,
    query_entries,
    get_entry_metadata,
    get_all_tags,
    get_index_stats,
)
from backend.entry_crud import create_entry, update_entry, delete_entry
from backend.utils import list_user_entries


class TestIndexInit:
    def test_init_creates_db(self, isolated_data_dir):
        assert not is_index_available()
        init_index()
        assert is_index_available()

    def test_init_is_idempotent(self, isolated_data_dir):
        init_index()
        init_index()  # second call should not fail
        assert is_index_available()


class TestRebuildIndex:
    def test_rebuild_populates_index(self, isolated_data_dir, user_key):
        create_entry("alice", {"title": "A", "date": "2025-01-01T10:00:00", "mood": 3, "tags": ["Work"], "body": ""}, user_key)
        create_entry("alice", {"title": "B", "date": "2025-06-01T10:00:00", "mood": 5, "tags": ["Happy"], "body": ""}, user_key)

        rebuild_index("alice", user_key)
        stats = get_index_stats("alice")
        assert stats["indexed"] == 2

    def test_rebuild_clears_old_data(self, isolated_data_dir, user_key):
        create_entry("alice", {"title": "A", "date": "2025-01-01T10:00:00", "mood": 3, "tags": [], "body": ""}, user_key)
        rebuild_index("alice", user_key)
        assert get_index_stats("alice")["indexed"] == 1

        # Delete the entry and rebuild
        for p in list_user_entries("alice"):
            os.remove(p)
        rebuild_index("alice", user_key)
        assert get_index_stats("alice")["indexed"] == 0

    def test_rebuild_with_no_entries(self, isolated_data_dir, user_key):
        rebuild_index("alice", user_key)
        assert get_index_stats("alice")["indexed"] == 0


class TestAddToIndex:
    def test_add_entry(self, isolated_data_dir):
        init_index()
        add_to_index("alice", {"title": "T", "date": "2025-03-15 10:00", "mood": 4, "tags": ["A"]}, "/path/to/entry.enc")
        stats = get_index_stats("alice")
        assert stats["indexed"] == 1

    def test_add_with_iso_date(self, isolated_data_dir):
        init_index()
        add_to_index("alice", {"title": "T", "date": "2025-03-15T10:00:00", "mood": 4, "tags": []}, "/path.enc")
        meta = get_entry_metadata("/path.enc")
        assert meta is not None
        assert meta["date"] == "2025-03-15"
        assert meta["year"] == 2025
        assert meta["month"] == 3


class TestUpdateInIndex:
    def test_update_changes_metadata(self, isolated_data_dir):
        init_index()
        add_to_index("alice", {"title": "Old", "date": "2025-01-01 10:00", "mood": 2, "tags": []}, "/path.enc")
        update_in_index({"title": "New", "date": "2025-06-01 10:00", "mood": 5, "tags": ["Happy"]}, "/path.enc")
        meta = get_entry_metadata("/path.enc")
        assert meta["title"] == "New"
        assert meta["mood"] == 5
        assert meta["tags"] == ["Happy"]
        assert meta["date"] == "2025-06-01"


class TestRemoveFromIndex:
    def test_remove_entry(self, isolated_data_dir):
        init_index()
        add_to_index("alice", {"title": "T", "date": "2025-01-01 10:00", "mood": 3, "tags": []}, "/path.enc")
        assert get_entry_metadata("/path.enc") is not None
        remove_from_index("/path.enc")
        assert get_entry_metadata("/path.enc") is None


class TestQueryEntries:
    def _populate(self):
        init_index()
        add_to_index("alice", {"title": "A", "date": "2025-01-15 10:00", "mood": 2, "tags": ["Work"]}, "/a.enc")
        add_to_index("alice", {"title": "B", "date": "2025-03-20 14:00", "mood": 5, "tags": ["Happy", "Work"]}, "/b.enc")
        add_to_index("alice", {"title": "C", "date": "2025-06-01 08:00", "mood": 6, "tags": ["Excited"]}, "/c.enc")
        add_to_index("bob", {"title": "D", "date": "2025-01-01 10:00", "mood": 1, "tags": []}, "/d.enc")

    def test_query_all(self, isolated_data_dir):
        self._populate()
        results = query_entries("alice")
        assert len(results) == 3

    def test_query_by_year_month(self, isolated_data_dir):
        self._populate()
        results = query_entries("alice", year=2025, month=3)
        assert len(results) == 1
        assert results[0]["title"] == "B"

    def test_query_by_date_range(self, isolated_data_dir):
        self._populate()
        results = query_entries("alice", date_from=date(2025, 2, 1), date_to=date(2025, 12, 31))
        assert len(results) == 2

    def test_query_by_tags(self, isolated_data_dir):
        self._populate()
        results = query_entries("alice", tags=["Work"])
        assert len(results) == 2

    def test_query_by_multiple_tags(self, isolated_data_dir):
        self._populate()
        # Must match ALL tags
        results = query_entries("alice", tags=["Work", "Happy"])
        assert len(results) == 1
        assert results[0]["title"] == "B"

    def test_query_user_isolation(self, isolated_data_dir):
        self._populate()
        bob_results = query_entries("bob")
        assert len(bob_results) == 1
        assert bob_results[0]["title"] == "D"

    def test_query_empty_user(self, isolated_data_dir):
        self._populate()
        results = query_entries("nobody")
        assert len(results) == 0

    def test_query_no_index(self, isolated_data_dir):
        results = query_entries("alice")
        assert results == []


class TestGetAllTags:
    def test_collects_tags(self, isolated_data_dir):
        init_index()
        add_to_index("alice", {"title": "A", "date": "2025-01-01 10:00", "mood": 3, "tags": ["Work", "Happy"]}, "/a.enc")
        add_to_index("alice", {"title": "B", "date": "2025-02-01 10:00", "mood": 2, "tags": ["Sad", "Work"]}, "/b.enc")
        tags = get_all_tags("alice")
        assert "Work" in tags
        assert "Happy" in tags
        assert "Sad" in tags
        assert tags == sorted(tags)

    def test_empty_user(self, isolated_data_dir):
        init_index()
        assert get_all_tags("nobody") == []


class TestIndexIntegration:
    """Test that CRUD operations automatically update the index."""

    def test_create_updates_index(self, isolated_data_dir, user_key):
        create_entry("alice", {"title": "T", "date": "2025-03-15T10:00:00", "mood": 4, "tags": ["A"], "body": ""}, user_key)
        results = query_entries("alice")
        assert len(results) == 1
        assert results[0]["title"] == "T"

    def test_update_updates_index(self, isolated_data_dir, user_key):
        path = create_entry("alice", {"title": "Old", "date": "2025-03-15T10:00:00", "mood": 2, "tags": [], "body": ""}, user_key)
        update_entry(path, {"title": "New", "date": "2025-03-15T10:00:00", "mood": 5, "tags": ["Happy"], "body": "updated"}, user_key)
        results = query_entries("alice")
        assert len(results) == 1
        assert results[0]["title"] == "New"
        assert results[0]["mood"] == 5

    def test_delete_updates_index(self, isolated_data_dir, user_key):
        path = create_entry("alice", {"title": "T", "date": "2025-03-15T10:00:00", "mood": 3, "tags": [], "body": ""}, user_key)
        assert len(query_entries("alice")) == 1
        delete_entry(path)
        assert len(query_entries("alice")) == 0

    def test_multiple_entries_indexed(self, isolated_data_dir, user_key):
        create_entry("alice", {"title": "A", "date": "2025-01-01T10:00:00", "mood": 2, "tags": [], "body": ""}, user_key)
        create_entry("alice", {"title": "B", "date": "2025-06-01T10:00:00", "mood": 5, "tags": [], "body": ""}, user_key)
        create_entry("alice", {"title": "C", "date": "2025-03-15T10:00:00", "mood": 4, "tags": [], "body": ""}, user_key)
        results = query_entries("alice", year=2025, month=3)
        assert len(results) == 1
        assert results[0]["title"] == "C"
