#!/bin/bash
set -e

echo "======================================"
echo "    Backend Update Script"
echo "======================================"

cd /var/www/AI_partner

echo "-> Pulling latest code from git..."
git pull origin main

echo "-> Setting up backend environment..."
cd backend
source venv/bin/activate

echo "-> Installing dependencies..."
pip install -r requirements.txt

# Note: Since this is a FastAPI app, it doesn't use "makemigrations" like Django.
# If you eventually use Alembic for migrations, you would uncomment the line below:
# echo "-> Running database migrations..."
# alembic upgrade head

echo "-> Restarting Backend Service (FastAPI)..."
systemctl restart fastapi

echo "-> Backend update complete! ✅"
