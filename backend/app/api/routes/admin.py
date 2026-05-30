"""
Full admin CRUD routes — users, characters, plans, payments, stats.
All endpoints require a valid AdminUser JWT.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_db
from app.models.all_models import AdminUser, Character, ChatMessage, Payment, SubscriptionPlan, UserAccount
from app.schemas.admin import UpdateUserRequest, PlanUpdateRequest
from app.utils.file_upload import save_character_photo

router = APIRouter()

# ── Dashboard Stats ──────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    _: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    today = datetime.utcnow().date()
    total_users = db.query(UserAccount).count()
    active_users = db.query(UserAccount).filter(UserAccount.is_active == True).count()
    total_revenue = db.query(func.sum(Payment.amount)).filter(Payment.status == "success").scalar() or 0.0
    messages_today = db.query(ChatMessage).filter(func.date(ChatMessage.created_at) == today).count()
    new_users_today = db.query(UserAccount).filter(func.date(UserAccount.created_at) == today).count()
    active_subs = db.query(UserAccount).join(SubscriptionPlan).filter(
        SubscriptionPlan.plan_name != "free", UserAccount.is_active == True
    ).count()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_revenue": round(total_revenue, 2),
        "messages_today": messages_today,
        "new_users_today": new_users_today,
        "active_subscriptions": active_subs,
    }


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    plan: Optional[str] = None,
    _: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    q = db.query(UserAccount)
    if search:
        q = q.filter(
            (UserAccount.name.ilike(f"%{search}%")) | (UserAccount.user_id.ilike(f"%{search}%"))
        )
    if plan:
        q = q.join(SubscriptionPlan).filter(SubscriptionPlan.plan_name == plan)

    total = q.count()
    users = q.order_by(UserAccount.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    result = []
    for u in users:
        p = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == u.plan_id).first()
        msg_count = db.query(ChatMessage).filter(ChatMessage.user_id == u.id, ChatMessage.sender == "user").count()
        result.append({
            "id": u.id, "user_id": u.user_id, "name": u.name, "email": u.email or u.user_id,
            "avatar_url": u.avatar_url, "plan_name": p.plan_name if p else "free",
            "credits_remaining": u.credits_remaining, "is_unlimited": u.is_unlimited,
            "is_active": u.is_active, "created_at": u.created_at, "total_messages": msg_count,
        })

    return {"total": total, "page": page, "per_page": per_page, "users": result}


@router.get("/users/{user_id}")
async def get_user(user_id: int, _: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(UserAccount).filter(UserAccount.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == user.plan_id).first()
    payments = db.query(Payment).filter(Payment.user_id == user.id).order_by(Payment.created_at.desc()).all()
    return {
        "id": user.id, "user_id": user.user_id, "name": user.name, "email": user.email or user.user_id,
        "avatar_url": user.avatar_url, "plan_name": plan.plan_name if plan else "free",
        "credits_remaining": user.credits_remaining, "is_unlimited": user.is_unlimited,
        "is_active": user.is_active, "created_at": user.created_at,
        "payments": [{"id": p.id, "amount": p.amount, "status": p.status, "created_at": p.created_at} for p in payments],
    }


@router.put("/users/{user_id}")
async def update_user(
    user_id: int, req: UpdateUserRequest,
    _: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db),
):
    user = db.query(UserAccount).filter(UserAccount.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if req.name is not None: user.name = req.name
    if req.plan_id is not None:
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == req.plan_id).first()
        if plan:
            user.plan_id = plan.id
            if plan.is_unlimited: user.is_unlimited = True
    if req.credits_remaining is not None: user.credits_remaining = req.credits_remaining
    if req.is_unlimited is not None: user.is_unlimited = req.is_unlimited
    if req.is_active is not None: user.is_active = req.is_active

    db.commit()
    return {"message": "User updated"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, _: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(UserAccount).filter(UserAccount.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    return {"message": "User deactivated"}


# ── Characters ────────────────────────────────────────────────────────────────

@router.get("/characters")
async def list_characters(_: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    chars = db.query(Character).order_by(Character.created_at.desc()).all()
    return [
        {
            "id": c.id, "name": c.name, "slug": c.slug, "gender": c.gender,
            "age_display": c.age_display, "photo_url": c.photo_url,
            "skin_color": c.skin_color, "body_shape": c.body_shape,
            "hair_color": c.hair_color, "eye_color": c.eye_color,
            "voice_enabled": c.voice_enabled, "elevenlabs_voice_id": c.elevenlabs_voice_id,
            "is_active": c.is_active, "plan_id": c.plan_id,
            "ollama_model": c.ollama_model,
        }
        for c in chars
    ]


@router.post("/characters")
async def create_character(
    name: str = Form(...),
    slug: str = Form(...),
    gender: str = Form("female"),
    age_display: Optional[int] = Form(None),
    skin_color: Optional[str] = Form(None),
    body_shape: Optional[str] = Form(None),
    hair_color: Optional[str] = Form(None),
    eye_color: Optional[str] = Form(None),
    personality_prompt: Optional[str] = Form(None),
    identity_dna: Optional[str] = Form(None),
    body_dna: Optional[str] = Form(None),
    ollama_model: str = Form("dolphin-llama3:8b"),
    plan_id: Optional[int] = Form(None),
    voice_enabled: bool = Form(False),
    elevenlabs_voice_id: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    _: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if db.query(Character).filter(Character.slug == slug).first():
        raise HTTPException(status_code=400, detail="Slug already exists")

    photo_url = None
    if photo and photo.filename:
        photo_url = await save_character_photo(photo)

    char = Character(
        name=name, slug=slug, gender=gender, age_display=age_display,
        skin_color=skin_color, body_shape=body_shape, hair_color=hair_color, eye_color=eye_color,
        personality_prompt=personality_prompt, identity_dna=identity_dna, body_dna=body_dna,
        ollama_model=ollama_model, plan_id=plan_id,
        voice_enabled=voice_enabled and bool(elevenlabs_voice_id),
        elevenlabs_voice_id=elevenlabs_voice_id if voice_enabled else None,
        photo_url=photo_url, is_active=True,
    )
    db.add(char)
    db.commit()
    db.refresh(char)
    return {"message": "Character created", "id": char.id}


@router.put("/characters/{char_id}")
async def update_character(
    char_id: int,
    name: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    age_display: Optional[int] = Form(None),
    skin_color: Optional[str] = Form(None),
    body_shape: Optional[str] = Form(None),
    hair_color: Optional[str] = Form(None),
    eye_color: Optional[str] = Form(None),
    personality_prompt: Optional[str] = Form(None),
    identity_dna: Optional[str] = Form(None),
    body_dna: Optional[str] = Form(None),
    ollama_model: Optional[str] = Form(None),
    plan_id: Optional[int] = Form(None),
    voice_enabled: Optional[bool] = Form(None),
    elevenlabs_voice_id: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None),
    photo: Optional[UploadFile] = File(None),
    _: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    char = db.query(Character).filter(Character.id == char_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    if name is not None: char.name = name
    if gender is not None: char.gender = gender
    if age_display is not None: char.age_display = age_display
    if skin_color is not None: char.skin_color = skin_color
    if body_shape is not None: char.body_shape = body_shape
    if hair_color is not None: char.hair_color = hair_color
    if eye_color is not None: char.eye_color = eye_color
    if personality_prompt is not None: char.personality_prompt = personality_prompt
    if identity_dna is not None: char.identity_dna = identity_dna
    if body_dna is not None: char.body_dna = body_dna
    if ollama_model is not None: char.ollama_model = ollama_model
    if plan_id is not None: char.plan_id = plan_id
    if elevenlabs_voice_id is not None:
        char.elevenlabs_voice_id = elevenlabs_voice_id or None
    if voice_enabled is not None:
        char.voice_enabled = voice_enabled and bool(char.elevenlabs_voice_id)
    if is_active is not None: char.is_active = is_active
    if photo and photo.filename:
        char.photo_url = await save_character_photo(photo)

    db.commit()
    return {"message": "Character updated"}


@router.delete("/characters/{char_id}")
async def delete_character(char_id: int, _: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.id == char_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    char.is_active = False
    db.commit()
    return {"message": "Character deactivated"}


# ── Plans ─────────────────────────────────────────────────────────────────────

@router.get("/plans")
async def list_plans(_: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    return db.query(SubscriptionPlan).all()


@router.put("/plans/{plan_id}")
async def update_plan(
    plan_id: int, req: PlanUpdateRequest,
    _: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db),
):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    for field, val in req.model_dump(exclude_none=True).items():
        setattr(plan, field, val)
    db.commit()
    return {"message": "Plan updated"}


# ── Payments ──────────────────────────────────────────────────────────────────

@router.get("/payments")
async def list_payments(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, le=100),
    status: Optional[str] = None,
    _: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    q = db.query(Payment)
    if status:
        q = q.filter(Payment.status == status)
    total = q.count()
    payments = q.order_by(Payment.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "total": total, "page": page, "per_page": per_page,
        "payments": [
            {
                "id": p.id, "user_id": p.user_id,
                "user_email": p.user.user_id if p.user else None,
                "plan_name": p.plan.plan_name if p.plan else None,
                "amount": p.amount, "currency": p.currency, "status": p.status,
                "razorpay_order_id": p.razorpay_order_id,
                "razorpay_payment_id": p.razorpay_payment_id,
                "created_at": p.created_at,
            }
            for p in payments
        ],
    }
