"""Pydantic schemas for character management."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class CharacterResponse(BaseModel):
    id: int
    name: str
    slug: str
    gender: str
    age_display: Optional[int]
    photo_url: Optional[str]
    skin_color: Optional[str]
    body_shape: Optional[str]
    hair_color: Optional[str]
    eye_color: Optional[str]
    voice_enabled: bool
    is_active: bool
    plan_id: Optional[int]

    class Config:
        from_attributes = True


class CharacterCreateRequest(BaseModel):
    name: str
    slug: str
    gender: str = "female"
    age_display: Optional[int] = None
    skin_color: Optional[str] = None
    body_shape: Optional[str] = None
    hair_color: Optional[str] = None
    eye_color: Optional[str] = None
    personality_prompt: Optional[str] = None
    identity_dna: Optional[str] = None
    body_dna: Optional[str] = None
    ollama_model: str = "dolphin-llama3:8b"
    plan_id: Optional[int] = None
    elevenlabs_voice_id: Optional[str] = None
    voice_enabled: bool = False


class CharacterUpdateRequest(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    age_display: Optional[int] = None
    skin_color: Optional[str] = None
    body_shape: Optional[str] = None
    hair_color: Optional[str] = None
    eye_color: Optional[str] = None
    personality_prompt: Optional[str] = None
    identity_dna: Optional[str] = None
    body_dna: Optional[str] = None
    ollama_model: Optional[str] = None
    plan_id: Optional[int] = None
    elevenlabs_voice_id: Optional[str] = None
    voice_enabled: Optional[bool] = None
    is_active: Optional[bool] = None
