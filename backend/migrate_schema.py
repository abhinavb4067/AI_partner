from sqlalchemy import text
from app.core.database import engine

def migrate_db():
    print("Starting manual migration...")
    with engine.connect() as conn:
        try:
            # Add email column
            print("Adding 'email' column to 'user_accounts'...")
            conn.execute(text("ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS email VARCHAR;"))
            
            # Add age column
            print("Adding 'age' column to 'user_accounts'...")
            conn.execute(text("ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS age INTEGER;"))
            
            # Add hashed_password column
            print("Adding 'hashed_password' column to 'user_accounts'...")
            conn.execute(text("ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS hashed_password VARCHAR;"))
            
            # Add avatar_url column
            print("Adding 'avatar_url' column to 'user_accounts'...")
            conn.execute(text("ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS avatar_url VARCHAR;"))
            
            conn.commit()
            print("Migration complete! Columns added successfully.")
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate_db()
