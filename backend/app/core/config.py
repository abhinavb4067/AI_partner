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
    PROJECT_NAME: str = "Avoiga"
    VERSION: str = "2.0.0"
    FRONTEND_URL: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"  # set to "production" in prod .env

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/postgres"

    # ── JWT ──────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # ── Admin Seed ───────────────────────────────────────────────────────────
    ADMIN_EMAIL: str = "admin@avoiga.ectama.com"
    ADMIN_PASSWORD: str = "Admin@123"

    # ── AI ───────────────────────────────────────────────────────────────────
    OPENROUTER_API_KEY: str = ""
    OLLAMA_URL: str = "http://localhost:11434/api/chat"
    FAL_API_KEY: str = ""

    # ── Email Delivery (Resend) ──────────────────────────────────────────────
    RESEND_API_KEY: str = ""
    EMAILS_FROM_EMAIL: str = "noreply@ectama.com"

    # ── Google OAuth ─────────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""

    # ── Payment Gateway Config ───────────────────────────────────────────────
    ACTIVE_PAYMENT_GATEWAY: str = "stripe"  # "stripe" or "razorpay"
    # Explicit opt-in for local dev without real gateway keys — payments are
    # mocked as always-successful. Must be False in any real deployment; unlike
    # the old behavior this is NEVER inferred from what the secret key looks like.
    PAYMENT_MOCK_MODE: bool = False

    # ── Razorpay ─────────────────────────────────────────────────────────────
    RAZORPAY_KEY_ID: str = "rzp_test_DUMMY"
    RAZORPAY_KEY_SECRET: str = "rzp_test_DUMMY_SECRET"

    # ── Stripe ───────────────────────────────────────────────────────────────
    STRIPE_PUBLISHABLE_KEY: str = "pk_test_DUMMY"
    STRIPE_SECRET_KEY: str = "sk_test_DUMMY"

    # ── ElevenLabs ───────────────────────────────────────────────────────────
    ELEVENLABS_API_KEY: str = "sk_elevenlabs_DUMMY"
    ELEVENLABS_BASE_URL: str = "https://api.elevenlabs.io/v1"

    # ── Media ────────────────────────────────────────────────────────────────
    MEDIA_FOLDER: str = "media"

    # ── Cloudflare R2 (chat-generated photo storage) ───────────────────────────
    # Off by default so local-disk storage keeps working until a bucket exists.
    # Flip on once R2_* below are filled in — see docs/R2_SETUP.md for the
    # exact Cloudflare dashboard steps to create the bucket + API token.
    R2_ENABLED: bool = False
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "avoiga-chat-media"

    # ── End-to-End Encryption ────────────────────────────────────────────────
    # Independent switches — AI companion chat and human-to-human chat each
    # have their own E2EE toggle so one can be on while the other is off.
    # Flip to True to re-enable; when False, messages are stored/sent as
    # plain text and the frontend skips all client-side encrypt/decrypt.
    E2EE_ENABLED: bool = False              # AI companion chat (app/api/routes/chat.py)
    HUMAN_CHAT_E2EE_ENABLED: bool = False   # Human-to-human chat (app/api/routes/social.py)

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        origins = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        # allow_credentials=True (app/main.py) + a wildcard origin together would
        # let ANY site read cookies/Bearer-token-bearing responses cross-origin —
        # refuse to boot with that combination rather than silently allow it.
        if "*" in origins:
            raise RuntimeError(
                "CORS_ORIGINS must not contain '*' — the app sends allow_credentials=True, "
                "so a wildcard origin would allow any website to make authenticated "
                "cross-origin requests. List explicit frontend origins instead."
            )
        return origins

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