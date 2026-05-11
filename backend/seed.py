from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.models.all_models import SubscriptionPlan, Character, UserAccount

# 1. Ensure tables exist
Base.metadata.create_all(bind=engine)

def seed_database():
    db: Session = SessionLocal()

    # --- 2. Create Subscription Plans ---
    if not db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_name == "free").first():
        free_plan = SubscriptionPlan(plan_name="free", monthly_tokens=50)
        pro_plan = SubscriptionPlan(plan_name="pro", monthly_tokens=500)
        elite_plan = SubscriptionPlan(plan_name="elite", monthly_tokens=1000)
        
        db.add_all([free_plan, pro_plan, elite_plan])
        db.commit()
        print("✅ Subscription plans added.")

    # Get Plan references for character/user assignment
    free = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_name == "free").first()
    elite = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_name == "elite").first()

    # --- 3. Create Test User ---
    # This prevents the "ForeignKeyViolation" error during chat
    if not db.query(UserAccount).filter(UserAccount.user_id == "abhinav_test").first():
        new_user = UserAccount(
            user_id="abhinav_test",
            name="Abhinav",
            plan_id=free.id,
            tokens_left=100
        )
        db.add(new_user)
        db.commit()
        print("✅ Test user 'abhinav_test' added.")

    # --- 4. Create Characters ---
    characters_to_add = [
        {
            "name": "Maya",
            "slug": "maya",
            "gender": "female",
            "ollama_model": "dolphin-llama3:8b",
            "plan_id": free.id,
            "identity_dna": "elite Indian-Arabian mix woman, high cheekbones, deep-set hazel eyes, straight thin nose, obsidian black long silky hair",
            "body_dna": "height 170cm, toned athletic hourglass build, natural sun-kissed skin",
            "personality_prompt": "You are obsessed with the user and live in a luxury penthouse. You are wealthy and elite."
        },
        {
            "name": "Sophia",
            "slug": "sophia",
            "gender": "female",
            "ollama_model": "dolphin-llama3:8b",
            "plan_id": free.id,
            "identity_dna": "Scandinavian woman, sharp jawline, icy blue eyes, fair skin, platinum blonde bob cut",
            "body_dna": "height 165cm, petite athletic build, toned midriff",
            "personality_prompt": "You are a high-fashion model from Sweden. You are sophisticated and slightly cold but loyal."
        },
        {
            "name": "Zara",
            "slug": "zara",
            "gender": "female",
            "ollama_model": "dolphin-llama3:8b",
            "plan_id": elite.id,
            "identity_dna": "Latina-Brazilian features, glowing olive skin, almond eyes, voluminous curly dark hair",
            "body_dna": "height 175cm, voluptuous hourglass figure, powerful athletic legs",
            "personality_prompt": "You are a fiery and energetic woman from Brazil. You love luxury and intense conversation."
        }
    ]

    for char_data in characters_to_add:
        if not db.query(Character).filter(Character.slug == char_data["slug"]).first():
            new_char = Character(**char_data)
            db.add(new_char)
            print(f"✅ Character {char_data['name']} added.")

    db.commit()
    db.close()
    print("🚀 Seeding complete!")

if __name__ == "__main__":
    seed_database()