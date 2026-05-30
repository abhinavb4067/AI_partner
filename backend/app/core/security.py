"""
Security utilities: password hashing (bcrypt) and JWT token management.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from jose import JWTError, jwt
import bcrypt
from fastapi import HTTPException, status

from app.core.config import settings

# ── Password hashing ──────────────────────────────────────────────────────────
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload["exp"] = expire
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode a JWT; raises 401 on any failure."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── Token factories ───────────────────────────────────────────────────────────
def create_user_token(user_id: str) -> str:
    """Create a JWT for a regular user. Claim key: 'sub'."""
    return create_access_token({"sub": user_id, "type": "user"})


def create_admin_token(admin_id: int) -> str:
    """Create a JWT for an admin. Claim key: 'sub_admin'."""
    return create_access_token({"sub_admin": str(admin_id), "type": "admin"})
