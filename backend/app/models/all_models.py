"""
SQLAlchemy ORM models — single source of truth for all DB tables.

Tables:
  subscription_plans  — Free / Starter / Pro / Elite plans with credit rules
  user_accounts       — Regular end-users (NO admin flag — admins live in admin_users)
  admin_users         — Completely separate admin table
  characters          — AI companions with optional ElevenLabs voice
  user_memories       — Per-user memory key/value store
  chat_messages       — Full conversation history
  payments            — Razorpay payment records
"""
from __future__ import annotations

from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, JSON, String, Text,
)
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base


# ── Subscription Plans ────────────────────────────────────────────────────────
class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    plan_name = Column(String(50), unique=True, nullable=False)   # free|starter|pro|elite
    display_name = Column(String(100), default="Free")
    monthly_credits = Column(Integer, default=50)                 # -1 not used; is_unlimited flag instead
    price_monthly = Column(Float, default=0.0)                    # INR
    price_yearly = Column(Float, default=0.0)
    is_unlimited = Column(Boolean, default=False)                 # True → no credit deduction
    can_use_voice = Column(Boolean, default=False)
    can_use_images = Column(Boolean, default=False)
    can_access_premium_chars = Column(Boolean, default=False)
    features = Column(JSON, default=list)                         # UI bullet-point list
    is_active = Column(Boolean, default=True)

    users = relationship("UserAccount", back_populates="plan")
    characters = relationship("Character", back_populates="required_plan")
    payments = relationship("Payment", back_populates="plan")


# ── Regular User ─────────────────────────────────────────────────────────────
class UserAccount(Base):
    __tablename__ = "user_accounts"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, unique=True, index=True, nullable=False)   # email string (legacy PK)
    email = Column(String, unique=True, index=True, nullable=True)
    username = Column(String(50), unique=True, index=True, nullable=True)
    name = Column(String(150), nullable=True)
    age = Column(Integer, nullable=True)
    hashed_password = Column(String, nullable=True)                     # NULL for legacy rows
    avatar_url = Column(String, nullable=True)

    plan_id = Column(String(36), ForeignKey("subscription_plans.id"), nullable=True)
    credits_remaining = Column(Integer, default=50)                     # replaces tokens_left
    is_unlimited = Column(Boolean, default=False)                       # admin-granted override
    credits_reset_at = Column(DateTime, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    plan = relationship("SubscriptionPlan", back_populates="users")
    messages = relationship("ChatMessage", back_populates="owner")
    memories = relationship("UserMemory", back_populates="owner")
    payments = relationship("Payment", back_populates="user")


# ── Admin User (completely separate from UserAccount) ─────────────────────────
class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String(150), default="Administrator")
    role = Column(String(50), default="superadmin")                     # superadmin|moderator
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── AI Character ──────────────────────────────────────────────────────────────
class Character(Base):
    __tablename__ = "characters"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    gender = Column(String(20), default="female")
    age_display = Column(Integer, nullable=True)                        # character's apparent age
    about = Column(String(250), default="Available")                    # WhatsApp style contact info

    # AI model
    ollama_model = Column(String(100), default="dolphin-llama3:8b")

    # Appearance DNA
    identity_dna = Column(Text, nullable=True)
    body_dna = Column(Text, nullable=True)
    personality_prompt = Column(Text, nullable=True)
    photo_url = Column(String, nullable=True)                           # profile photo
    skin_color = Column(String(50), nullable=True)                      # e.g. "Fair", "Olive"
    body_shape = Column(String(50), nullable=True)                      # Slim|Athletic|Curvy|Plus
    hair_color = Column(String(50), nullable=True)
    eye_color = Column(String(50), nullable=True)

    # Voice (ElevenLabs — optional)
    voice_enabled = Column(Boolean, default=False)
    elevenlabs_voice_id = Column(String(100), nullable=True)            # e.g. "21m00Tcm4TlvDq8ikWAM"

    # Plan gating
    plan_id = Column(String(36), ForeignKey("subscription_plans.id"), nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    required_plan = relationship("SubscriptionPlan", back_populates="characters")
    messages = relationship("ChatMessage", back_populates="character")
    posts = relationship("CharacterPost", back_populates="character", cascade="all, delete-orphan")


# ── User Memory ───────────────────────────────────────────────────────────────
class UserMemory(Base):
    __tablename__ = "user_memories"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("user_accounts.id"), nullable=False)
    key = Column(String(100), nullable=False)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("UserAccount", back_populates="memories")


# ── Chat Messages ─────────────────────────────────────────────────────────────
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("user_accounts.id"), nullable=False)
    character_id = Column(String(36), ForeignKey("characters.id"), nullable=False)
    sender = Column(String(20), nullable=False)                         # 'user' | 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("UserAccount", back_populates="messages")
    character = relationship("Character", back_populates="messages")


# ── Payments ──────────────────────────────────────────────────────────────────
class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("user_accounts.id"), nullable=False)
    plan_id = Column(String(36), ForeignKey("subscription_plans.id"), nullable=False)

    razorpay_order_id = Column(String(100), unique=True, nullable=True)
    razorpay_payment_id = Column(String(100), unique=True, nullable=True)
    amount = Column(Float, nullable=False)                              # INR
    currency = Column(String(10), default="INR")
    status = Column(String(30), default="pending")                     # pending|success|failed

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("UserAccount", back_populates="payments")
    plan = relationship("SubscriptionPlan", back_populates="payments")


# ── Character Posts / Reels ───────────────────────────────────────────────────
class CharacterPost(Base):
    __tablename__ = "character_posts"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    character_id = Column(String(36), ForeignKey("characters.id"), nullable=False)
    media_url = Column(String, nullable=False)
    media_type = Column(String(20), default="image")                    # 'image' or 'video'
    is_premium = Column(Boolean, default=True)                          # if true, requires unlimited plan
    created_at = Column(DateTime, default=datetime.utcnow)

    character = relationship("Character", back_populates="posts")

# ── Human to Human Networking ─────────────────────────────────────────────────
class HumanSwipe(Base):
    __tablename__ = "human_swipes"
    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    swiper_id = Column(String(36), ForeignKey("user_accounts.id"), nullable=False)
    target_id = Column(String(36), ForeignKey("user_accounts.id"), nullable=False)
    is_like = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
class HumanMatch(Base):
    __tablename__ = "human_matches"
    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user1_id = Column(String(36), ForeignKey("user_accounts.id"), nullable=False)
    user2_id = Column(String(36), ForeignKey("user_accounts.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class HumanMessage(Base):
    __tablename__ = "human_messages"
    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    sender_id = Column(String(36), ForeignKey("user_accounts.id"), nullable=False)
    receiver_id = Column(String(36), ForeignKey("user_accounts.id"), nullable=False)
    content = Column(Text, nullable=True)
    message_type = Column(String(20), default="text") # 'text', 'image', 'view_once', 'call_request'
    is_viewed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)