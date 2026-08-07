import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from sqlalchemy import create_engine, text

# Local DB URL
DB_URL = "postgresql://postgres:Abhi%40123@localhost:5432/maya_memory"
engine = create_engine(DB_URL)

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS can_use_voice BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS can_use_images BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS can_access_premium_chars BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features JSON;"))
        conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;"))
        conn.commit()
    print("Successfully updated local database schema!")
except Exception as e:
    print(f"Error: {e}")
