set -e
echo "Pulling latest code..."
cd /var/www/AI_partner
git pull origin main

echo "Setting up Frontend..."
cd frontend
npm install
npm run build

echo "Restarting Nginx..."
systemctl restart nginx
echo "Server Update Complete!"
