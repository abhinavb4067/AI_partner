"""Quick seed script — run once after migration."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import SessionLocal, engine, Base
from app.models.all_models import AdminUser, SubscriptionPlan
from app.core.security import hash_password
from app.core.config import settings

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── Admin ──────────────────────────────────────────────────────────────────────
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
    print("Admin created:", settings.ADMIN_EMAIL)
else:
    print("Admin exists:", settings.ADMIN_EMAIL)

# ── Fix missing plan columns (DDL needs autocommit) ───────────────────────────
import psycopg2
from urllib.parse import urlparse

db_url = settings.DATABASE_URL.replace("%40", "@")
parsed = urlparse(db_url)
raw_conn = psycopg2.connect(
    host=parsed.hostname, port=parsed.port or 5432,
    dbname=parsed.path.lstrip("/"), user=parsed.username, password=parsed.password
)
raw_conn.autocommit = True
cur = raw_conn.cursor()

PLAN_COLS = [
    ("display_name", "VARCHAR(100) DEFAULT 'Free'"),
    ("monthly_credits", "INTEGER DEFAULT 50"),
    ("price_monthly", "FLOAT DEFAULT 0"),
    ("price_yearly", "FLOAT DEFAULT 0"),
    ("is_unlimited", "BOOLEAN DEFAULT FALSE"),
    ("can_use_voice", "BOOLEAN DEFAULT FALSE"),
    ("can_use_images", "BOOLEAN DEFAULT FALSE"),
    ("can_access_premium_chars", "BOOLEAN DEFAULT FALSE"),
    ("features", "JSON DEFAULT '[]'"),
    ("is_active", "BOOLEAN DEFAULT TRUE"),
]
for col, typ in PLAN_COLS:
    try:
        cur.execute(f"ALTER TABLE subscription_plans ADD COLUMN {col} {typ}")
        print(f"  Added column: {col}")
    except psycopg2.errors.DuplicateColumn:
        print(f"  Already exists: {col}")
    except Exception as e:
        print(f"  Error on {col}: {e}")

cur.close()
raw_conn.close()
engine.dispose()

# ── Update plan data ───────────────────────────────────────────────────────────
PLANS = [
    ("free",    "Free",    50,     0,   0,    False, False, False, False),
    ("starter", "Starter", 500,  199, 499,    False, False,  True, False),
    ("pro",     "Pro",    2000,  499, 999,    False,  True,  True,  True),
    ("elite",   "Elite",99999,  999,1999,     True,   True,  True,  True),
]

conn2 = engine.connect()
try:
    for pn, dn, mc, pm, py, iu, uv, ui, up in PLANS:
        conn2.execute(text("""
            INSERT INTO subscription_plans
              (plan_name, display_name, monthly_credits, price_monthly, price_yearly,
               is_unlimited, can_use_voice, can_use_images, can_access_premium_chars)
            VALUES
              (:pn, :dn, :mc, :pm, :py, :iu, :uv, :ui, :up)
            ON CONFLICT (plan_name) DO UPDATE SET
              display_name = EXCLUDED.display_name,
              monthly_credits = EXCLUDED.monthly_credits,
              price_monthly = EXCLUDED.price_monthly,
              price_yearly = EXCLUDED.price_yearly,
              is_unlimited = EXCLUDED.is_unlimited,
              can_use_voice = EXCLUDED.can_use_voice,
              can_use_images = EXCLUDED.can_use_images,
              can_access_premium_chars = EXCLUDED.can_access_premium_chars
        """), {"pn": pn, "dn": dn, "mc": mc, "pm": pm, "py": py,
               "iu": iu, "uv": uv, "ui": ui, "up": up})
    conn2.commit()
    print("Plans seeded OK")
except Exception as e:
    conn2.rollback()
    print("Plans error:", e)
finally:
    conn2.close()

db.close()
print("SEED COMPLETE")
