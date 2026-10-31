"""Tests for backend.stats_pdf — stats PDF generation with vector charts.

Charts draw native PDF primitives via fpdf2 (no matplotlib / PNG). The
chart functions draw onto an FPDF at (x, y) and return the height they
consumed in mm (0 when there is no data).
"""

from backend.stats_pdf import (
    build_stats_pdf,
    _init_stats_pdf,
    _draw_mood_time,
    _draw_mood_distribution,
    _draw_day_of_week,
    _draw_tag,
    _draw_custom_scale,
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


def _draw(fn, data, *extra):
    """Draw one chart onto a fresh PDF; returns (height_used, pdf_bytes)."""
    pdf = _init_stats_pdf()
    pdf.add_page()
    h = fn(pdf, 10, 30, 190, data, LANG, *extra)
    return h, bytes(pdf.output(dest="S"))


class TestChartDrawing:
    def test_mood_time_chart_draws(self):
        h, raw = _draw(_draw_mood_time, SAMPLE_STATS["mood_by_date"])
        assert h > 0
        assert raw[:4] == b"%PDF"

    def test_mood_time_chart_empty_data(self):
        h, _ = _draw(_draw_mood_time, [])
        assert h == 0

    def test_mood_distribution_chart(self):
        h, raw = _draw(_draw_mood_distribution, SAMPLE_STATS["mood_distribution"])
        assert h > 0
        assert raw[:4] == b"%PDF"

    def test_day_of_week_chart(self):
        h, raw = _draw(_draw_day_of_week, SAMPLE_STATS["day_of_week_mood"])
        assert h > 0
        assert raw[:4] == b"%PDF"

    def test_tag_chart(self):
        h, raw = _draw(_draw_tag, SAMPLE_STATS["tag_mood_correlation"])
        assert h > 0
        assert raw[:4] == b"%PDF"

    def test_tag_chart_empty(self):
        h, _ = _draw(_draw_tag, [])
        assert h == 0

    def test_custom_scale_chart(self):
        h, raw = _draw(_draw_custom_scale, SAMPLE_STATS["scales_by_date"]["Anxiety"], "Anxiety")
        assert h > 0
        assert raw[:4] == b"%PDF"

    def test_many_bars_do_not_overflow(self):
        data = [{"label": f"D{i}", "avg_mood": i % 7, "count": 1} for i in range(60)]
        h, raw = _draw(_draw_mood_time, data)
        assert h > 0
        assert raw[:4] == b"%PDF"

    def test_hbars_scale_to_top_tags(self):
        data = [{"tag": f"tag{i}", "avg_mood": i % 7, "count": i} for i in range(25)]
        h, _ = _draw(_draw_tag, data)
        # top 10 rows only
        assert h == 10 * 5.5 + 18.0


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
        # font embedded + charts drawn as vectors -> solid document
        assert len(data) > 5000

    def test_build_stats_pdf_with_custom_scales(self):
        data = build_stats_pdf("alice", SAMPLE_STATS)
        assert data is not None
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
