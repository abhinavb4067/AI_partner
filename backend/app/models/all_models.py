from sqlalchemy import Column, Integer, String, JSON, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    id = Column(Integer, primary_key=True, index=True)
    plan_name = Column(String, unique=True) # free, pro, elite
    monthly_tokens = Column(Integer)
    
    users = relationship("UserAccount", back_populates="plan")
    characters = relationship("Character", back_populates="required_plan")

class Character(Base):
    __tablename__ = "characters"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    slug = Column(String, unique=True)
    gender = Column(String, default="female") # male, female, other
    ollama_model = Column(String, default="dolphin-llama3:8b")
    plan_id = Column(Integer, ForeignKey("subscription_plans.id"))
    
    identity_dna = Column(Text)
    body_dna = Column(Text)
    personality_prompt = Column(Text)

    required_plan = relationship("SubscriptionPlan", back_populates="characters")
    # Added relationship for ChatMessages
    messages = relationship("ChatMessage", back_populates="character")

class UserAccount(Base):
    __tablename__ = "user_accounts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True)
    name = Column(String)
    plan_id = Column(Integer, ForeignKey("subscription_plans.id"))
    tokens_left = Column(Integer, default=50)

    plan = relationship("SubscriptionPlan", back_populates="users")
    messages = relationship("ChatMessage", back_populates="owner")
    memories = relationship("UserMemory", back_populates="owner")

class UserMemory(Base):
    __tablename__ = "user_memories"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"))
    
    key = Column(String)   # e.g., 'age', 'education', 'likes'
    value = Column(Text)   # e.g., '25', 'Computer Science', 'Coffee'
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("UserAccount", back_populates="memories")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"))
    character_id = Column(Integer, ForeignKey("characters.id"))
    
    sender = Column(String) # 'user' or 'assistant'
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("UserAccount", back_populates="messages")
    character = relationship("Character", back_populates="messages")