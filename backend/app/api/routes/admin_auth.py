"""Admin-only auth routes — completely separate from user auth."""
from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_admin_token
from app.models.all_models import AdminUser
from app.schemas.auth import AdminLoginRequest, AdminTokenResponse
from app.api.deps import get_current_admin

router = APIRouter()


@router.post("/login", response_model=AdminTokenResponse)
async def admin_login(req: AdminLoginRequest, db: Session = Depends(get_db)):
    admin = db.query(AdminUser).filter(AdminUser.email == req.email).first()

    # Deliberately vague error — don't reveal which field is wrong
    if not admin or not verify_password(req.password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    if not admin.is_active:
        raise HTTPException(status_code=403, detail="Admin account is disabled")

    admin.last_login = datetime.utcnow()
    db.commit()

    token = create_admin_token(admin.id)
    return AdminTokenResponse(
        access_token=token,
        admin_id=admin.id,
        email=admin.email,
        full_name=admin.full_name,
        role=admin.role,
    )


@router.get("/me")
async def admin_me(current_admin: AdminUser = Depends(get_current_admin)):
    return {
        "id": current_admin.id,
        "email": current_admin.email,
        "full_name": current_admin.full_name,
        "role": current_admin.role,
        "last_login": current_admin.last_login,
    }
