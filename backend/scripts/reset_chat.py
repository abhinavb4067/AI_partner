from app.core.database import SessionLocal
from app.models.all_models import UserAccount, ChatMessage

def reset_and_fix():
    db = SessionLocal()
    try:
        # 1. Fix User Names
        users = db.query(UserAccount).all()
        for user in users:
            if not user.name or user.name == "unknown":
                user.name = "Abhinav" # Setting a default since the user's email prefix is abhinav
                print(f"Updated user {user.user_id} name to {user.name}")
        
        # 2. Clear Chat History to remove the [User's Name] pattern
        num_deleted = db.query(ChatMessage).delete()
        print(f"Deleted {num_deleted} messages from history to clear the bracket pattern.")
        
        db.commit()
        print("Success! History cleared and names fixed.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_and_fix()
