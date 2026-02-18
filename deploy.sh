#!/usr/bin/env bash
set -euo pipefail

# Load Node/npm/pm2 into PATH for non-interactive shells (e.g. GitHub Actions SSH)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"

APP_DIR="/home/ubuntu/to-do-agent"

cd "$APP_DIR"

echo "Pulling latest code..."
git pull origin main

echo "Building client..."
cd client
npm ci
npm run build

echo "Installing server dependencies..."
cd ../server
npm ci --omit=dev

echo "Restarting application..."
pm2 restart to-do-agent || pm2 start src/index.js --name to-do-agent

echo "Deploy complete. Waiting for health check..."
sleep 5
curl -sf http://localhost:5000/health && echo " OK" || echo " FAILED"
