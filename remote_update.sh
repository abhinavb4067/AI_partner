set -e
echo "Pulling latest code..."
cd /var/www/AI_partner
git pull origin main

echo "Recreating Database..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS maya_memory;"
sudo -u postgres psql -c "CREATE DATABASE maya_memory;"

echo "Setting up Backend..."
cd backend
source venv/bin/activate
pip install -r requirements.txt

echo "Restarting FastAPI..."
systemctl restart fastapi

echo "Setting up Frontend..."
cd ../frontend
npm install
npm run build

echo "Restarting Nginx..."
systemctl restart nginx
echo "Server Update Complete!"
