"""
AI Girlfriend App — FastAPI entry point.
Registers all routers, CORS middleware, static file mounts, and seeds admin on startup.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.security import hash_password
from app.models.all_models import AdminUser  # noqa: F401 — ensures all models are registered
import app.models.all_models  # noqa

from app.api.routes import auth, chat
from app.api.routes import admin_auth, admin, profile, payment, voice, social, ws_chat
import firebase_admin
from firebase_admin import credentials

# Initialize Firebase Admin with robust path resolution
def init_firebase_admin():
    if not firebase_admin._apps:
        candidate_paths = [
            os.path.join(os.path.dirname(__file__), "..", "firebase_admin_sdk.json"),
            os.path.join(os.path.dirname(__file__), "..", "..", "firebase_admin_sdk.json"),
            os.path.join(os.getcwd(), "firebase_admin_sdk.json"),
            os.path.join(os.getcwd(), "backend", "firebase_admin_sdk.json"),
            "/var/www/AI_partner/backend/firebase_admin_sdk.json",
        ]
        cred_path = None
        for p in candidate_paths:
            abs_p = os.path.abspath(p)
            if os.path.exists(abs_p):
                cred_path = abs_p
                break
        if cred_path:
            try:
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred, {
                    'storageBucket': 'avoiga.firebasestorage.app'
                })
                print(f"✅ [Firebase Admin] Initialized successfully from {cred_path}")
            except Exception as e:
                print(f"❌ [Firebase Admin] Failed with cert {cred_path}: {e}")
        else:
            print("⚠️ [Firebase Admin] firebase_admin_sdk.json not found in candidate paths")

init_firebase_admin()


# ── Startup / Shutdown ────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables / columns that don't yet exist (safe — won't drop existing)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS session_version INTEGER DEFAULT 1;"))
            conn.execute(text("UPDATE user_accounts SET session_version = 1 WHERE session_version IS NULL;"))
            conn.commit()
    except Exception as e:
        print(f"session_version migration notice: {e}")

    try:
        from app.models.all_models import EmailOTP
        EmailOTP.__table__.create(bind=engine, checkfirst=True)
    except Exception as e:
        print(f"Warning creating EmailOTP table: {e}")
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Base.metadata.create_all notice: {e}")
    _seed_admin()
    yield


def _seed_admin() -> None:
    """Create the superadmin from .env if not already in DB."""
    db = SessionLocal()
    try:
        existing = db.query(AdminUser).filter(AdminUser.email == settings.ADMIN_EMAIL).first()
        if not existing:
            admin = AdminUser(
                email=settings.ADMIN_EMAIL,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                full_name="Super Admin",
                role="superadmin",
            )
            db.add(admin)
            db.commit()
            print(f"✅ Admin seeded: {settings.ADMIN_EMAIL}")
        else:
            print(f"✅ Admin already exists: {settings.ADMIN_EMAIL}")
    except Exception as e:
        print(f"⚠️  Admin seed error: {e}")
    finally:
        db.close()


# ── App Instance ──────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,       prefix="/api/auth",        tags=["Auth"])
app.include_router(admin_auth.router, prefix="/api/admin/auth",  tags=["Admin Auth"])
app.include_router(chat.router,       prefix="/api/chat",        tags=["Chat"])
app.include_router(profile.router,    prefix="/api/profile",     tags=["Profile"])
app.include_router(payment.router,    prefix="/api/payment",     tags=["Payment"])
app.include_router(voice.router,      prefix="/api/voice",       tags=["Voice"])
app.include_router(admin.router,      prefix="/api/admin",       tags=["Admin"])
app.include_router(social.router,     prefix="/api/social",      tags=["Social"])
app.include_router(ws_chat.router,    prefix="/api/ws/chat",     tags=["Human Chat Websocket"])

# ── Static Files ──────────────────────────────────────────────────────────────
os.makedirs("media", exist_ok=True)
os.makedirs("maya_media", exist_ok=True)
app.mount("/media",      StaticFiles(directory="media"),      name="media")
app.mount("/maya_media", StaticFiles(directory="maya_media"), name="maya_media")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": settings.VERSION}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)