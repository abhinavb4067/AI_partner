import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_url = os.environ.get("DATABASE_URL")
if db_url and db_url.startswith("postgresql+psycopg2://"):
    db_url = db_url.replace("postgresql+psycopg2://", "postgresql://")

print(f"Connecting to {db_url}")

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Check if column exists
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name='user_accounts' AND column_name='fcm_token';")
    if not cursor.fetchone():
        print("Adding fcm_token column to user_accounts table...")
        cursor.execute("ALTER TABLE user_accounts ADD COLUMN fcm_token VARCHAR;")
        print("Column added successfully.")
    else:
        print("Column fcm_token already exists.")
        
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
