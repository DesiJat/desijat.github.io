#!/usr/bin/env bash
# Snapshot current session (VS Code, Antigravity, Chrome, Git, Tasks)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="${1:-}"

if [ -z "$LABEL" ]; then
    echo "💡 Enter a label/note for this snapshot (or press ENTER for 'manual'):"
    read -r USER_LABEL
    if [ -n "$USER_LABEL" ]; then
        LABEL="$USER_LABEL"
    else
        LABEL="manual"
    fi
fi

python3 "$DIR/track.py" snapshot "$LABEL"
