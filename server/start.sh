#!/usr/bin/env bash
set -euo pipefail

# Load nvm so node/npm are on PATH (needed for systemd which has a minimal env)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Resolve the repo root (one level up from server/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$REPO_DIR/.env" ]; then
  set -a
  source "$REPO_DIR/.env"
  set +a
else
  echo "ERROR: .env file not found at $REPO_DIR/.env" >&2
  exit 1
fi

# Build client
echo "Building client..."
cd "$REPO_DIR/client"
npm run build

# Start server
echo "Starting server..."
cd "$REPO_DIR/server"
exec node src/index.js
