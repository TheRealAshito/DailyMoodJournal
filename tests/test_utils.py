"""Tests for backend.utils — path building, text parsing, date extraction."""

from datetime import datetime
from backend.utils import (
    build_entry_path,
    list_user_entries,
    parse_entry_text,
    build_entry_text,
    extract_date_from_path,
    extract_metadata_from_path,
    get_username_from_path,
    validate_entry_data,
)


class TestBuildEntryPath:
    def test_basic_path(self, isolated_data_dir):
        dt = datetime(2025, 3, 15, 10, 30)
        path = build_entry_path("alice", dt)
        assert path.endswith("entries/alice/2025/03/2025-03-15_1030.enc")
        assert "entries" in path

    def test_padded_month(self, isolated_data_dir):
        dt = datetime(2025, 1, 5, 8, 5)
        path = build_entry_path("bob", dt)
        assert "/01/" in path
        assert "_0805.enc" in path

    def test_different_users(self, isolated_data_dir):
        dt = datetime(2025, 6, 1, 12, 0)
        p1 = build_entry_path("alice", dt)
        p2 = build_entry_path("bob", dt)
        assert p1 != p2
        assert "/alice/" in p1
        assert "/bob/" in p2


class TestEntryTextParsing:
    def test_parse_with_frontmatter(self):
        from datetime import date
        text = "---\ntitle: Hello\ndate: 2025-01-01\nmood: 4\n---\n\nBody text here."
        fm, body = parse_entry_text(text)
        assert fm["title"] == "Hello"
        # YAML auto-parses date-like strings to datetime.date objects
        assert fm["date"] == date(2025, 1, 1)
        assert fm["mood"] == 4
        assert body == "Body text here."

    def test_parse_without_frontmatter(self):
        text = "Just plain text, no frontmatter."
        fm, body = parse_entry_text(text)
        assert fm == {}
        assert body == "Just plain text, no frontmatter."

    def test_parse_empty_string(self):
        fm, body = parse_entry_text("")
        assert fm == {}
        assert body == ""

    def test_parse_with_yaml_list(self):
        text = "---\ntitle: Test\ntags:\n- Happy\n- Work\n---\n\nBody."
        fm, body = parse_entry_text(text)
        assert fm["tags"] == ["Happy", "Work"]

    def test_build_entry_text_roundtrip(self):
        fm = {"title": "Test", "date": "2025-01-01 10:00", "mood": 3, "tags": ["A"]}
        body = "The body text."
        text = build_entry_text(fm, body)

        # Should be parseable back
        fm2, body2 = parse_entry_text(text)
        assert fm2["title"] == "Test"
        assert fm2["mood"] == 3
        assert fm2["tags"] == ["A"]
        assert body2 == "The body text."

    def test_build_entry_text_excludes_body_key(self):
        fm = {"title": "T", "body": "should not appear in frontmatter"}
        text = build_entry_text(fm, "actual body")
        assert "should not appear in frontmatter" not in text.split("---")[1]

    def test_build_entry_text_handles_datetime(self):
        dt = datetime(2025, 6, 15, 14, 30)
        fm = {"title": "T", "date": dt}
        text = build_entry_text(fm, "body")
        assert "2025-06-15 14:30" in text

    def test_build_entry_text_excludes_bytes(self):
        fm = {"title": "T", "binary_data": b"should skip"}
        text = build_entry_text(fm, "body")
        assert "should skip" not in text


class TestExtractDateFromPath:
    def test_valid_path(self):
        path = "/some/path/entries/alice/2025/03/2025-03-15_1030.enc"
        dt = extract_date_from_path(path)
        assert dt is not None
        assert dt.year == 2025
        assert dt.month == 3
        assert dt.day == 15
        assert dt.hour == 10
        assert dt.minute == 30

    def test_invalid_path(self):
        assert extract_date_from_path("/some/random/file.txt") is None

    def test_no_match(self):
        assert extract_date_from_path("/entries/alice/2025/03/notadate.enc") is None


class TestExtractMetadata:
    def test_valid_metadata(self):
        path = "/entries/alice/2025/03/2025-03-15_1030.enc"
        meta = extract_metadata_from_path(path)
        assert meta is not None
        assert meta["date"] == "2025-03-15"
        assert meta["time"] == "10:30"

    def test_invalid_returns_none(self):
        assert extract_metadata_from_path("/bad/path.enc") is None


class TestGetUsernameFromPath:
    def test_extracts_username(self, isolated_data_dir):
        from backend.config import ENTRIES_DIR
        import os
        path = os.path.join(ENTRIES_DIR, "alice", "2025", "03", "file.enc")
        assert get_username_from_path(path) == "alice"


class TestListUserEntries:
    def test_empty_user(self):
        assert list_user_entries("nobody") == []

    def test_finds_enc_files(self, isolated_data_dir, user_key, sample_entry_data):
        from backend.entry_crud import create_entry
        create_entry("alice", sample_entry_data, user_key)
        entries = list_user_entries("alice")
        assert len(entries) == 1
        assert entries[0].endswith(".enc")

    def test_sorted_newest_first(self, isolated_data_dir, user_key):
        from backend.entry_crud import create_entry
        create_entry("alice", {"title": "Old", "date": "2025-01-01T10:00:00", "mood": 2, "tags": [], "body": ""}, user_key)
        create_entry("alice", {"title": "New", "date": "2025-06-01T10:00:00", "mood": 5, "tags": [], "body": ""}, user_key)
        entries = list_user_entries("alice")
        assert len(entries) == 2
        # Newest first (reverse sorted)
        assert "2025-06" in entries[0]
        assert "2025-01" in entries[1]


class TestValidateEntryData:
    def test_valid_entry(self):
        errors = validate_entry_data({"title": "Hello", "mood": 3, "date": "2025-01-01"})
        assert errors == []

    def test_missing_title(self):
        errors = validate_entry_data({"mood": 3, "date": "2025-01-01"})
        assert any("Title" in e for e in errors)

    def test_empty_title(self):
        errors = validate_entry_data({"title": "   ", "mood": 3, "date": "2025-01-01"})
        assert any("Title" in e for e in errors)

    def test_bad_mood_low(self):
        errors = validate_entry_data({"title": "T", "mood": -1, "date": "2025-01-01"})
        assert any("Mood" in e for e in errors)

    def test_bad_mood_high(self):
        errors = validate_entry_data({"title": "T", "mood": 7, "date": "2025-01-01"})
        assert any("Mood" in e for e in errors)

    def test_bad_mood_type(self):
        errors = validate_entry_data({"title": "T", "mood": "high", "date": "2025-01-01"})
        assert any("Mood" in e for e in errors)

    def test_missing_date(self):
        errors = validate_entry_data({"title": "T", "mood": 3})
        assert any("Date" in e for e in errors)
