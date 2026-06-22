from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from datetime import datetime
from backend.export_import import build_export_archive, process_import_files
from backend.routers.auth import _get_session

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
    return Response(
        content=data,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename=dailymood_export_{session["username"]}_{ts}.{ext}'},
    )


@router.post("/import")
async def import_entries(request: Request, files: list[UploadFile] = File(...)):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")

    imported, skipped = process_import_files(session["username"], files, session["user_key"])
    return {"imported": imported, "skipped": skipped}
