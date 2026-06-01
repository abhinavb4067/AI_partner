"""
Core application settings — reads from .env file.
All config lives here; services import `settings`, never os.environ directly.
"""
from __future__ import annotations

import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Application ──────────────────────────────────────────────────────────
    PROJECT_NAME: str = "DreamDate AI"
    VERSION: str = "2.0.0"

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/postgres"

    # ── JWT ──────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # ── Admin Seed ───────────────────────────────────────────────────────────
    ADMIN_EMAIL: str = "admin@dreamdate.ai"
    ADMIN_PASSWORD: str = "Admin@123"

    # ── AI ───────────────────────────────────────────────────────────────────
    OPENROUTER_API_KEY: str = ""
    OLLAMA_URL: str = "http://localhost:11434/api/chat"

    # ── Razorpay ─────────────────────────────────────────────────────────────
    RAZORPAY_KEY_ID: str = "rzp_test_DUMMY"
    RAZORPAY_KEY_SECRET: str = "rzp_test_DUMMY_SECRET"

    # ── ElevenLabs ───────────────────────────────────────────────────────────
    ELEVENLABS_API_KEY: str = "sk_elevenlabs_DUMMY"
    ELEVENLABS_BASE_URL: str = "https://api.elevenlabs.io/v1"

    # ── Media ────────────────────────────────────────────────────────────────
    MEDIA_FOLDER: str = "media"

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def characters_folder(self) -> str:
        return os.path.join(self.MEDIA_FOLDER, "characters")

    @property
    def avatars_folder(self) -> str:
        return os.path.join(self.MEDIA_FOLDER, "avatars")

    @property
    def posts_folder(self) -> str:
        return os.path.join(self.MEDIA_FOLDER, "posts")

    def ensure_media_dirs(self) -> None:
        """Create all required media directories on startup."""
        for folder in [self.MEDIA_FOLDER, self.characters_folder, self.avatars_folder, self.posts_folder]:
            os.makedirs(folder, exist_ok=True)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
settings.ensure_media_dirs()