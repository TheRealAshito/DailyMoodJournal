"""Generate a PDF report of user statistics with labeled charts.

Uses matplotlib for chart generation (with value labels on bars)
and fpdf2 for PDF assembly. Charts are rendered as PNG images
and embedded in the PDF.
"""

import io
import os
import logging
from datetime import datetime

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend (no display needed)
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

from fpdf import FPDF
from backend.config import MOOD_COLORS, MOOD_LABELS, get_user_settings
from backend.export_import import FONT_PATH, _clean_pdf_text, PDF_LANG

logger = logging.getLogger(__name__)

# Mood colors as matplotlib-compatible hex strings
MOOD_HEX = {k: v for k, v in MOOD_COLORS.items()}

# Chart styling
CHART_DPI = 150
CHART_FIGWIDTH = 7.5  # inches — fits well in A4 PDF


def _make_mood_time_chart(mood_by_date: list[dict]) -> io.BytesIO:
    """Bar chart: mood over time with value labels and date labels."""
    if not mood_by_date:
        return None

    labels = [d["label"] for d in mood_by_date]
    values = [d["avg_mood"] for d in mood_by_date]
    colors = [MOOD_HEX.get(round(v), "#9e9e9e") for v in values]

    fig, ax = plt.subplots(figsize=(CHART_FIGWIDTH, 3.5))
    bars = ax.bar(range(len(labels)), values, color=colors, edgecolor="white", linewidth=0.5)

    # Value labels on each bar
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.1,
                f"{val:.1f}", ha="center", va="bottom", fontsize=8, fontweight="bold")

    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=8)
    ax.set_ylabel("Mood", fontsize=10)
    ax.set_ylim(0, 7)
    ax.yaxis.set_major_locator(mticker.MultipleLocator(1))
    ax.set_title("Mood Over Time", fontsize=12, fontweight="bold", pad=10)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", alpha=0.3)

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=CHART_DPI, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf


def _make_mood_distribution_chart(mood_distribution: list[dict]) -> io.BytesIO:
    """Bar chart: mood level distribution (0-6)."""
    if not mood_distribution:
        return None

    labels = [str(d["mood"]) for d in mood_distribution]
    values = [d["count"] for d in mood_distribution]
    colors = [MOOD_HEX.get(d["mood"], "#9e9e9e") for d in mood_distribution]

    fig, ax = plt.subplots(figsize=(CHART_FIGWIDTH, 2.5))
    bars = ax.bar(range(len(labels)), values, color=colors, edgecolor="white", linewidth=0.5)

    for bar, val in zip(bars, values):
        if val > 0:
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.3,
                    str(val), ha="center", va="bottom", fontsize=9, fontweight="bold")

    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels([f"{d['mood']}" for d in mood_distribution], fontsize=9)
    ax.set_ylabel("Count", fontsize=10)
    ax.set_title("Mood Distribution", fontsize=12, fontweight="bold", pad=10)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", alpha=0.3)

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=CHART_DPI, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf


def _make_day_of_week_chart(day_of_week_mood: list[dict]) -> io.BytesIO:
    """Bar chart: average mood by day of week."""
    if not day_of_week_mood:
        return None

    labels = [d["day"][:3] for d in day_of_week_mood]  # Mon, Tue, etc.
    values = [d["avg_mood"] for d in day_of_week_mood]
    colors = [MOOD_HEX.get(round(v), "#9e9e9e") for v in values]

    fig, ax = plt.subplots(figsize=(CHART_FIGWIDTH, 2.5))
    bars = ax.bar(range(len(labels)), values, color=colors, edgecolor="white", linewidth=0.5)

    for bar, val, d in zip(bars, values, day_of_week_mood):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.1,
                f"{val:.1f}\n({d['count']})", ha="center", va="bottom", fontsize=8)

    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel("Avg Mood", fontsize=10)
    ax.set_ylim(0, 7)
    ax.yaxis.set_major_locator(mticker.MultipleLocator(1))
    ax.set_title("Mood by Day of Week", fontsize=12, fontweight="bold", pad=10)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", alpha=0.3)

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=CHART_DPI, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf


def _make_tag_chart(tag_mood_correlation: list[dict]) -> io.BytesIO:
    """Horizontal bar chart: average mood per tag."""
    if not tag_mood_correlation:
        return None

    # Limit to top 10 tags
    data = tag_mood_correlation[:10]
    labels = [d["tag"] for d in data]
    values = [d["avg_mood"] for d in data]
    counts = [d["count"] for d in data]
    colors = [MOOD_HEX.get(round(v), "#9e9e9e") for v in values]

    fig, ax = plt.subplots(figsize=(CHART_FIGWIDTH, max(2, len(data) * 0.4)))
    y_pos = range(len(labels))
    bars = ax.barh(y_pos, values, color=colors, edgecolor="white", linewidth=0.5)

    for bar, val, cnt in zip(bars, values, counts):
        ax.text(bar.get_width() + 0.1, bar.get_y() + bar.get_height() / 2,
                f"{val:.1f} ({cnt})", va="center", fontsize=8)

    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels, fontsize=9)
    ax.set_xlabel("Avg Mood", fontsize=10)
    ax.set_xlim(0, 7.5)
    ax.xaxis.set_major_locator(mticker.MultipleLocator(1))
    ax.set_title("Mood by Tag", fontsize=12, fontweight="bold", pad=10)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="x", alpha=0.3)
    ax.invert_yaxis()

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=CHART_DPI, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf


def _make_custom_scale_chart(scale_name: str, data: list[dict]) -> io.BytesIO:
    """Bar chart: custom scale over time with value labels."""
    if not data:
        return None

    labels = [d["label"] for d in data]
    values = [d["value"] for d in data]

    fig, ax = plt.subplots(figsize=(CHART_FIGWIDTH, 2.5))
    bars = ax.bar(range(len(labels)), values, color="#06b6d4", edgecolor="white", linewidth=0.5)

    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.1,
                f"{val:.1f}", ha="center", va="bottom", fontsize=8, fontweight="bold")

    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=8)
    ax.set_ylabel(scale_name, fontsize=10)
    ax.set_title(f"Custom Scale: {scale_name}", fontsize=12, fontweight="bold", pad=10)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", alpha=0.3)

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=CHART_DPI, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf


def _init_stats_pdf() -> FPDF:
    """Create a PDF with DejaVuSans font."""
    pdf = FPDF()
    pdf.add_font("DejaVuSans", "", FONT_PATH)
    pdf.add_font("DejaVuSans", "B", FONT_PATH)
    return pdf


def build_stats_pdf(username: str, stats_data: dict) -> bytes | None:
    """Generate a PDF report from pre-computed stats data.

    Args:
        username: The user's name (shown in header)
        stats_data: The dict returned by the /api/stats endpoint

    Returns:
        PDF bytes, or None if no data
    """
    if not stats_data or stats_data.get("total_entries", 0) == 0:
        return None

    settings = get_user_settings(username)
    lang = settings.get("language", "en")
    lang_data = PDF_LANG.get(lang, PDF_LANG["en"])

    pdf = _init_stats_pdf()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Title
    pdf.set_font("DejaVuSans", "B", 20)
    pdf.cell(0, 12, _clean_pdf_text(f"{lang_data['title']} — Statistics"), align="C", new_x="LMARGIN", new_y="NEXT")

    # Subtitle
    pdf.set_font("DejaVuSans", "", 10)
    pdf.cell(0, 7, f"{lang_data['user']}: {username}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, f"{lang_data['exported']}: {datetime.now().strftime('%d/%m/%Y')}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    # Summary cards
    pdf.set_font("DejaVuSans", "B", 12)
    pdf.cell(0, 8, "Summary", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVuSans", "", 10)

    summary_items = [
        ("Total Entries", str(stats_data.get("total_entries", 0))),
        ("Average Mood", f"{stats_data.get('avg_mood', 0)}/6"),
        ("Current Streak", f"{stats_data.get('current_streak', 0)} days"),
        ("Longest Streak", f"{stats_data.get('longest_streak', 0)} days"),
    ]

    col_width = pdf.epw / 2
    for i, (label, value) in enumerate(summary_items):
        if i % 2 == 0 and i > 0:
            pdf.ln(7)
        pdf.set_font("DejaVuSans", "B", 10)
        pdf.cell(col_width * 0.5, 6, f"{label}:", new_x="RIGHT")
        pdf.set_font("DejaVuSans", "", 10)
        pdf.cell(col_width * 0.5, 6, value, new_x="RIGHT" if i % 2 == 0 else "LMARGIN",
                 new_y="NEXT" if i % 2 == 1 else "TOP")

    pdf.ln(10)

    # Charts
    charts_to_add = []

    # Mood over time
    mood_chart = _make_mood_time_chart(stats_data.get("mood_by_date", []))
    if mood_chart:
        charts_to_add.append(("Mood Over Time", mood_chart))

    # Day of week
    dow_chart = _make_day_of_week_chart(stats_data.get("day_of_week_mood", []))
    if dow_chart:
        charts_to_add.append(("Mood by Day of Week", dow_chart))

    # Mood distribution
    dist_chart = _make_mood_distribution_chart(stats_data.get("mood_distribution", []))
    if dist_chart:
        charts_to_add.append(("Mood Distribution", dist_chart))

    # Tag correlation
    tag_chart = _make_tag_chart(stats_data.get("tag_mood_correlation", []))
    if tag_chart:
        charts_to_add.append(("Mood by Tag", tag_chart))

    # Custom scales
    for scale_name, scale_data in stats_data.get("scales_by_date", {}).items():
        scale_chart = _make_custom_scale_chart(scale_name, scale_data)
        if scale_chart:
            charts_to_add.append((f"Custom Scale: {scale_name}", scale_chart))

    # Add charts to PDF (2 per page after the first page which has summary)
    for i, (title, chart_buf) in enumerate(charts_to_add):
        # Check if we need a new page (rough estimate: chart is ~3.5 inches = ~89mm)
        if pdf.get_y() > 180:  # Near bottom of page
            pdf.add_page()

        chart_buf.seek(0)
        pdf.image(chart_buf, x=pdf.l_margin, w=pdf.epw)
        pdf.ln(5)

    if not charts_to_add:
        pdf.set_font("DejaVuSans", "", 10)
        pdf.cell(0, 10, "No chart data available.", align="C")

    return bytes(pdf.output(dest="S"))
