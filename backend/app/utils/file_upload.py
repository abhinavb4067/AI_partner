"""
File upload utilities for character photos and user avatars.
Saves files to the media/ directory served as static files.
"""
from __future__ import annotations

import os
import uuid
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024 # 50 MB


async def save_character_photo(file: UploadFile) -> str:
    """Save a character profile photo. Returns the public URL path."""
    return await _save_image(file, settings.characters_folder, "characters")

async def save_character_post(file: UploadFile) -> tuple[str, str]:
    """Save a character post (image or video). Returns (public URL path, media_type)."""
    if file.content_type in ALLOWED_VIDEO_TYPES:
        return await _save_media(file, settings.posts_folder, "posts", MAX_VIDEO_SIZE), "video"
    elif file.content_type in ALLOWED_IMAGE_TYPES:
        return await _save_media(file, settings.posts_folder, "posts", MAX_FILE_SIZE), "image"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed.",
        )


async def save_user_avatar(file: UploadFile, user_id: str) -> str:
    """Save a user avatar (overwrite if exists). Returns the public URL path."""
    # Use a deterministic filename so old files are replaced
    folder = settings.avatars_folder
    ext = _get_extension(file.content_type)
    filename = f"{user_id}{ext}"
    return await _write_file(file, folder, filename, "avatars")


async def _save_image(file: UploadFile, folder: str, url_prefix: str) -> str:
    return await _save_media(file, folder, url_prefix, MAX_FILE_SIZE)

async def _save_media(file: UploadFile, folder: str, url_prefix: str, max_size: int) -> str:
    ext = _get_extension(file.content_type)
    filename = f"{uuid.uuid4().hex}{ext}"
    return await _write_file(file, folder, filename, url_prefix, max_size)


async def _write_file(file: UploadFile, folder: str, filename: str, url_prefix: str, max_size: int = MAX_FILE_SIZE) -> str:
    if file.content_type not in ALLOWED_IMAGE_TYPES and file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Use images or videos.",
        )

    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {max_size // (1024*1024)} MB.",
        )

    os.makedirs(folder, exist_ok=True)
    dest = os.path.join(folder, filename)
    with open(dest, "wb") as f:
        f.write(contents)

    return f"/media/{url_prefix}/{filename}"


def _get_extension(content_type: str) -> str:
    mapping = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/quicktime": ".mov",
    }
    return mapping.get(content_type, ".jpg")
