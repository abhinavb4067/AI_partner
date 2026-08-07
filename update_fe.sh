#!/bin/bash
set -e

echo "======================================"
echo "    Frontend Update Script"
echo "======================================"

cd /var/www/AI_partner

echo "-> Pulling latest code from git..."
git pull origin main

echo "-> Building frontend..."
cd frontend
npm install
npm run build

echo "-> Restarting Nginx server..."
systemctl restart nginx

echo "-> Frontend update complete! ✅"
