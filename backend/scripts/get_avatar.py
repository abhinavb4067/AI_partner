import sys
sys.path.append('/var/www/AI_partner/backend')
from app.core.database import SessionLocal
from app.models.all_models import UserAccount
db = SessionLocal()
u = db.query(UserAccount).filter(UserAccount.name.ilike('%abhinav%')).first()
if u:
    print("AVATAR_URL:", u.avatar_url)
