"""Generate a PDF from Free Write sessions."""

import os
import logging
from datetime import datetime

from fpdf import FPDF
from backend.export_import import FONT_PATH, _clean_pdf_text, PDF_LANG
from backend.config import get_user_settings

logger = logging.getLogger(__name__)


def _init_freewrite_pdf() -> FPDF:
    pdf = FPDF()
    pdf.add_font("DejaVuSans", "", FONT_PATH)
    pdf.add_font("DejaVuSans", "B", FONT_PATH)
    return pdf


def build_freewrite_pdf(username: str, sessions: list[dict]) -> bytes | None:
    """Generate a PDF from a list of free write sessions.

    Args:
        username: The user's name (shown in header)
        sessions: List of dicts with keys: title, content, created_at, updated_at

    Returns:
        PDF bytes, or None if no sessions
    """
    if not sessions:
        return None

    settings = get_user_settings(username)
    lang = settings.get("language", "en")
    lang_data = PDF_LANG.get(lang, PDF_LANG["en"])

    pdf = _init_freewrite_pdf()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Title page
    pdf.set_font("DejaVuSans", "B", 22)
    pdf.cell(0, 12, _clean_pdf_text(f"{lang_data['title']} — {lang_data['fw_suffix']}"), align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVuSans", "", 10)
    pdf.cell(0, 7, f"{lang_data['user']}: {username}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, f"{lang_data['exported']}: {datetime.now().strftime('%d/%m/%Y')}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, f"{lang_data['entries']}: {len(sessions)}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    for i, session in enumerate(sessions):
        if i > 0:
            pdf.add_page()

        title = session.get("title", lang_data["fw_untitled"])
        content = session.get("content", "")
        updated = session.get("updated_at", "")

        # Header bar
        pdf.set_fill_color(6, 182, 212)  # cyan-500
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("DejaVuSans", "B", 14)
        pdf.cell(0, 10, f"  {_clean_pdf_text(title)}", fill=True, new_x="LMARGIN", new_y="NEXT")

        # Date
        pdf.set_text_color(100, 100, 100)
        pdf.set_font("DejaVuSans", "", 9)
        if updated:
            try:
                dt = datetime.fromisoformat(updated)
                pdf.cell(0, 5, f"  {lang_data['fw_last_updated']}: {dt.strftime('%d/%m/%Y %H:%M')}", new_x="LMARGIN", new_y="NEXT")
            except (ValueError, TypeError):
                pass

        pdf.ln(3)

        # Content
        pdf.set_text_color(40, 40, 40)
        pdf.set_font("DejaVuSans", "", 10)
        for line in content.split("\n"):
            line = _clean_pdf_text(line.strip())
            if not line:
                pdf.ln(3)
                continue
            pdf.multi_cell(0, 5, line)
            pdf.x = pdf.l_margin

    return bytes(pdf.output(dest="S"))
