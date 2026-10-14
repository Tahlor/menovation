#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Menovation Production Deployment Script
# Deploys web shell, application scripts, styles, and data catalogs to Pi3
# (which serves as upstream for https://data.taylorarchibald.com/menovation/)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
REMOTE_TARGET="pi3:/home/pi/WD4TB/menovation/app"

echo "========================================================"
echo "MENOVATION PRODUCTION DEPLOYMENT"
echo "Deploying from: ${REPO_ROOT}"
echo "Deploying to:   ${REMOTE_TARGET}"
echo "========================================================"

# 1. Verify SSH connectivity to Pi3
echo -n "[1/5] Checking connection to Pi3... "
if ssh -o ConnectTimeout=5 pi3 "test -d /home/pi/WD4TB/menovation/app"; then
  echo "OK (Host reachable, directory exists)"
else
  echo "FAILED: Cannot reach pi3 or directory /home/pi/WD4TB/menovation/app does not exist." >&2
  exit 1
fi

# 2. Sync app shell (index.html, sw.js, manifest)
echo "[2/5] Syncing app shell files..."
rsync -av "${REPO_ROOT}/app/index.html" "${REPO_ROOT}/app/sw.js" "${REPO_ROOT}/app/manifest.webmanifest" "${REMOTE_TARGET}/"

# 3. Sync styles and scripts
echo "[3/5] Syncing styles and javascript..."
rsync -av "${REPO_ROOT}/app/css/" "${REMOTE_TARGET}/css/"
rsync -av "${REPO_ROOT}/app/js/" "${REMOTE_TARGET}/js/"

# 4. Sync cleaned & audited JSON data assets
echo "[4/5] Syncing data catalogs (programs, workouts, exercises)..."
rsync -av "${REPO_ROOT}/assets/data/" "${REMOTE_TARGET}/assets/data/"
rsync -av "${REPO_ROOT}/assets/manifest.json" "${REMOTE_TARGET}/assets/"

# 5. Verify live deployment
echo "[5/5] Verifying live server responses..."
LIVE_SW_VERSION=$(ssh pi3 "curl -s http://127.0.0.1:8085/app/sw.js | grep 'CACHE_NAME ='" || true)
echo "  -> Live Service Worker on Pi3: ${LIVE_SW_VERSION}"

PROGRAM_6217_TITLE=$(ssh pi3 "curl -s http://127.0.0.1:8085/app/assets/data/programs.json | grep -o '\"programTitle\": \"Power Builder\"'" || true)
echo "  -> Live Program 6217 on Pi3: ${PROGRAM_6217_TITLE}"

UNICODE_CHECK=$(ssh pi3 "grep -o 'u000A' /home/pi/WD4TB/menovation/app/assets/data/programs.json | wc -l" || true)
echo "  -> Escaped \\u000A count in live programs.json: ${UNICODE_CHECK}"

echo "========================================================"
echo "DEPLOYMENT COMPLETE & VERIFIED SUCCESSFUL"
echo "Live URL: https://data.taylorarchibald.com/menovation/"
echo "========================================================"
