"""Tests for backend.export_import — export/import roundtrip."""

import io
import os
import tarfile
import zipfile
from backend.entry_crud import create_entry, get_entry
from backend.export_import import build_export_archive, build_pdf_export
from backend.utils import list_user_entries


class TestExportArchive:
    def _create_entries(self, user_key):
        entries = [
            {"title": "First", "date": "2025-01-15T10:00:00", "mood": 4, "tags": ["Happy"], "body": "Body one."},
            {"title": "Second", "date": "2025-03-20T14:30:00", "mood": 2, "tags": ["Sad"], "body": "Body two."},
            {"title": "Third", "date": "2025-06-01T08:00:00", "mood": 6, "tags": ["Excited", "Work"], "body": "Body three."},
        ]
        for e in entries:
            create_entry("alice", e, user_key)

    def test_tar_export(self, user_key):
        self._create_entries(user_key)
        data = build_export_archive("alice", "tar.gz", user_key)
        assert data is not None
        assert len(data) > 0

        buf = io.BytesIO(data)
        with tarfile.open(fileobj=buf, mode="r:gz") as tar:
            names = tar.getmembers()
            md_files = [m for m in names if m.name.endswith(".md")]
            assert len(md_files) == 3

            # Check one entry can be read and has frontmatter
            f = tar.extractfile(md_files[0])
            content = f.read().decode("utf-8")
            assert "---" in content
            assert "title:" in content

    def test_zip_export(self, user_key):
        self._create_entries(user_key)
        data = build_export_archive("alice", "zip", user_key)
        assert data is not None

        buf = io.BytesIO(data)
        with zipfile.ZipFile(buf, "r") as zf:
            names = [n for n in zf.namelist() if n.endswith(".md")]
            assert len(names) == 3

    def test_export_empty_user(self, user_key):
        data = build_export_archive("nobody", "tar.gz", user_key)
        assert data is None

    def test_export_preserves_entry_content(self, user_key):
        create_entry("alice", {
            "title": "Preserved",
            "date": "2025-05-01T12:00:00",
            "mood": 5,
            "tags": ["Test"],
            "body": "This exact body should survive export.",
        }, user_key)

        data = build_export_archive("alice", "tar.gz", user_key)
        buf = io.BytesIO(data)
        with tarfile.open(fileobj=buf, mode="r:gz") as tar:
            f = tar.extractfile(tar.getmembers()[0])
            content = f.read().decode("utf-8")
            assert "Preserved" in content
            assert "This exact body should survive export." in content
            assert "Test" in content


class TestPDFExport:
    def test_pdf_generation(self, user_key):
        create_entry("alice", {
            "title": "PDF Test",
            "date": "2025-04-01T10:00:00",
            "mood": 3,
            "tags": ["Work"],
            "body": "Some content for the PDF.",
        }, user_key)

        data = build_pdf_export("alice", user_key)
        assert data is not None
        # PDF starts with %PDF
        assert data[:4] == b"%PDF"

    def test_pdf_empty_user(self, user_key):
        data = build_pdf_export("nobody", user_key)
        assert data is None

    def test_pdf_with_date_filter(self, user_key):
        create_entry("alice", {"title": "Old", "date": "2025-01-01T10:00:00", "mood": 2, "tags": [], "body": ""}, user_key)
        create_entry("alice", {"title": "New", "date": "2025-06-01T10:00:00", "mood": 5, "tags": [], "body": ""}, user_key)

        from datetime import date
        data = build_pdf_export("alice", user_key, date_from=date(2025, 5, 1))
        assert data is not None
        # PDF should contain the new entry
        assert data[:4] == b"%PDF"

    def test_pdf_with_unicode_body(self, user_key):
        create_entry("alice", {
            "title": "Unicode",
            "date": "2025-04-01T10:00:00",
            "mood": 4,
            "tags": [],
            "body": "café résumé naïve",
        }, user_key)

        # Should not crash even with unicode
        data = build_pdf_export("alice", user_key)
        assert data is not None


class TestExportImportRoundtrip:
    """Export entries, then import them back and verify they match."""

    def _create_and_export(self, user_key):
        entries = [
            {"title": "Entry A", "date": "2025-02-10T09:00:00", "mood": 3, "tags": ["Work"], "body": "Body A."},
            {"title": "Entry B", "date": "2025-04-20T15:00:00", "mood": 5, "tags": ["Happy"], "body": "Body B."},
        ]
        for e in entries:
            create_entry("alice", e, user_key)

        return build_export_archive("alice", "tar.gz", user_key)

    def test_tar_roundtrip(self, user_key, isolated_data_dir):
        export_data = self._create_and_export(user_key)

        # Delete all original entries
        for path in list_user_entries("alice"):
            os.remove(path)
        assert list_user_entries("alice") == []

        # Import back via process_import_files
        from backend.export_import import process_import_files

        class FakeUpload:
            def __init__(self, name, data):
                self.filename = name
                self.file = io.BytesIO(data)

        result = process_import_files("alice", [FakeUpload("export.tar.gz", export_data)], user_key)
        assert result["imported"] == 2
        assert result["skipped"] == 0

        # Verify entries are readable
        entries = list_user_entries("alice")
        assert len(entries) == 2

        titles = set()
        for path in entries:
            entry = get_entry(path, user_key)
            titles.add(entry["title"])
        assert titles == {"Entry A", "Entry B"}
