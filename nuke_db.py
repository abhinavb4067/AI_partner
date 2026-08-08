import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from app.core.database import engine, Base
import app.models.all_models

print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)
print("Creating all tables...")
Base.metadata.create_all(bind=engine)
print("Database nuked and recreated successfully!")
