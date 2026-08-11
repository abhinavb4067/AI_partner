import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    print("Adding last_seen and show_last_seen columns...")
    try:
        conn.execute(text("ALTER TABLE user_accounts ADD COLUMN last_seen TIMESTAMP;"))
    except Exception as e:
        print(f"last_seen might already exist: {e}")
        
    try:
        conn.execute(text("ALTER TABLE user_accounts ADD COLUMN show_last_seen BOOLEAN DEFAULT TRUE;"))
    except Exception as e:
        print(f"show_last_seen might already exist: {e}")
        
    conn.commit()
    print("Done!")
