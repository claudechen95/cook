#!/bin/bash
# Build the app and publish it to the always-on local service.
#
# The service runs from ~/srv/cook, not from this worktree, so that editing or
# switching branches here never disturbs the running app - and so the dev-server
# git guard doesn't treat it as a watcher of this worktree.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$HOME/srv/cook"
LABEL="com.cook.server"

cd "$REPO"

echo "→ building"
npm run build

echo "→ publishing to $TARGET"
rm -rf "$TARGET"
mkdir -p "$TARGET/.next"
cp -R .next/standalone/. "$TARGET"/
cp -R .next/static "$TARGET/.next/static"
[ -d public ] && cp -R public "$TARGET/public"
# Runtime secrets + YT_DLP_PATH; the standalone server reads .env.local from its cwd.
cp .env.local "$TARGET/.env.local"

if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo "→ restarting service"
  launchctl kickstart -k "gui/$(id -u)/$LABEL"
  sleep 3
  curl -fsS -o /dev/null "http://localhost:3100" && echo "→ serving on http://localhost:3100"
else
  echo "→ service not installed yet; run:"
  echo "    cp scripts/com.cook.server.plist ~/Library/LaunchAgents/"
  echo "    launchctl bootstrap gui/\$(id -u) ~/Library/LaunchAgents/com.cook.server.plist"
fi
