"""HTTP endpoints for the download tool.

POST /tools/download/formats  { url }            -> available qualities
GET  /tools/download/file?url=...&quality=...    -> streams the file (attachment)
POST /tools/download/zip      { urls, quality }  -> streams a zip of several reels

Single downloads stream a file with Content-Disposition so the browser saves it.
Bulk downloads are zipped server-side (browsers block multiple auto-downloads).
Temp files are cleaned up after the response is sent.
"""

from __future__ import annotations

import os
import shutil
import tempfile
import zipfile

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from ...shared.errors import ToolError
from ...shared.ig_download import download_one, list_qualities
from .schemas import FormatsRequest, FormatsResponse, ZipRequest

router = APIRouter(prefix="/tools/download", tags=["download"])


@router.post("/formats", response_model=FormatsResponse)
async def formats(req: FormatsRequest) -> FormatsResponse:
    try:
        return FormatsResponse(**list_qualities(req.url))
    except ToolError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message) from e


@router.get("/file")
async def file(
    url: str = Query(...),
    quality: str = Query("best"),
) -> FileResponse:
    tmp = tempfile.mkdtemp(prefix="dl_")
    try:
        path, filename = download_one(url, quality, tmp)
    except ToolError as e:
        shutil.rmtree(tmp, ignore_errors=True)
        raise HTTPException(status_code=e.http_status, detail=e.message) from e
    except Exception:
        shutil.rmtree(tmp, ignore_errors=True)
        raise

    media_type = "audio/mpeg" if filename.endswith(".mp3") else "video/mp4"
    return FileResponse(
        path,
        filename=filename,
        media_type=media_type,
        background=BackgroundTask(shutil.rmtree, tmp, ignore_errors=True),
    )


@router.post("/zip")
async def zip_reels(req: ZipRequest) -> FileResponse:
    tmp = tempfile.mkdtemp(prefix="dlzip_")
    work = os.path.join(tmp, "items")
    os.makedirs(work, exist_ok=True)
    zip_path = os.path.join(tmp, "reels.zip")

    succeeded = 0
    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf:
            for url in req.urls:
                item_dir = tempfile.mkdtemp(dir=work)
                try:
                    path, filename = download_one(url, req.quality, item_dir)
                    zf.write(path, arcname=filename)
                    succeeded += 1
                except ToolError:
                    continue  # skip reels that fail; keep the rest
                finally:
                    # keep the zip entry already written; drop the raw file
                    shutil.rmtree(item_dir, ignore_errors=True)
    except Exception:
        shutil.rmtree(tmp, ignore_errors=True)
        raise

    if succeeded == 0:
        shutil.rmtree(tmp, ignore_errors=True)
        raise HTTPException(
            status_code=502,
            detail="None of the selected reels could be downloaded.",
        )

    return FileResponse(
        zip_path,
        filename="reels.zip",
        media_type="application/zip",
        background=BackgroundTask(shutil.rmtree, tmp, ignore_errors=True),
    )
