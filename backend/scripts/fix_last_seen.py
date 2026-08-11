import sys, os
sys.path.append('/var/www/AI_partner/backend')
from app.core.database import SessionLocal
from app.models.all_models import UserAccount
from datetime import datetime
db = SessionLocal()
users = db.query(UserAccount).filter(UserAccount.last_seen == None).all()
for u in users:
    u.last_seen = datetime.utcnow()
db.commit()
print("Fixed!")
