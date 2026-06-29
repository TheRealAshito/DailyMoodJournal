from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from datetime import date, datetime
from backend.export_import import build_export_archive, build_pdf_export, process_import_files
from backend.routers.auth import _get_session
from backend.config import get_user_settings, EXPORT_NAMES

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("")
def export_entries(request: Request, format: str = Query("tar.gz", pattern=r"^(tar\.gz|zip)$")):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    data = build_export_archive(session["username"], format, session["user_key"])
    if data is None:
        raise HTTPException(404, "No entries to export")

    ext = "tar.gz" if format == "tar.gz" else "zip"
    mime = "application/gzip" if format == "tar.gz" else "application/zip"
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    settings = get_user_settings(session["username"])
    lang = settings.get("language", "en")
    base_name = EXPORT_NAMES.get(lang, EXPORT_NAMES["en"])["export"]
    return Response(
        content=data,
        media_type=mime,
        headers={"Content-Disposition": f"attachment; filename={base_name}_{session['username']}_{ts}.{ext}"},
    )


@router.get("/pdf")
def export_pdf(request: Request, from_date: str = Query(""), to_date: str = Query("")):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    try:
        date_from = date.fromisoformat(from_date) if from_date else date.min
    except ValueError:
        date_from = date.min
    try:
        date_to = date.fromisoformat(to_date) if to_date else date.max
    except ValueError:
        date_to = date.max

    data = build_pdf_export(session["username"], session["user_key"], date_from, date_to)
    if data is None:
        raise HTTPException(404, "No entries to export")

    settings = get_user_settings(session["username"])
    lang = settings.get("language", "en")
    base_name = EXPORT_NAMES.get(lang, EXPORT_NAMES["en"])["journal"]
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={base_name}_{session['username']}.pdf"},
    )


@router.post("/import")
async def import_entries(request: Request, files: list[UploadFile] = File(...)):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    result = process_import_files(session["username"], files, session["user_key"])
    return result
