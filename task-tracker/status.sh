#!/usr/bin/env bash
# Show current live activity without saving
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$DIR/track.py" status
