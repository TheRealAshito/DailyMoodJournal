"""Generate a PDF report of user statistics with labeled charts.

Charts are drawn as native PDF vector primitives via fpdf2 (bars, grid
lines, value labels) — no matplotlib, no PNG rasterization. This keeps the
Docker image free of the numpy/Pillow/fonttools toolchain (≈37MB of
downloads) and produces crisper, smaller output.

The five chart types (mood over time, mood distribution, day-of-week,
tag correlation, custom scales) are bar charts that share one generic
drawer; every chart function draws onto the FPDF at (x, y) and returns the
height it consumed in mm (0 when there is no data).
"""

import logging

from fpdf import FPDF
from backend.config import MOOD_COLORS, get_user_settings
from backend.export_import import FONT_PATH, _clean_pdf_text, PDF_LANG, _fmt_date_only

logger = logging.getLogger(__name__)

# Chart styling (mm)
CHART_W_LABEL = 13.0   # left gutter for y tick labels
H_BAR_ROW = 5.5        # row height of horizontal bar charts
LABEL_EVERY_MM = 9.0   # min x-label slot before we show every other label


def _hex_rgb(value: str) -> tuple:
    v = (value or "#9e9e9e").lstrip("#")
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


def _draw_chart_title(pdf: FPDF, x: float, y: float, w: float, title: str, ylabel: str) -> float:
    """Bold title + small gray axis caption. Returns content top y."""
    pdf.set_font("DejaVuSans", "B", 11)
    pdf.set_text_color(45, 36, 32)
    pdf.set_xy(x, y)
    pdf.cell(w, 6, _clean_pdf_text(title), align="L")
    if ylabel:
        pdf.set_font("DejaVuSans", "", 7)
        pdf.set_text_color(130, 115, 100)
        pdf.set_xy(x, y + 5.5)
        pdf.cell(w, 4, _clean_pdf_text(ylabel), align="L")
    return y + 11.0


def _draw_vbars(
    pdf: FPDF, x: float, y: float, w: float, h: float,
    title: str, ylabel: str, labels: list, values: list, colors: list,
    value_labels: list, y_max: float,
) -> float:
    """Vertical bar chart. h = total height incl. title/axis areas."""
    top = _draw_chart_title(pdf, x, y, w, title, ylabel)
    px = x + CHART_W_LABEL
    py = top
    pw = w - CHART_W_LABEL - 2
    ph = max(10.0, h - (top - y) - 12.0)  # 12mm for x labels below
    if not labels or ph <= 0:
        return h

    y_max = max(y_max, 1e-6)
    # grid + y ticks: prefer integer-ish ticks (1, 2, 5…) over raw fifths
    step = 1.0
    for cand in (1, 2, 2.5, 5, 10, 20):
        if y_max / cand <= 7:
            step = cand
            break
    else:
        step = y_max / 5
    ticks = int(y_max // step)
    pdf.set_line_width(0.15)
    for i in range(ticks + 1):
        v = step * i
        gy = py + ph - (v / y_max) * ph
        pdf.set_draw_color(222, 216, 206)
        pdf.line(px, gy, px + pw, gy)
        pdf.set_font("DejaVuSans", "", 7)
        pdf.set_text_color(130, 115, 100)
        pdf.set_xy(x, gy - 2)
        pdf.cell(CHART_W_LABEL - 1.5, 4, f"{v:g}", align="R")
    # axes
    pdf.set_draw_color(150, 140, 128)
    pdf.set_line_width(0.25)
    pdf.line(px, py, px, py + ph)
    pdf.line(px, py + ph, px + pw, py + ph)

    n = len(labels)
    slot = pw / n
    bar_w = max(0.8, slot * 0.68)
    for i, (lab, val, col, vlab) in enumerate(zip(labels, values, colors, value_labels)):
        bh = max(0.0, (val / y_max) * ph)
        bx = px + i * slot + (slot - bar_w) / 2
        # bar with white separator edge
        pdf.set_fill_color(*col)
        pdf.set_draw_color(255, 255, 255)
        pdf.set_line_width(0.2)
        if bh > 0:
            pdf.rect(bx, py + ph - bh, bar_w, bh, style="DF")
        # value label above bar
        if vlab:
            pdf.set_font("DejaVuSans", "B", 7)
            pdf.set_text_color(90, 78, 66)
            pdf.set_xy(bx - 3, py + ph - bh - 4.4)
            pdf.cell(bar_w + 6, 4, _clean_pdf_text(vlab), align="C")
        # x label (every other when slots get tight)
        if slot >= LABEL_EVERY_MM or i % 2 == 0:
            pdf.set_font("DejaVuSans", "", 7)
            pdf.set_text_color(110, 98, 86)
            pdf.set_xy(px + i * slot - 3, py + ph + 1.2)
            pdf.cell(slot + 6, 4, _clean_pdf_text(str(lab)), align="C")
    return h


def _draw_hbars(
    pdf: FPDF, x: float, y: float, w: float,
    title: str, xlabel: str, rows: list,
) -> float:
    """Horizontal bar chart; rows = [(label, value, count, color)]."""
    h = len(rows) * H_BAR_ROW + 18.0
    top = _draw_chart_title(pdf, x, y, w, title, xlabel)
    label_w = 34.0
    px = x + label_w
    py = top
    pw = w - label_w - 20.0
    ph = len(rows) * H_BAR_ROW + 2.0
    x_max = 7.5

    pdf.set_line_width(0.15)
    for i in range(6):
        v = x_max * i / 5
        gx = px + (v / x_max) * pw
        pdf.set_draw_color(222, 216, 206)
        pdf.line(gx, py, gx, py + ph)
        pdf.set_font("DejaVuSans", "", 7)
        pdf.set_text_color(130, 115, 100)
        pdf.set_xy(gx - 4, py + ph + 0.8)
        pdf.cell(8, 4, f"{v:g}", align="C")

    for i, (lab, val, cnt, col) in enumerate(rows):
        ry = py + i * H_BAR_ROW
        bh = H_BAR_ROW - 1.6
        bw = max(0.4, (val / x_max) * pw)
        pdf.set_fill_color(*col)
        pdf.set_draw_color(255, 255, 255)
        pdf.set_line_width(0.2)
        pdf.rect(px, ry + 0.8, bw, bh, style="DF")
        pdf.set_font("DejaVuSans", "", 8)
        pdf.set_text_color(90, 78, 66)
        pdf.set_xy(x, ry + 1.1)
        pdf.cell(label_w - 2, 4, _clean_pdf_text(str(lab)), align="R")
        pdf.set_xy(px + bw + 1, ry + 1.1)
        pdf.cell(19, 4, _clean_pdf_text(f"{val:.1f} ({cnt})"), align="L")
    return h


# ---------- chart types ----------

def _mood_color(value: float) -> tuple:
    return _hex_rgb(MOOD_COLORS.get(round(value), "#9e9e9e"))


def _draw_mood_time(pdf: FPDF, x: float, y: float, w: float, data: list, lang_data: dict) -> float:
    """Bar chart: mood over time with value labels and date labels."""
    if not data:
        return 0.0
    labels = [d["label"] for d in data]
    values = [d["avg_mood"] for d in data]
    colors = [_mood_color(v) for v in values]
    vlabels = [f"{v:.1f}" for v in values]
    return _draw_vbars(pdf, x, y, w, 89.0,
                       lang_data["chart_mood_time"], lang_data["chart_y_mood"],
                       labels, values, colors, vlabels, y_max=7)


def _draw_mood_distribution(pdf: FPDF, x: float, y: float, w: float, data: list, lang_data: dict) -> float:
    """Bar chart: mood level distribution (0-6)."""
    if not data:
        return 0.0
    labels = [str(d["mood"]) for d in data]
    values = [d["count"] for d in data]
    colors = [_hex_rgb(MOOD_COLORS.get(d["mood"], "#9e9e9e")) for d in data]
    vlabels = [str(v) if v > 0 else "" for v in values]
    y_max = max(values) + 1 if values else 1
    return _draw_vbars(pdf, x, y, w, 64.0,
                       lang_data["chart_mood_dist"], lang_data["chart_y_count"],
                       labels, values, colors, vlabels, y_max=y_max)


def _draw_day_of_week(pdf: FPDF, x: float, y: float, w: float, data: list, lang_data: dict) -> float:
    """Bar chart: average mood by day of week."""
    if not data:
        return 0.0
    labels = [d["day"][:3] for d in data]
    values = [d["avg_mood"] for d in data]
    colors = [_mood_color(v) for v in values]
    vlabels = [f"{v:.1f} ({d['count']})" for v, d in zip(values, data)]
    return _draw_vbars(pdf, x, y, w, 64.0,
                       lang_data["chart_day_of_week"], lang_data["chart_y_avg"],
                       labels, values, colors, vlabels, y_max=7)


def _draw_tag(pdf: FPDF, x: float, y: float, w: float, data: list, lang_data: dict) -> float:
    """Horizontal bar chart: average mood per tag (top 10)."""
    if not data:
        return 0.0
    rows = [
        (d["tag"], d["avg_mood"], d["count"], _mood_color(d["avg_mood"]))
        for d in data[:10]
    ]
    return _draw_hbars(pdf, x, y, w,
                       lang_data["chart_mood_tag"], lang_data["chart_y_avg"], rows)


def _draw_custom_scale(pdf: FPDF, x: float, y: float, w: float, data: list, lang_data: dict, scale_name: str = "") -> float:
    """Bar chart: custom scale over time with value labels."""
    if not data:
        return 0.0
    labels = [d["label"] for d in data]
    values = [d["value"] for d in data]
    colors = [_hex_rgb("#06b6d4") for _ in values]
    vlabels = [f"{v:.1f}" for v in values]
    y_max = (max(values) if values else 1) * 1.3 + 1
    return _draw_vbars(pdf, x, y, w, 64.0,
                       f"{lang_data['chart_custom_scale']}: {scale_name}", "",
                       labels, values, colors, vlabels, y_max=y_max)


# Back-compat aliases (older name pattern)
_make_mood_time_chart = _draw_mood_time
_make_mood_distribution_chart = _draw_mood_distribution
_make_day_of_week_chart = _draw_day_of_week
_make_tag_chart = _draw_tag
_make_custom_scale_chart = _draw_custom_scale


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
    date_format = settings.get("date_format")
    lang_data = PDF_LANG.get(lang, PDF_LANG["en"])

    pdf = _init_stats_pdf()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Title
    pdf.set_font("DejaVuSans", "B", 20)
    pdf.cell(0, 12, _clean_pdf_text(f"{lang_data['title']} — {lang_data['stats_suffix']}"), align="C", new_x="LMARGIN", new_y="NEXT")

    # Subtitle
    pdf.set_font("DejaVuSans", "", 10)
    pdf.cell(0, 7, f"{lang_data['user']}: {username}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, f"{lang_data['exported']}: {_fmt_date_only(date_format)}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    # Summary cards
    pdf.set_font("DejaVuSans", "B", 12)
    pdf.cell(0, 8, lang_data["summary"], new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVuSans", "", 10)

    summary_items = [
        (lang_data["total_entries"], str(stats_data.get("total_entries", 0))),
        (lang_data["avg_mood"], f"{stats_data.get('avg_mood', 0)}/6"),
        (lang_data["current_streak"], f"{stats_data.get('current_streak', 0)} {lang_data['days']}"),
        (lang_data["longest_streak"], f"{stats_data.get('longest_streak', 0)} {lang_data['days']}"),
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

    # Charts — each draw fn returns its height (0 = no data)
    draw_jobs = [
        (_draw_mood_time, stats_data.get("mood_by_date", []), 89.0, None),
        (_draw_day_of_week, stats_data.get("day_of_week_mood", []), 64.0, None),
        (_draw_mood_distribution, stats_data.get("mood_distribution", []), 64.0, None),
        (_draw_tag, stats_data.get("tag_mood_correlation", []), None, None),
    ]
    for scale_name, scale_data in (stats_data.get("scales_by_date") or {}).items():
        draw_jobs.append((_draw_custom_scale, scale_data, 64.0, scale_name))

    charts_drawn = 0
    for fn, data, fixed_h, extra in draw_jobs:
        if not data:
            continue
        est_h = fixed_h if fixed_h else min(len(data), 10) * H_BAR_ROW + 18.0
        if pdf.get_y() > 297 - 20 - est_h:
            pdf.add_page()
        args = (pdf, pdf.l_margin, pdf.get_y(), pdf.epw, data, lang_data)
        used = fn(*args, extra) if extra else fn(*args)
        if used:
            charts_drawn += 1
            pdf.set_y(pdf.get_y() + used + 4)

    if not charts_drawn:
        pdf.set_font("DejaVuSans", "", 10)
        pdf.cell(0, 10, lang_data["no_chart_data"], align="C")

    return bytes(pdf.output(dest="S"))
