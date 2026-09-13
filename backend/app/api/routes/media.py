"""
Authenticated, ownership-checked serving of AI-companion chat-generated photos.

Chat images are saved to disk at media/<char_name>/<sanitized_user_id>/<file>.jpg
(see ImageService._get_local_path). That folder layout used to be reachable
through the public `/media` static mount with no auth check at all — folder
names are predictable (character name + the user's own email, sanitized), so
anyone could enumerate/guess another user's private, often explicit, generated
photos. This route replaces that: it requires a valid JWT and only serves the
file back if the sanitized segment matches the *calling* user's own id.

Public, non-sensitive media (character marketing photos, user avatars, posts)
is unaffected — those keep coming from the plain static `/media` mount in
main.py, which only ever sees 2-segment paths (e.g. /media/avatars/x.jpg);
this route claims exactly the 3-segment /media/<char>/<user>/<file> shape and
must be registered BEFORE the static mount so it wins that match first.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.all_models import UserAccount

router = APIRouter()

MEDIA_ROOT = os.path.abspath("media")

# Browsers don't let a plain <img src="..."> attach an Authorization header,
# so this route also accepts the JWT as a ?token= query param — the same
# trade-off already made for the human-chat WebSocket (main.py). It's still
# verified exactly like a normal Bearer token; only the transport differs.
_optional_bearer = HTTPBearer(auto_error=False)


def _sanitize(name: str) -> str:
    """Must mirror ImageService._get_local_path's sanitization exactly, or
    ownership checks below would never match a legitimately-owned file."""
    return "".join(c for c in name if c.isalnum() or c in " _-.@").strip().replace(" ", "_")


def _resolve_user(
    credentials: HTTPAuthorizationCredentials | None,
    token_qs: str | None,
    db: Session,
) -> UserAccount:
    raw_token = credentials.credentials if credentials else token_qs
    if not raw_token:
        raise HTTPException(status_code=404, detail="Not found")

    try:
        payload = decode_token(raw_token)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Not found")

    if payload.get("type") != "user":
        raise HTTPException(status_code=404, detail="Not found")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=404, detail="Not found")

    user = db.query(UserAccount).filter(
        (UserAccount.user_id == user_id) | (UserAccount.id == user_id) | (UserAccount.email == user_id)
    ).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="Not found")

    token_sv = payload.get("sv")
    if token_sv is not None and user.session_version is not None and token_sv != user.session_version:
        raise HTTPException(status_code=404, detail="Not found")

    return user


@router.get("/{char_name}/{user_name}/{filename}")
async def get_chat_image(
    char_name: str,
    user_name: str,
    filename: str,
    token: str | None = Query(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
    db: Session = Depends(get_db),
):
    current_user = _resolve_user(credentials, token, db)

    # Ownership check: the path's user segment must match the caller's own
    # (sanitized) user_id — nobody can fetch another user's generated photos
    # by guessing/enumerating character+email combinations. 404 (not 403) so
    # this also doesn't confirm/deny whether a given file exists at all.
    if user_name != _sanitize(current_user.user_id):
        raise HTTPException(status_code=404, detail="Not found")

    # Reject any path-traversal attempt and confirm the resolved path is still
    # inside media/ before touching the filesystem.
    candidate = os.path.abspath(os.path.join(MEDIA_ROOT, char_name, user_name, filename))
    if os.path.commonpath([candidate, MEDIA_ROOT]) != MEDIA_ROOT:
        raise HTTPException(status_code=404, detail="Not found")

    if not os.path.isfile(candidate):
        raise HTTPException(status_code=404, detail="Not found")

    return FileResponse(candidate)
