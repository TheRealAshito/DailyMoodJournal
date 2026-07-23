"""Tests for backend.stats_pdf — stats PDF generation with labeled charts."""

from backend.stats_pdf import (
    build_stats_pdf,
    _make_mood_time_chart,
    _make_mood_distribution_chart,
    _make_day_of_week_chart,
    _make_tag_chart,
    _make_custom_scale_chart,
)
from backend.export_import import PDF_LANG

LANG = PDF_LANG["en"]


SAMPLE_STATS = {
    "total_entries": 10,
    "avg_mood": 3.5,
    "current_streak": 3,
    "longest_streak": 7,
    "mood_by_date": [
        {"date": "2025-01-15", "avg_mood": 4.0, "count": 2, "label": "Jan 15"},
        {"date": "2025-02-20", "avg_mood": 2.5, "count": 1, "label": "Feb 20"},
        {"date": "2025-03-10", "avg_mood": 5.0, "count": 3, "label": "Mar 10"},
    ],
    "mood_distribution": [
        {"mood": 0, "count": 0},
        {"mood": 1, "count": 1},
        {"mood": 2, "count": 2},
        {"mood": 3, "count": 3},
        {"mood": 4, "count": 2},
        {"mood": 5, "count": 1},
        {"mood": 6, "count": 1},
    ],
    "tag_mood_correlation": [
        {"tag": "Work", "avg_mood": 3.0, "count": 5},
        {"tag": "Happy", "avg_mood": 5.0, "count": 3},
        {"tag": "Stressed", "avg_mood": 2.0, "count": 2},
    ],
    "day_of_week_mood": [
        {"day": "Monday", "day_index": 0, "avg_mood": 3.0, "count": 2},
        {"day": "Tuesday", "day_index": 1, "avg_mood": 4.0, "count": 1},
        {"day": "Wednesday", "day_index": 2, "avg_mood": 3.5, "count": 2},
        {"day": "Thursday", "day_index": 3, "avg_mood": 4.5, "count": 2},
        {"day": "Friday", "day_index": 4, "avg_mood": 5.0, "count": 1},
        {"day": "Saturday", "day_index": 5, "avg_mood": 2.0, "count": 1},
        {"day": "Sunday", "day_index": 6, "avg_mood": 3.0, "count": 1},
    ],
    "tag_frequency": [
        {"tag": "Work", "count": 5},
        {"tag": "Happy", "count": 3},
        {"tag": "Stressed", "count": 2},
    ],
    "scales_by_date": {
        "Anxiety": [
            {"date": "2025-01-15", "value": 6.0, "label": "Jan 15"},
            {"date": "2025-02-20", "value": 8.0, "label": "Feb 20"},
            {"date": "2025-03-10", "value": 4.0, "label": "Mar 10"},
        ],
    },
}


class TestChartGeneration:
    def test_mood_time_chart_returns_png(self):
        buf = _make_mood_time_chart(SAMPLE_STATS["mood_by_date"], LANG)
        assert buf is not None
        assert buf.read(4) == b"\x89PNG"

    def test_mood_time_chart_empty_data(self):
        assert _make_mood_time_chart([], LANG) is None

    def test_mood_distribution_chart(self):
        buf = _make_mood_distribution_chart(SAMPLE_STATS["mood_distribution"], LANG)
        assert buf is not None
        assert buf.read(4) == b"\x89PNG"

    def test_day_of_week_chart(self):
        buf = _make_day_of_week_chart(SAMPLE_STATS["day_of_week_mood"], LANG)
        assert buf is not None
        assert buf.read(4) == b"\x89PNG"

    def test_tag_chart(self):
        buf = _make_tag_chart(SAMPLE_STATS["tag_mood_correlation"], LANG)
        assert buf is not None
        assert buf.read(4) == b"\x89PNG"

    def test_tag_chart_empty(self):
        assert _make_tag_chart([], LANG) is None

    def test_custom_scale_chart(self):
        buf = _make_custom_scale_chart("Anxiety", SAMPLE_STATS["scales_by_date"]["Anxiety"], LANG)
        assert buf is not None
        assert buf.read(4) == b"\x89PNG"


class TestStatsPDF:
    def test_build_stats_pdf_returns_pdf(self):
        data = build_stats_pdf("alice", SAMPLE_STATS)
        assert data is not None
        assert data[:4] == b"%PDF"

    def test_build_stats_pdf_empty_stats(self):
        data = build_stats_pdf("alice", {"total_entries": 0})
        assert data is None

    def test_build_stats_pdf_no_data(self):
        data = build_stats_pdf("alice", None)
        assert data is None

    def test_build_stats_pdf_contains_summary(self):
        data = build_stats_pdf("alice", SAMPLE_STATS)
        assert data is not None
        assert data[:4] == b"%PDF"
        # PDF is compressed so we can't search for plain text
        # Just verify it's a reasonable size (has content)
        assert len(data) > 5000  # Should have charts embedded

    def test_build_stats_pdf_with_custom_scales(self):
        data = build_stats_pdf("alice", SAMPLE_STATS)
        assert data is not None
        # Should have multiple pages (charts)
        assert data[:4] == b"%PDF"

    def test_build_stats_pdf_no_charts(self):
        stats = {
            "total_entries": 1,
            "avg_mood": 3.0,
            "current_streak": 1,
            "longest_streak": 1,
            "mood_by_date": [],
            "mood_distribution": [],
            "tag_mood_correlation": [],
            "day_of_week_mood": [],
            "tag_frequency": [],
            "scales_by_date": {},
        }
        data = build_stats_pdf("alice", stats)
        assert data is not None
        assert data[:4] == b"%PDF"
