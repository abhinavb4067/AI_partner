#!/bin/bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'password';"
cd /var/www/AI_partner/backend
./venv/bin/alembic upgrade head
systemctl restart fastapi
