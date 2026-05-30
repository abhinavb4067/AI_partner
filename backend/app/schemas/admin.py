"""Pydantic schemas for admin CRUD operations."""
from __future__ import annotations
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserListItem(BaseModel):
    id: int
    user_id: str
    name: Optional[str]
    email: Optional[str]
    plan_name: Optional[str]
    credits_remaining: int
    is_unlimited: bool
    is_active: bool
    created_at: Optional[datetime]
    total_messages: int = 0

    class Config:
        from_attributes = True


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    plan_id: Optional[int] = None
    credits_remaining: Optional[int] = None
    is_unlimited: Optional[bool] = None
    is_active: Optional[bool] = None


class AdminStatsResponse(BaseModel):
    total_users: int
    active_users: int
    total_revenue: float
    messages_today: int
    new_users_today: int
    active_subscriptions: int


class PlanUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    price_monthly: Optional[float] = None
    price_yearly: Optional[float] = None
    monthly_credits: Optional[int] = None
    is_unlimited: Optional[bool] = None
    can_use_voice: Optional[bool] = None
    can_use_images: Optional[bool] = None
    can_access_premium_chars: Optional[bool] = None
    features: Optional[List[str]] = None
