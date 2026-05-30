"""User profile routes — view and update own profile."""
from __future__ import annotations

import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.models.all_models import ChatMessage, Payment, SubscriptionPlan, UserAccount
from app.api.deps import get_current_user
from app.utils.file_upload import save_user_avatar

router = APIRouter()


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class DeleteAccountRequest(BaseModel):
    password: str


@router.get("/me")
async def get_profile(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == current_user.plan_id).first()
    total_messages = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id, ChatMessage.sender == "user").count()
    payments = (
        db.query(Payment)
        .filter(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "id": current_user.id,
        "user_id": current_user.user_id,
        "name": current_user.name,
        "email": current_user.email or current_user.user_id,
        "avatar_url": current_user.avatar_url,
        "plan": {
            "name": plan.plan_name if plan else "free",
            "display_name": plan.display_name if plan else "Free",
            "monthly_credits": plan.monthly_credits if plan else 50,
            "is_unlimited": plan.is_unlimited if plan else False,
        },
        "credits_remaining": current_user.credits_remaining,
        "is_unlimited": current_user.is_unlimited,
        "credits_reset_at": current_user.credits_reset_at,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "total_messages": total_messages,
        "recent_payments": [
            {
                "id": p.id,
                "amount": p.amount,
                "currency": p.currency,
                "status": p.status,
                "created_at": p.created_at,
            }
            for p in payments
        ],
    }


@router.put("/update")
async def update_profile(
    req: UpdateProfileRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.email and req.email != current_user.email:
        conflict = db.query(UserAccount).filter(
            UserAccount.user_id == req.email
        ).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = req.email

    if req.name is not None:
        current_user.name = req.name.strip()

    db.commit()
    return {"message": "Profile updated successfully"}


@router.put("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match")

    # Validate strength
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r"\d", req.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-]", req.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character")

    if current_user.hashed_password:
        if not verify_password(req.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.post("/upload-avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    url = await save_user_avatar(file, str(current_user.id))
    current_user.avatar_url = url
    db.commit()
    return {"avatar_url": url}


@router.delete("/delete-account")
async def delete_account(
    req: DeleteAccountRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.hashed_password or not verify_password(req.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    current_user.is_active = False
    db.commit()
    return {"message": "Account deactivated. We're sorry to see you go."}
