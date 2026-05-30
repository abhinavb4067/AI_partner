"""
migrate_v2.py — Run ONCE to upgrade the existing DB schema.

What this does:
  1. Adds new columns to user_accounts (hashed_password, avatar_url, credits_remaining, is_unlimited, credits_reset_at, is_active, created_at)
  2. Copies tokens_left → credits_remaining for existing rows
  3. Sets hashed_password to bcrypt(user_id) so existing users can log in with their email as temp password
  4. Adds new columns to characters (photo_url, skin_color, body_shape, hair_color, eye_color, age_display, voice_enabled, elevenlabs_voice_id, is_active, created_at)
  5. Adds new columns to subscription_plans (display_name, price_monthly, price_yearly, is_unlimited, can_use_voice, can_use_images, can_access_premium_chars, features, is_active)
  6. Creates new tables: admin_users, payments

Usage:
    cd backend
    python migrate_v2.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import engine, Base
from app.models.all_models import (
    AdminUser, Payment, SubscriptionPlan, UserAccount,
    Character, UserMemory, ChatMessage,
)
from app.core.security import hash_password
from app.core.config import settings

def run_safe(conn, sql: str, label: str):
    """Execute SQL, ignore if column/table already exists."""
    try:
        conn.execute(text(sql))
        print(f"  ✅ {label}")
    except Exception as e:
        msg = str(e).lower()
        if "already exists" in msg or "duplicate column" in msg:
            print(f"  [SKIP] {label} (already exists)")
        else:
            print(f"  [ERROR] {label}: {e}")

def migrate():
    print("\n[START] Running migrate_v2.py ...\n")

    with engine.begin() as conn:
        # ── user_accounts ─────────────────────────────────────────────────────
        print("[INFO] Updating user_accounts ...")
        run_safe(conn, "ALTER TABLE user_accounts ADD COLUMN hashed_password VARCHAR", "add hashed_password")
        run_safe(conn, "ALTER TABLE user_accounts ADD COLUMN avatar_url VARCHAR", "add avatar_url")
        run_safe(conn, "ALTER TABLE user_accounts ADD COLUMN credits_remaining INTEGER DEFAULT 50", "add credits_remaining")
        run_safe(conn, "ALTER TABLE user_accounts ADD COLUMN is_unlimited BOOLEAN DEFAULT FALSE", "add is_unlimited")
        run_safe(conn, "ALTER TABLE user_accounts ADD COLUMN credits_reset_at TIMESTAMP", "add credits_reset_at")
        run_safe(conn, "ALTER TABLE user_accounts ADD COLUMN is_active BOOLEAN DEFAULT TRUE", "add is_active")
        run_safe(conn, "ALTER TABLE user_accounts ADD COLUMN created_at TIMESTAMP DEFAULT NOW()", "add created_at")

        # Copy tokens_left → credits_remaining for existing rows
        try:
            conn.execute(text(
                "UPDATE user_accounts SET credits_remaining = tokens_left WHERE credits_remaining IS NULL OR credits_remaining = 50"
            ))
            print("  ✅ Copied tokens_left → credits_remaining")
        except Exception as e:
            print(f"  ⚠️  Could not copy tokens_left: {e}")

        # Set temp hashed passwords for existing users (their email as password)
        try:
            rows = conn.execute(text("SELECT id, user_id FROM user_accounts WHERE hashed_password IS NULL")).fetchall()
            for row in rows:
                hpw = hash_password(str(row[1]))  # email as temp password
                conn.execute(text(
                    "UPDATE user_accounts SET hashed_password = :hp WHERE id = :uid"
                ), {"hp": hpw, "uid": row[0]})
            print(f"  ✅ Set temp passwords for {len(rows)} existing users (password = their email)")
        except Exception as e:
            print(f"  ⚠️  Could not set temp passwords: {e}")

        # ── characters ────────────────────────────────────────────────────────
        print("\n📋 Updating characters ...")
        run_safe(conn, "ALTER TABLE characters ADD COLUMN photo_url VARCHAR", "add photo_url")
        run_safe(conn, "ALTER TABLE characters ADD COLUMN skin_color VARCHAR(50)", "add skin_color")
        run_safe(conn, "ALTER TABLE characters ADD COLUMN body_shape VARCHAR(50)", "add body_shape")
        run_safe(conn, "ALTER TABLE characters ADD COLUMN hair_color VARCHAR(50)", "add hair_color")
        run_safe(conn, "ALTER TABLE characters ADD COLUMN eye_color VARCHAR(50)", "add eye_color")
        run_safe(conn, "ALTER TABLE characters ADD COLUMN age_display INTEGER", "add age_display")
        run_safe(conn, "ALTER TABLE characters ADD COLUMN voice_enabled BOOLEAN DEFAULT FALSE", "add voice_enabled")
        run_safe(conn, "ALTER TABLE characters ADD COLUMN elevenlabs_voice_id VARCHAR(100)", "add elevenlabs_voice_id")
        run_safe(conn, "ALTER TABLE characters ADD COLUMN is_active BOOLEAN DEFAULT TRUE", "add is_active")
        run_safe(conn, "ALTER TABLE characters ADD COLUMN created_at TIMESTAMP DEFAULT NOW()", "add created_at")

        # ── subscription_plans ────────────────────────────────────────────────
        print("\n📋 Updating subscription_plans ...")
        run_safe(conn, "ALTER TABLE subscription_plans ADD COLUMN display_name VARCHAR(100) DEFAULT 'Free'", "add display_name")
        run_safe(conn, "ALTER TABLE subscription_plans ADD COLUMN price_monthly FLOAT DEFAULT 0.0", "add price_monthly")
        run_safe(conn, "ALTER TABLE subscription_plans ADD COLUMN price_yearly FLOAT DEFAULT 0.0", "add price_yearly")
        run_safe(conn, "ALTER TABLE subscription_plans ADD COLUMN is_unlimited BOOLEAN DEFAULT FALSE", "add is_unlimited")
        run_safe(conn, "ALTER TABLE subscription_plans ADD COLUMN can_use_voice BOOLEAN DEFAULT FALSE", "add can_use_voice")
        run_safe(conn, "ALTER TABLE subscription_plans ADD COLUMN can_use_images BOOLEAN DEFAULT FALSE", "add can_use_images")
        run_safe(conn, "ALTER TABLE subscription_plans ADD COLUMN can_access_premium_chars BOOLEAN DEFAULT FALSE", "add can_access_premium_chars")
        run_safe(conn, "ALTER TABLE subscription_plans ADD COLUMN features JSON DEFAULT '[]'", "add features")
        run_safe(conn, "ALTER TABLE subscription_plans ADD COLUMN is_active BOOLEAN DEFAULT TRUE", "add is_active")

        # Update existing plan data
        try:
            conn.execute(text("""
                UPDATE subscription_plans SET
                  display_name = INITCAP(plan_name),
                  price_monthly = CASE plan_name
                    WHEN 'free' THEN 0
                    WHEN 'starter' THEN 199
                    WHEN 'pro' THEN 499
                    WHEN 'elite' THEN 999
                    ELSE 0 END,
                  can_use_images = CASE WHEN plan_name != 'free' THEN TRUE ELSE FALSE END,
                  can_use_voice = CASE WHEN plan_name IN ('pro','elite') THEN TRUE ELSE FALSE END,
                  can_access_premium_chars = CASE WHEN plan_name IN ('pro','elite') THEN TRUE ELSE FALSE END,
                  is_unlimited = CASE WHEN plan_name = 'elite' THEN TRUE ELSE FALSE END,
                  monthly_credits = CASE plan_name
                    WHEN 'free' THEN 50
                    WHEN 'starter' THEN 500
                    WHEN 'pro' THEN 2000
                    WHEN 'elite' THEN 999999
                    ELSE 50 END
            """))
            print("  ✅ Updated plan data")
        except Exception as e:
            print(f"  ⚠️  Could not update plans: {e}")

        # Insert starter/pro/elite plans if missing
        for plan in [
            ("starter", "Starter", 500, 199, 499, False, False, True, False),
            ("pro", "Pro", 2000, 499, 999, False, True, True, True),
            ("elite", "Elite", 999999, 999, 1999, True, True, True, True),
        ]:
            try:
                conn.execute(text("""
                    INSERT INTO subscription_plans 
                    (plan_name, display_name, monthly_credits, price_monthly, price_yearly,
                     is_unlimited, can_use_voice, can_use_images, can_access_premium_chars)
                    VALUES (:pn, :dn, :mc, :pm, :py, :iu, :uv, :ui, :upc)
                    ON CONFLICT (plan_name) DO NOTHING
                """), {
                    "pn": plan[0], "dn": plan[1], "mc": plan[2], "pm": plan[3],
                    "py": plan[4], "iu": plan[5], "uv": plan[6], "ui": plan[7], "upc": plan[8]
                })
                print(f"  ✅ Upserted plan: {plan[0]}")
            except Exception as e:
                print(f"  ⚠️  Plan {plan[0]}: {e}")

    # ── Create new tables using SQLAlchemy ────────────────────────────────────
    print("\n📋 Creating new tables (admin_users, payments) ...")
    Base.metadata.create_all(bind=engine)
    print("  ✅ All new tables created")

    # ── Seed admin user ───────────────────────────────────────────────────────
    print("\n📋 Seeding admin user ...")
    from app.core.database import SessionLocal
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
            print(f"  ✅ Admin created: {settings.ADMIN_EMAIL}")
        else:
            print(f"  ⏭  Admin already exists: {settings.ADMIN_EMAIL}")
    finally:
        db.close()

    print("\n✨ Migration complete!\n")
    print("⚠️  NOTE: Existing users' temp password = their email address.")
    print("   They should update it via Profile → Change Password.\n")

if __name__ == "__main__":
    migrate()
