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
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


async def save_character_photo(file: UploadFile) -> str:
    """Save a character profile photo. Returns the public URL path."""
    return await _save_image(file, settings.characters_folder, "characters")


async def save_user_avatar(file: UploadFile, user_id: str) -> str:
    """Save a user avatar (overwrite if exists). Returns the public URL path."""
    # Use a deterministic filename so old files are replaced
    folder = settings.avatars_folder
    ext = _get_extension(file.content_type)
    filename = f"{user_id}{ext}"
    return await _write_file(file, folder, filename, "avatars")


async def _save_image(file: UploadFile, folder: str, url_prefix: str) -> str:
    ext = _get_extension(file.content_type)
    filename = f"{uuid.uuid4().hex}{ext}"
    return await _write_file(file, folder, filename, url_prefix)


async def _write_file(file: UploadFile, folder: str, filename: str, url_prefix: str) -> str:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Use: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 5 MB.",
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
    }
    return mapping.get(content_type, ".jpg")
