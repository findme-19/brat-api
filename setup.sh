#!/bin/bash
# Brat API - setup script (Linux / macOS)
set -e

echo "==> Brat API setup"

# Node >= 18 required
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js not found. Install Node 18+ first: https://nodejs.org"
  exit 1
fi
echo "Node: $(node -v)"

# Install npm deps
echo "==> npm install"
npm install

# Playwright chromium + system deps (needs sudo on Linux)
echo "==> playwright install chromium"
npx playwright install chromium
if command -v apt-get >/dev/null 2>&1; then
  echo "==> playwright system deps (Linux, needs sudo)"
  sudo npx playwright install-deps chromium || echo "warn: install-deps failed; if chromium won't run, run: sudo npx playwright install-deps chromium"
fi

# ffmpeg (needed for /bratvid, /bratvid-realtime, /canvas)
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "==> ffmpeg not found, attempting install"
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y ffmpeg
  elif command -v brew >/dev/null 2>&1; then
    brew install ffmpeg
  else
    echo "warn: install ffmpeg manually (video endpoints need it)"
  fi
else
  echo "ffmpeg: $(ffmpeg -version 2>/dev/null | head -1)"
fi

echo ""
echo "==> Setup done. Run with:"
echo "    npm start          # production (node app.js)"
echo "    npm run dev        # dev (same, PORT env optional)"
echo "    pm2 start app.js --name brat   # background via PM2"
echo ""
echo "    Open http://localhost:3000/dashboard for the live playground."
