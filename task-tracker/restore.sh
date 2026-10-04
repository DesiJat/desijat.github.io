#!/usr/bin/env bash
# Restore session (reopen VS Code workspaces, Antigravity workspaces, Chrome tabs)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-latest}"

echo "🔄 Restoring session '$TARGET'..."
python3 "$DIR/track.py" restore "$TARGET"
