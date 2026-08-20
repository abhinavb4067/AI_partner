"""User auth routes — register, login, OTP verification, forgot-password, /me."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_user_token, create_reset_token, verify_reset_token
from app.models.all_models import SubscriptionPlan, UserAccount
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegisterWithOTPRequest,
    SendRegisterOTPRequest,
    SendForgotPasswordOTPRequest,
    ResetPasswordWithOTPRequest,
    OTPResponse,
    TokenResponse,
    GoogleLoginRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.api.deps import get_current_user
from app.services.otp_service import OTPService
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from app.core.config import settings
import os

router = APIRouter()


@router.post("/send-register-otp", response_model=OTPResponse)
async def send_register_otp(req: SendRegisterOTPRequest, db: Session = Depends(get_db)):
    """Generates and sends a 5-minute email verification OTP before account creation."""
    clean_email = req.email.lower().strip()
    clean_username = req.username.lower().replace(" ", "").strip()

    # Check if duplicate email or username
    if db.query(UserAccount).filter((UserAccount.user_id == clean_email) | (UserAccount.email == clean_email)).first():
        raise HTTPException(status_code=400, detail="Email already registered. Please login instead.")

    if db.query(UserAccount).filter(UserAccount.username == clean_username).first():
        raise HTTPException(status_code=400, detail="Username already taken. Please choose another.")

    return OTPService.generate_and_send_otp(db=db, email=clean_email, purpose="register")


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterWithOTPRequest, db: Session = Depends(get_db)):
    clean_email = req.email.lower().strip()
    clean_username = req.username.lower().replace(" ", "").strip()

    # Verify OTP first
    OTPService.verify_otp(db=db, email=clean_email, otp_code=req.otp, purpose="register", consume=True)

    # Check duplicate again before insert
    if db.query(UserAccount).filter((UserAccount.user_id == clean_email) | (UserAccount.email == clean_email)).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    if db.query(UserAccount).filter(UserAccount.username == clean_username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    free_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_name == "free").first()
    monthly_credits = free_plan.monthly_credits if free_plan else 50

    user = UserAccount(
        user_id=clean_email,
        email=clean_email,
        username=clean_username,
        name=req.name,
        age=req.age,
        hashed_password=hash_password(req.password),
        plan_id=free_plan.id if free_plan else None,
        credits_remaining=monthly_credits,
        credits_reset_at=datetime.utcnow() + timedelta(days=30),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_user_token(user.user_id)
    return TokenResponse(
        access_token=token,
        user_id=user.user_id,
        name=user.name or "",
        email=user.email or user.user_id,
        plan_name=free_plan.plan_name if free_plan else "free",
        credits_remaining=user.credits_remaining,
        is_unlimited=user.is_unlimited,
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    clean_email = req.email.lower().strip()
    user = db.query(UserAccount).filter((UserAccount.user_id == clean_email) | (UserAccount.email == clean_email)).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Legacy users may have no hashed_password — treat email as temp password
    if user.hashed_password:
        if not verify_password(req.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid email or password")
    else:
        # Set password on first login for legacy users
        user.hashed_password = hash_password(req.password)
        db.commit()

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == user.plan_id).first()
    token = create_user_token(user.user_id)

    return TokenResponse(
        access_token=token,
        user_id=user.user_id,
        name=user.name or "",
        email=user.email or user.user_id,
        plan_name=plan.plan_name if plan else "free",
        credits_remaining=user.credits_remaining,
        is_unlimited=user.is_unlimited,
    )


@router.post("/google-login", response_model=TokenResponse)
async def google_login(req: GoogleLoginRequest, db: Session = Depends(get_db)):
    try:
        client_id = settings.GOOGLE_CLIENT_ID if settings.GOOGLE_CLIENT_ID else None
        idinfo = id_token.verify_oauth2_token(req.credential, google_requests.Request(), client_id)
        email = idinfo['email']
        name = idinfo.get('name', '')
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid Google token: {str(e)}")

    user = db.query(UserAccount).filter((UserAccount.user_id == email) | (UserAccount.email == email)).first()
    if not user:
        free_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_name == "free").first()
        monthly_credits = free_plan.monthly_credits if free_plan else 50
        
        import uuid
        import re
        
        clean_prefix = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0])[:20] or "user"
        username = f"{clean_prefix}_{str(uuid.uuid4())[:6]}"
        
        user = UserAccount(
            user_id=email,
            email=email,
            username=username,
            name=name or email.split('@')[0],
            age=18,
            hashed_password="", # No password for google accounts
            plan_id=free_plan.id if free_plan else None,
            credits_remaining=monthly_credits,
            credits_reset_at=datetime.utcnow() + timedelta(days=30),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == user.plan_id).first()
    token = create_user_token(user.user_id)

    return TokenResponse(
        access_token=token,
        user_id=user.user_id,
        name=user.name or "",
        email=user.email or user.user_id,
        plan_name=plan.plan_name if plan else "free",
        credits_remaining=user.credits_remaining,
        is_unlimited=user.is_unlimited,
    )


@router.post("/forgot-password", response_model=OTPResponse)
async def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    clean_email = req.email.lower().strip()
    user = db.query(UserAccount).filter((UserAccount.user_id == clean_email) | (UserAccount.email == clean_email)).first()
    if not user:
        # Don't leak user existence; return standard message with simulated countdown
        return OTPResponse(
            message="If this email is registered, a 6-digit verification code has been sent.",
            cooldown_seconds=60,
            expires_in_seconds=300
        )

    return OTPService.generate_and_send_otp(db=db, email=clean_email, purpose="forgot_password")


# Unified Reset Password Schema supporting both OTP and legacy JWT token
class UnifiedResetPasswordRequest(BaseModel):
    email: Optional[EmailStr] = None
    otp: Optional[str] = None
    token: Optional[str] = None
    new_password: str


@router.post("/reset-password")
async def reset_password(req: UnifiedResetPasswordRequest, db: Session = Depends(get_db)):
    # Method 1: Reset using 6-Digit OTP (5-minute limit)
    if req.otp and req.email:
        clean_email = req.email.lower().strip()
        OTPService.verify_otp(db=db, email=clean_email, otp_code=req.otp, purpose="forgot_password", consume=True)
        user = db.query(UserAccount).filter((UserAccount.user_id == clean_email) | (UserAccount.email == clean_email)).first()
        if not user:
            raise HTTPException(status_code=404, detail="User account not found")
        user.hashed_password = hash_password(req.new_password)
        db.commit()
        return {"message": "Password has been reset successfully. You can now log in."}

    # Method 2: Legacy token fallback
    if req.token:
        email = verify_reset_token(req.token)
        if not email:
            raise HTTPException(status_code=400, detail="Invalid or expired reset link")
        user = db.query(UserAccount).filter((UserAccount.user_id == email) | (UserAccount.email == email)).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.hashed_password = hash_password(req.new_password)
        db.commit()
        return {"message": "Password has been reset successfully. You can now log in."}

    raise HTTPException(status_code=400, detail="Email and 6-digit OTP are required to reset password.")


@router.get("/me")
async def me(current_user: UserAccount = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == current_user.plan_id).first()
    return {
        "user_id": current_user.user_id,
        "name": current_user.name,
        "email": current_user.email or current_user.user_id,
        "avatar_url": current_user.avatar_url,
        "plan_name": plan.plan_name if plan else "free",
        "credits_remaining": current_user.credits_remaining,
        "is_unlimited": current_user.is_unlimited,
        "created_at": current_user.created_at,
    }