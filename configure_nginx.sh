#!/bin/bash
set -e

echo "Configuring Nginx..."

cat << 'EOF' > /etc/nginx/sites-available/frontend
server {
    listen 80;
    server_name avoiga.ectama.com www.avoiga.ectama.com;

    client_max_body_size 50M;
    root /var/www/AI_partner/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

cat << 'EOF' > /etc/nginx/sites-available/backend
server {
    listen 80;
    server_name avoigabackend.ectama.com www.avoigabackend.ectama.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /media/ {
        alias /var/www/AI_partner/backend/media/;
    }
}
EOF

ln -sf /etc/nginx/sites-available/frontend /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/backend /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/ai_partner /etc/nginx/sites-enabled/default

systemctl restart nginx

echo "Building frontend with new API URL..."
echo "VITE_API_URL=http://avoigabackend.ectama.com" > /var/www/AI_partner/frontend/.env.production
cd /var/www/AI_partner/frontend
npm run build

echo "Done!"
