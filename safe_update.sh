set -e
echo "Pulling latest code..."
cd /var/www/AI_partner
git pull origin main

echo "Setting up Backend..."
cd backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart fastapi

echo "Setting up Frontend..."
cd ../frontend
npm install
npm run build
systemctl restart nginx
echo "Safe Update Complete!"
