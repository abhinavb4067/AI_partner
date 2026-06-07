import sys
import os

# Add the backend directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.all_models import ChatMessage

def clear_history():
    db = SessionLocal()
    try:
        deleted_count = db.query(ChatMessage).delete()
        db.commit()
        print(f"Successfully deleted {deleted_count} messages.")
    except Exception as e:
        print(f"Error deleting messages: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clear_history()
