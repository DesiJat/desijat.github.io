#!/usr/bin/env bash
# Interactive Menu for Session & Daily Task Tracker
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while true; do
    echo ""
    echo "=================================================="
    echo "       🚀 WORK & SESSION TRACKER MENU             "
    echo "=================================================="
    echo " 1) 📸 Save Snapshot (Save VS Code, Antigravity, Chrome, Tasks)"
    echo " 2) 🔄 Restore Latest Session (Reopen everything)"
    echo " 3) 🔍 View Current Live Activity (Status)"
    echo " 4) 📜 List Saved Snapshots"
    echo " 5) 📋 View Today's Tasks & Notes"
    echo " 6) ➕ Add a New Task"
    echo " 7) ✅ Mark Task Completed"
    echo " 8) 💡 Add a Quick Note / Blocker"
    echo " 9) 🧪 Dry-Run Restore (Preview without launching)"
    echo " 0) 🚪 Exit"
    echo "=================================================="
    echo -n "Choose an option [0-9]: "
    read -r choice

    case "$choice" in
        1)
            echo ""
            echo -n "Enter a label/note (or press ENTER for 'manual'): "
            read -r lbl
            lbl="${lbl:-manual}"
            python3 "$DIR/track.py" snapshot "$lbl"
            ;;
        2)
            echo ""
            python3 "$DIR/track.py" restore latest
            ;;
        3)
            echo ""
            python3 "$DIR/track.py" status
            ;;
        4)
            echo ""
            python3 "$DIR/track.py" list
            ;;
        5)
            echo ""
            python3 "$DIR/track.py" task list
            ;;
        6)
            echo ""
            echo -n "Enter task title: "
            read -r title
            if [ -n "$title" ]; then
                echo -n "Priority (normal/high/low) [normal]: "
                read -r prio
                prio="${prio:-normal}"
                python3 "$DIR/track.py" task add "$title" -p "$prio"
            fi
            ;;
        7)
            echo ""
            python3 "$DIR/track.py" task list
            echo -n "Enter Task ID to mark as done: "
            read -r tid
            if [ -n "$tid" ]; then
                python3 "$DIR/track.py" task done "$tid"
            fi
            ;;
        8)
            echo ""
            echo -n "Enter note / blocker: "
            read -r ntext
            if [ -n "$ntext" ]; then
                python3 "$DIR/track.py" note "$ntext"
            fi
            ;;
        9)
            echo ""
            python3 "$DIR/track.py" restore latest --dry-run
            ;;
        0|q|Q)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo "Invalid option. Please choose [0-9]."
            ;;
    esac
done
