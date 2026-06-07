"""User auth routes — register, login, /me."""
from __future__ import annotations

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_user_token, create_reset_token, verify_reset_token
from app.models.all_models import SubscriptionPlan, UserAccount
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, GoogleLoginRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.api.deps import get_current_user
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from app.core.config import settings

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # Check duplicate
    if db.query(UserAccount).filter(UserAccount.user_id == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    free_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_name == "free").first()
    monthly_credits = free_plan.monthly_credits if free_plan else 50

    user = UserAccount(
        user_id=req.email,
        email=req.email,
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
    user = db.query(UserAccount).filter(UserAccount.user_id == req.email).first()

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
        client_id = getattr(settings, "GOOGLE_CLIENT_ID", None)
        idinfo = id_token.verify_oauth2_token(req.credential, google_requests.Request(), client_id)
        email = idinfo['email']
        name = idinfo.get('name', '')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Google token")

    user = db.query(UserAccount).filter(UserAccount.user_id == email).first()
    if not user:
        free_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_name == "free").first()
        monthly_credits = free_plan.monthly_credits if free_plan else 50
        
        user = UserAccount(
            user_id=email,
            email=email,
            name=name,
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

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(UserAccount).filter(UserAccount.user_id == req.email).first()
    if not user:
        return {"message": "If that email is in our system, we sent a reset link."}
    
    token = create_reset_token(user.user_id)
    print(f"\n\n--- PASSWORD RESET LINK (Testing) ---\nhttp://localhost:5173/reset-password?token={token}\n--------------------------------------\n\n")
    return {"message": "If that email is in our system, we sent a reset link."}

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = verify_reset_token(req.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
    user = db.query(UserAccount).filter(UserAccount.user_id == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"message": "Password has been reset successfully"}


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