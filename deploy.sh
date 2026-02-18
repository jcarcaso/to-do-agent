#!/usr/bin/env bash
set -euo pipefail

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
