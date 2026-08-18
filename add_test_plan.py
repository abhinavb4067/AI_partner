import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from app.core.database import SessionLocal
from app.models.all_models import SubscriptionPlan

db = SessionLocal()

test_plan = {
    "plan_name": "test",
    "display_name": "Test Plan (10 INR)",
    "monthly_credits": 100,
    "price_monthly": 10.0,
    "price_yearly": 100.0,
    "is_unlimited": False,
    "can_use_voice": True,
    "can_use_images": True,
    "can_access_premium_chars": True,
    "features": ["100 Credits / month", "Test Payment Flow"]
}

if not db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_name == "test").first():
    db.add(SubscriptionPlan(**test_plan))
    db.commit()
    print("Test plan added successfully!")
else:
    print("Test plan already exists!")

db.close()
