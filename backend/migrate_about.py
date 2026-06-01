import psycopg2
from app.core.config import settings

def main():
    print(f"Connecting to {settings.DATABASE_URL.replace('postgresql+psycopg2', 'postgresql')}...")
    conn = psycopg2.connect(settings.DATABASE_URL.replace("postgresql+psycopg2", "postgresql"))
    conn.autocommit = True
    cur = conn.cursor()

    try:
        cur.execute("ALTER TABLE characters ADD COLUMN about VARCHAR(250) DEFAULT 'Available'")
        print("✅ Added 'about' column to characters table.")
    except psycopg2.errors.DuplicateColumn:
        print("ℹ️ 'about' column already exists in characters table.")
    except Exception as e:
        print(f"❌ Error adding 'about' column: {e}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
