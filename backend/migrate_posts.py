import psycopg2
from app.core.config import settings

def main():
    print(f"Connecting to {settings.DATABASE_URL.replace('postgresql+psycopg2', 'postgresql')}...")
    conn = psycopg2.connect(settings.DATABASE_URL.replace("postgresql+psycopg2", "postgresql"))
    conn.autocommit = True
    cur = conn.cursor()

    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS character_posts (
                id SERIAL PRIMARY KEY,
                character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
                media_url VARCHAR NOT NULL,
                media_type VARCHAR(20) DEFAULT 'image',
                is_premium BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Created 'character_posts' table.")
        
        cur.execute("CREATE INDEX IF NOT EXISTS ix_character_posts_id ON character_posts (id)")
    except Exception as e:
        print(f"Error creating table: {e}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
