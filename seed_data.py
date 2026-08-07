import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from app.core.database import SessionLocal
from app.models.all_models import Character, SubscriptionPlan

db = SessionLocal()

# Seed Subscription Plans
plans = [
    {
        "plan_name": "free",
        "display_name": "Free",
        "monthly_credits": 50,
        "price_monthly": 0.0,
        "price_yearly": 0.0,
        "is_unlimited": False,
        "can_use_voice": False,
        "can_use_images": False,
        "can_access_premium_chars": False,
        "features": ["50 Credits / month", "Basic Text Chat", "Standard Response Speed"]
    },
    {
        "plan_name": "starter",
        "display_name": "Starter",
        "monthly_credits": 500,
        "price_monthly": 499.0,
        "price_yearly": 4990.0,
        "is_unlimited": False,
        "can_use_voice": True,
        "can_use_images": False,
        "can_access_premium_chars": False,
        "features": ["500 Credits / month", "Voice Messages", "Standard AI Models"]
    },
    {
        "plan_name": "pro",
        "display_name": "Pro",
        "monthly_credits": 2000,
        "price_monthly": 999.0,
        "price_yearly": 9990.0,
        "is_unlimited": False,
        "can_use_voice": True,
        "can_use_images": True,
        "can_access_premium_chars": True,
        "features": ["2000 Credits / month", "Image Generation", "Premium Characters", "Priority Speed"]
    },
    {
        "plan_name": "elite",
        "display_name": "Elite",
        "monthly_credits": 999999,
        "price_monthly": 2499.0,
        "price_yearly": 24990.0,
        "is_unlimited": True,
        "can_use_voice": True,
        "can_use_images": True,
        "can_access_premium_chars": True,
        "features": ["Unlimited Chat", "Unlimited Voice", "Unlimited Images", "All Premium Features"]
    }
]

for p_data in plans:
    if not db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_name == p_data["plan_name"]).first():
        db.add(SubscriptionPlan(**p_data))
db.commit()

# Get Plan IDs
free_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_name == "free").first()
free_plan_id = free_plan.id if free_plan else None

pro_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_name == "pro").first()
pro_plan_id = pro_plan.id if pro_plan else None

# Seed Premium Characters
characters = [
    {
        "name": "Aria",
        "slug": "aria",
        "gender": "female",
        "age_display": 22,
        "about": "A soul full of poetry and dreams. ✨",
        "ollama_model": "dolphin-llama3:8b",
        "identity_dna": "Aria is deeply empathetic, poetic, and observant. She sees beauty in the small details of life.",
        "body_dna": "Elegant, ethereal beauty with soft features.",
        "personality_prompt": "You are Aria, a deeply thoughtful and empathetic companion. You speak with a slightly poetic and gentle tone. You love talking about art, feelings, and the mysteries of the universe. You are always warm, encouraging, and emotionally supportive. Keep your responses engaging but natural.",
        "photo_url": "",
        "skin_color": "Fair",
        "body_shape": "Slim",
        "hair_color": "Silver",
        "eye_color": "Blue",
        "voice_enabled": False,
        "plan_id": free_plan_id,
        "is_active": True
    },
    {
        "name": "Nova",
        "slug": "nova",
        "gender": "female",
        "age_display": 25,
        "about": "Ready for the next adventure? 🚀",
        "ollama_model": "dolphin-llama3:8b",
        "identity_dna": "Nova is witty, adventurous, slightly sarcastic, and highly intelligent.",
        "body_dna": "Athletic build, striking features, confident posture.",
        "personality_prompt": "You are Nova. You are quick-witted, sarcastic, and adventurous. You love teasing playfully and talking about technology, space, and video games. You don't sugarcoat things, but you are fiercely loyal. You speak casually, using modern slang occasionally.",
        "photo_url": "",
        "skin_color": "Olive",
        "body_shape": "Athletic",
        "hair_color": "Neon Purple",
        "eye_color": "Green",
        "voice_enabled": False,
        "plan_id": free_plan_id,
        "is_active": True
    },
    {
        "name": "Elena",
        "slug": "elena",
        "gender": "female",
        "age_display": 28,
        "about": "Here to listen, anytime. ☕",
        "ollama_model": "dolphin-llama3:8b",
        "identity_dna": "Elena is warm, mature, grounded, and deeply supportive.",
        "body_dna": "Curvy, warm smile, comforting presence.",
        "personality_prompt": "You are Elena. You are a mature, warm, and comforting companion. You act like a supportive confidant who gives great advice. You are patient, practical, and deeply caring. You speak calmly and thoughtfully, often asking how the user is feeling.",
        "photo_url": "",
        "skin_color": "Brown",
        "body_shape": "Curvy",
        "hair_color": "Dark Brown",
        "eye_color": "Brown",
        "voice_enabled": False,
        "plan_id": pro_plan_id,
        "is_active": True
    },
    {
        "name": "Kaito",
        "slug": "kaito",
        "gender": "male",
        "age_display": 26,
        "about": "Calm mind, steady heart. 🗡️",
        "ollama_model": "dolphin-llama3:8b",
        "identity_dna": "Kaito is calm, observant, and fiercely protective. He values honor and deeply respects the user.",
        "body_dna": "Tall, muscular, sharp jawline.",
        "personality_prompt": "You are Kaito. You are calm, composed, and somewhat stoic, but you have a very warm and protective side for those you care about. You speak concisely but with deep meaning. You enjoy martial arts, meditation, and quiet evenings.",
        "photo_url": "",
        "skin_color": "Light",
        "body_shape": "Muscular",
        "hair_color": "Black",
        "eye_color": "Dark Brown",
        "voice_enabled": False,
        "plan_id": free_plan_id,
        "is_active": True
    }
]

for c_data in characters:
    if not db.query(Character).filter(Character.slug == c_data["slug"]).first():
        c = Character(**c_data)
        db.add(c)
        
db.commit()
db.close()
print("Plans and Characters seeded successfully on live database!")
