import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.all_models import AdminUser
from app.core.security import hash_password

db = SessionLocal()
admin = db.query(AdminUser).filter(AdminUser.email == 'admin@dreamdate.ai').first()
if admin:
    print('Admin found:', admin.email)
    admin.hashed_password = hash_password('Admin@123')
    db.commit()
    print('Password reset to Admin@123 successfully!')
else:
    admin = AdminUser(
        email='admin@dreamdate.ai',
        hashed_password=hash_password('Admin@123'),
        full_name='Super Admin',
        role='superadmin',
    )
    db.add(admin)
    db.commit()
    print('Admin created fresh with Admin@123!')
db.close()
