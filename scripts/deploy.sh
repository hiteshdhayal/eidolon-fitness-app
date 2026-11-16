#!/usr/bin/env bash
# Builds the site and ships it to the VPS as a new release, then atomically
# swaps the "current" symlink. Run this FROM YOUR LOCAL MACHINE or CI, not on
# the server — it builds locally/in CI and rsyncs the finished dist/ over.
#
# Usage: scripts/deploy.sh [user@host]
#   Defaults to the DEPLOY_HOST env var, or deploy@eidolon.cloud.
#
# Layout on the server (see docs/DEPLOY.md):
#   /var/www/eidolon.cloud/releases/<timestamp>/   one per deploy
#   /var/www/eidolon.cloud/current -> releases/<timestamp>  (symlink, atomic)
#   /var/www/eidolon.cloud/shared/                untouched across deploys (unused today; reserved)
set -euo pipefail

HOST="${1:-${DEPLOY_HOST:-deploy@eidolon.cloud}}"
REMOTE_ROOT="/var/www/eidolon.cloud"
KEEP_RELEASES=5
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)"
RELEASE_DIR="$REMOTE_ROOT/releases/$RELEASE_ID"

echo "==> Building production site"
pnpm install --frozen-lockfile
pnpm build

if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
  echo "dist/ is missing or empty after build — aborting." >&2
  exit 1
fi

echo "==> Creating release directory on $HOST"
ssh "$HOST" "mkdir -p '$RELEASE_DIR'"

echo "==> Syncing dist/ to $RELEASE_DIR"
rsync -az --delete dist/ "$HOST:$RELEASE_DIR/"

echo "==> Swapping the current symlink atomically"
ssh "$HOST" "ln -sfn '$RELEASE_DIR' '$REMOTE_ROOT/current.tmp' && mv -T '$REMOTE_ROOT/current.tmp' '$REMOTE_ROOT/current'"

echo "==> Pruning old releases (keeping newest $KEEP_RELEASES)"
ssh "$HOST" "cd '$REMOTE_ROOT/releases' && ls -1t | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf --"

echo "==> Deployed release $RELEASE_ID"
echo "    Rollback with: scripts/rollback.sh $HOST"
