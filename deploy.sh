#!/bin/bash
set -e

echo "Updating system..."
apt update -y

echo "Installing Nginx, Python dependencies, and curl..."
apt install -y nginx python3-venv python3-pip curl

echo "Installing Node.js 20..."
if ! command -v node > /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

echo "Setting up backend..."
cd /var/www/AI_partner/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn

# Generate a temporary .env file on the server (you should replace this with a real one later)
if [ ! -f .env ]; then
    cat << 'ENVEOF' > .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
SECRET_KEY=super-secret-jwt-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
ACTIVE_PAYMENT_GATEWAY=stripe
MEDIA_FOLDER=media
CORS_ORIGINS=http://165.22.11.170,http://localhost:5173
ENVEOF
fi

echo "Setting up Systemd service for Backend..."
cat << 'EOF' > /etc/systemd/system/fastapi.service
[Unit]
Description=Gunicorn instance to serve FastAPI Application
After=network.target

[Service]
User=root
Group=www-data
WorkingDirectory=/var/www/AI_partner/backend
Environment="PATH=/var/www/AI_partner/backend/venv/bin"
ExecStart=/var/www/AI_partner/backend/venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 127.0.0.1:8000

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable fastapi
systemctl restart fastapi

echo "Setting up frontend..."
cd /var/www/AI_partner/frontend
npm install
npm run build

echo "Configuring Nginx..."
cat << 'EOF' > /etc/nginx/sites-available/ai_partner
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    root /var/www/AI_partner/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/ai_partner /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

systemctl restart nginx

echo "Deployment completed successfully! The app is running on http://165.22.11.170"
