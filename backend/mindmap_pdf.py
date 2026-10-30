"""Render a computed mind-map layout into a PDF page.

The CLIENT computes geometry (auto-layout lives in the frontend); this module
only draws what it receives: rounded node chips with wrapped label lines,
hierarchy/cross links (bezier-flattened polylines), and radial ring outlines.
Node style mirrors the on-screen design system: soft tint fill + colored
border + dark text (guarantees contrast in print).

Page: landscape A4, escalating to A3 when the map is large enough that text
would drop below ~8pt. All user-facing text goes through PDF_LANG.
"""

from datetime import datetime

from fpdf import FPDF

from backend.export_import import _init_pdf, _clean_pdf_text, PDF_LANG, FONT_PATH

MM_PER_PT = 25.4 / 72
MIN_TEXT_PT = 8.0
HEADER_H = 26  # mm reserved for title block + legend


def _hex_rgb(value: str) -> tuple:
    v = (value or "#888888").lstrip("#")
    try:
        return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))
    except Exception:
        return (136, 136, 136)


def _tint(rgb: tuple, amount: float = 0.85) -> tuple:
    """Blend toward white — the soft chip fill used on screen."""
    return tuple(int(c + (255 - c) * amount) for c in rgb)


def _flatten_cubic(p0, p1, p2, p3, steps: int = 20) -> list:
    pts = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def build_mindmap_pdf(map_doc: dict, layout: dict, lang: str = "en") -> bytes:
    lang_data = PDF_LANG.get(lang, PDF_LANG["en"])
    nodes = layout.get("nodes") or []
    links = layout.get("links") or []
    rings = layout.get("rings") or []
    lw = float(layout.get("width") or 800)
    lh = float(layout.get("height") or 600)

    # Page choice: A4 landscape, escalate to A3 if text would be tiny
    for fmt in ("A4", "A3"):
        pdf = FPDF(orientation="L", format=fmt)
        pdf.add_font("DejaVuSans", "", FONT_PATH)
        pdf.add_font("DejaVuSans", "B", FONT_PATH)
        page_w, page_h = pdf.w, pdf.h
        avail_w = page_w - 20
        avail_h = page_h - 12 - HEADER_H
        scale = min(avail_w / max(lw, 1), avail_h / max(lh, 1))
        sample = [n for n in nodes if n.get("lines")]
        if not sample or sample[0].get("h", 20) * scale * MM_PER_PT >= MIN_TEXT_PT or fmt == "A3":
            break

    pdf.set_auto_page_break(False)
    pdf.add_page()

    # ----- header block -----
    pdf.set_font("DejaVuSans", "B", 16)
    pdf.set_text_color(45, 36, 32)
    title = _clean_pdf_text(map_doc.get("title", "") or lang_data["title"])
    pdf.cell(0, 9, title, new_x="LMARGIN", new_y="NEXT")

    kind_key = "map_kind_radial" if map_doc.get("kind") == "radial" else "map_kind_mindmap"
    pdf.set_font("DejaVuSans", "", 9)
    pdf.set_text_color(130, 115, 100)
    now_str = datetime.now().strftime(lang_data.get("date_fmt", "%d/%m/%Y %H:%M"))
    meta = (
        f"{lang_data[kind_key]}  ·  {lang_data['exported']}: {now_str}"
        f"  ·  {lang_data['map_nodes']}: {len(nodes)}"
        f"  ·  {lang_data['map_links']}: {len(links)}"
    )
    pdf.cell(0, 6, _clean_pdf_text(meta), new_x="LMARGIN", new_y="NEXT")

    # tier legend (classic mind maps only — Mindly radial carries hierarchy
    # in size and shade)
    tiers = {}
    if map_doc.get("kind") != "radial":
        for n in nodes:
            t = int(n.get("tier", 0))
            tiers.setdefault(t, _hex_rgb(n.get("color")))
    if tiers:
        x, y = 10, pdf.get_y() + 1.5
        for t in sorted(tiers):
            r, g, b = tiers[t]
            pdf.set_fill_color(*_tint((r, g, b)))
            pdf.set_draw_color(r, g, b)
            pdf.ellipse(x, y, 3.2, 3.2, style="DF")
            pdf.set_xy(x + 4, y - 0.6)
            pdf.set_font("DejaVuSans", "", 8)
            pdf.set_text_color(90, 78, 66)
            pdf.cell(14, 4.4, _clean_pdf_text(f"{lang_data['map_tier']} T{t}"))
            x += 22
        pdf.set_y(y + 7)
    else:
        pdf.set_y(pdf.get_y() + 3)

    pdf.set_draw_color(*_hex_rgb("#e0d6c8"))
    pdf.line(10, pdf.get_y() - 2, page_w - 10, pdf.get_y() - 2)

    # ----- map area: map layout px -> page mm, centered -----
    origin_x = 10 + (avail_w - lw * scale) / 2
    origin_y = 12 + HEADER_H + (avail_h - lh * scale) / 2

    def map_x(px): return origin_x + px * scale
    def map_y(px): return origin_y + px * scale

    # radial rings (behind everything)
    if rings:
        root = next((n for n in nodes if int(n.get("tier", 1)) == 0), None)
        if root:
            cx, cy = float(root.get("x", lw / 2)), float(root.get("y", lh / 2))
            for ring in rings:
                r = float(ring.get("r", 0)) * scale
                rc = _hex_rgb(ring.get("color"))
                pdf.set_draw_color(*_tint(rc, 0.55))
                pdf.set_line_width(0.25)
                pdf.ellipse(map_x(cx) - r, map_y(cy) - r, r * 2, r * 2, style="D")

    # links first (under nodes)
    pdf.set_line_width(0.35)
    for l in links:
        pts = _flatten_cubic(
            (map_x(float(l.get("x1", 0))), map_y(float(l.get("y1", 0)))),
            (map_x(float(l.get("cx1", l.get("x1", 0)))), map_y(float(l.get("cy1", l.get("y1", 0))))),
            (map_x(float(l.get("cx2", l.get("x2", 0)))), map_y(float(l.get("cy2", l.get("y2", 0))))),
            (map_x(float(l.get("x2", 0))), map_y(float(l.get("y2", 0)))),
        )
        if l.get("dashed"):
            pdf.set_draw_color(*_hex_rgb("#b4a392"))
            pdf.set_dash_pattern(dash=1.6, gap=1.4)
        else:
            pdf.set_draw_color(*_hex_rgb("#8a7b6d"))
            pdf.set_dash_pattern()
        pdf.polyline(pts)
    pdf.set_dash_pattern()

    # nodes
    for n in nodes:
        x, y = map_x(float(n.get("x", 0))), map_y(float(n.get("y", 0)))
        w, h = float(n.get("w", 10)) * scale, float(n.get("h", 10)) * scale
        base = _hex_rgb(n.get("color"))
        lines = [str(x) for x in (n.get("lines") or [])] or [_clean_pdf_text(str(n.get("label", "")))]
        n_lines = max(len(lines), 1)
        if n.get("shape") == "circle":
            # Mindly style: flat circle, contrast text, no border
            pdf.set_fill_color(*base)
            pdf.set_draw_color(*base)
            pdf.ellipse(x, y, w, h, style="F")
            line_h = h / (n_lines + 0.6)
            fs_px = float(n.get("fs") or max(9, min(18, min(w, h) / (2 * scale) * 0.38)))
            fs = int(round(max(5, min(13, fs_px * scale / MM_PER_PT))))
            pdf.set_font("DejaVuSans", "", fs)
            tc = _hex_rgb(n.get("text_color") or "#ffffff")
            pdf.set_text_color(*tc)
            ty = y + h / 2 - (n_lines * line_h) / 2
            for ln in lines:
                pdf.set_xy(x, ty)
                pdf.cell(w, line_h, _clean_pdf_text(ln), align="C")
                ty += line_h
            continue
        pdf.set_fill_color(*_tint(base))
        pdf.set_draw_color(*base)
        pdf.set_line_width(0.45)
        radius = min(h / 2, 2.2)
        pdf.rect(x, y, w, h, style="DF", round_corners=True, corner_radius=radius)
        line_h = h / (n_lines + 0.6)
        pdf.set_font("DejaVuSans", "", int(round(max(6, min(11, line_h * 0.72 / MM_PER_PT)))))
        pdf.set_text_color(45, 36, 32)
        ty = y + h / 2 - (n_lines * line_h) / 2
        for ln in lines:
            pdf.set_xy(x, ty)
            pdf.cell(w, line_h, _clean_pdf_text(ln), align="C")
            ty += line_h

    return bytes(pdf.output(dest="S"))
