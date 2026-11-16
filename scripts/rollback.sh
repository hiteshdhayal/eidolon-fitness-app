#!/usr/bin/env bash
# Points "current" back at the release before the one it points at now.
# Run from your local machine, same as deploy.sh.
#
# Usage: scripts/rollback.sh [user@host]
set -euo pipefail

HOST="${1:-${DEPLOY_HOST:-deploy@eidolon.cloud}}"
REMOTE_ROOT="/var/www/eidolon.cloud"

echo "==> Looking up releases on $HOST"
PREVIOUS_RELEASE="$(ssh "$HOST" bash -s <<EOF
set -euo pipefail
cd '$REMOTE_ROOT/releases'
current_target="\$(readlink -f '$REMOTE_ROOT/current')"
current_name="\$(basename "\$current_target")"
ls -1t | grep -vxF "\$current_name" | head -n 1
EOF
)"

if [ -z "$PREVIOUS_RELEASE" ]; then
  echo "No earlier release found on $HOST — nothing to roll back to." >&2
  exit 1
fi

echo "==> Rolling back to $PREVIOUS_RELEASE"
ssh "$HOST" "ln -sfn '$REMOTE_ROOT/releases/$PREVIOUS_RELEASE' '$REMOTE_ROOT/current.tmp' && mv -T '$REMOTE_ROOT/current.tmp' '$REMOTE_ROOT/current'"

echo "==> Rolled back. Current release is now $PREVIOUS_RELEASE"
