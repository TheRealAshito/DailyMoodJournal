"""Tests for backend.freewrite_pdf — free write PDF generation."""

from backend.freewrite_pdf import build_freewrite_pdf


SAMPLE_SESSIONS = [
    {
        "id": "abc123",
        "title": "Morning Thoughts",
        "content": "Today I woke up feeling grateful.\nThe sun was shining through the window.\n\nI thought about my goals for the week.",
        "created_at": "2025-03-15T08:00:00",
        "updated_at": "2025-03-15T08:30:00",
    },
    {
        "id": "def456",
        "title": "Evening Reflection",
        "content": "What a productive day!\nI finished the project and had a great conversation with a friend.",
        "created_at": "2025-03-15T20:00:00",
        "updated_at": "2025-03-15T20:45:00",
    },
]


class TestFreewritePDF:
    def test_single_session(self):
        data = build_freewrite_pdf("alice", [SAMPLE_SESSIONS[0]])
        assert data is not None
        assert data[:4] == b"%PDF"
        assert len(data) > 1000

    def test_multiple_sessions(self):
        data = build_freewrite_pdf("alice", SAMPLE_SESSIONS)
        assert data is not None
        assert data[:4] == b"%PDF"
        # Multiple sessions should produce a bigger PDF
        single = build_freewrite_pdf("alice", [SAMPLE_SESSIONS[0]])
        assert len(data) > len(single)

    def test_empty_sessions(self):
        data = build_freewrite_pdf("alice", [])
        assert data is None

    def test_empty_content(self):
        sessions = [{"title": "Empty", "content": "", "created_at": "2025-01-01", "updated_at": "2025-01-01"}]
        data = build_freewrite_pdf("alice", sessions)
        assert data is not None
        assert data[:4] == b"%PDF"

    def test_unicode_content(self):
        sessions = [{"title": "Unicode", "content": "café résumé naïve 日本語", "created_at": "2025-01-01", "updated_at": "2025-01-01"}]
        data = build_freewrite_pdf("alice", sessions)
        assert data is not None
        assert data[:4] == b"%PDF"
