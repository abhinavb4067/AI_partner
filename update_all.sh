#!/bin/bash
set -e

echo "======================================"
echo "    Full Stack Update Script"
echo "======================================"

cd /var/www/AI_partner

echo "-> Pulling latest code from git..."
git pull origin main

# ----------------- BACKEND -----------------
echo "-> Updating Backend..."
cd backend
source venv/bin/activate
pip install -r requirements.txt
# alembic upgrade head
systemctl restart fastapi

# ----------------- FRONTEND -----------------
echo "-> Updating Frontend..."
cd ../frontend
npm install
npm run build

# ----------------- SERVER -----------------
echo "-> Restarting Nginx..."
systemctl restart nginx

echo "-> Full stack update complete! ✅"
