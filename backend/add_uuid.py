import uuid
import psycopg2
from urllib.parse import urlparse

DATABASE_URL = "postgresql://postgres:Abhi%40123@localhost:5432/maya_memory"

try:
    # Connect to your postgres DB
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Check if the column exists
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='characters' AND column_name='uuid';")
    if not cur.fetchone():
        # Add column
        cur.execute("ALTER TABLE characters ADD COLUMN uuid VARCHAR(36) UNIQUE;")
        print("Column added.")
        
        # Give existing rows a UUID
        cur.execute("SELECT id FROM characters;")
        rows = cur.fetchall()
        for row in rows:
            char_id = row[0]
            new_uuid = str(uuid.uuid4())
            cur.execute("UPDATE characters SET uuid = %s WHERE id = %s;", (new_uuid, char_id))
        
        conn.commit()
        print("Existing rows updated with UUID.")
    else:
        print("Column already exists.")
        
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
