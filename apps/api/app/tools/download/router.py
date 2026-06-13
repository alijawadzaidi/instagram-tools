"""HTTP endpoints for the download tool.

POST /tools/download/formats  { url }            -> available qualities
GET  /tools/download/file?url=...&quality=...    -> streams the file (attachment)
POST /tools/download/zip      { urls, quality }  -> streams a zip of several reels

Single downloads stream a file with Content-Disposition so the browser saves it.
Bulk downloads are zipped server-side (browsers block multiple auto-downloads).
Temp files are cleaned up after the response is sent.

Handlers are plain `def` on purpose: yt-dlp/urllib are blocking I/O, and
FastAPI runs sync handlers on its thread pool instead of stalling the event
loop. ToolError is handled globally in main.py.
"""

from __future__ import annotations

import os
import re
import shutil
import tempfile
import urllib.request
import zipfile
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from starlette.background import BackgroundTask

from app.core.auth import require_internal_key
from app.core.errors import DownloadError, NotFoundError, ToolError
from app.integrations.instagram import http

from . import service
from .schemas import (
    CoverRequest,
    CoverResponse,
    FormatsRequest,
    FormatsResponse,
    ZipRequest,
)
from .service import download_one, extract_shortcode

# Only proxy images from Instagram's own CDNs (prevents this from being an open proxy).
_ALLOWED_IMAGE_HOSTS = ("cdninstagram.com", "fbcdn.net")

router = APIRouter(
    prefix="/tools/download",
    tags=["download"],
    dependencies=[Depends(require_internal_key)],
)


@router.post("/formats", response_model=FormatsResponse)
def formats(req: FormatsRequest) -> FormatsResponse:
    return FormatsResponse(**service.list_formats(req.url))


@router.get("/file")
def file(
    url: str = Query(...),
    quality: str = Query("best"),
) -> FileResponse:
    tmp = tempfile.mkdtemp(prefix="dl_")
    try:
        path, filename = download_one(url, quality, tmp)
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


@router.post("/cover", response_model=CoverResponse)
def cover(req: CoverRequest) -> CoverResponse:
    found = service.cover_url(req.url)
    if not found:
        raise NotFoundError("Couldn't find a cover for this reel.")
    return CoverResponse(shortcode=extract_shortcode(req.url) or "", cover_url=found)


@router.get("/image")
def image(
    url: str = Query(...),
    filename: str = Query("image.jpg"),
) -> Response:
    """Stream an Instagram CDN image back as a download (covers, profile pics)."""
    host = urlparse(url).hostname or ""
    if not any(host == h or host.endswith("." + h) for h in _ALLOWED_IMAGE_HOSTS):
        raise HTTPException(status_code=400, detail="Only Instagram CDN images are allowed.")
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", filename) or "image.jpg"
    req = urllib.request.Request(url, headers={"User-Agent": http.BASE_HEADERS["User-Agent"]})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            media_type = resp.headers.get_content_type() or "image/jpeg"
    except Exception as e:
        raise DownloadError("Couldn't fetch the image.") from e
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.post("/zip")
def zip_reels(req: ZipRequest) -> FileResponse:
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
        raise DownloadError("None of the selected reels could be downloaded.")

    return FileResponse(
        zip_path,
        filename="reels.zip",
        media_type="application/zip",
        background=BackgroundTask(shutil.rmtree, tmp, ignore_errors=True),
    )
