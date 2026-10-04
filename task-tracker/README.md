# 🚀 Work & Session Tracker (`track`)

A lightweight, self-contained tool to track daily tasks, inspect all running developer activity, and snapshot/restore your entire work state across **VS Code**, **Antigravity IDE**, and **Google Chrome**.

> **100% Self-Contained & Cross-Platform (macOS & Linux)**: 
> Everything lives strictly inside this folder (`/Users/apple/data/task-tracker`). No system-wide interference, no external dependencies (uses standard Python 3). Works on **macOS** and **Linux (Ubuntu, Debian, Fedora, Arch, etc.)**.

---

## ⚡ The Problem Solved

When working on multiple projects, you often have:
- 2, 3, or more projects open in **VS Code**.
- 2, 3, or more projects open in **Antigravity IDE**.
- Multiple windows and dozens of tabs open in **Google Chrome**.
- Active **Git** branches with uncommitted work in progress.
- Daily tasks and mental notes of what you were doing.

When you shut down or reboot your Mac, **you lose your context and forget what was open and what you were doing**.

**Work & Session Tracker solves this in 1 command:**
1. **Before shutdown / break**: Run `./snapshot.sh` (or `./track snapshot`). It saves all open VS Code workspaces, Antigravity workspaces, Chrome tabs with URLs & titles, active Git status, and daily tasks.
2. **After reboot / next morning**: Run `./restore.sh` (or `./track restore`). It reopens all VS Code workspaces in their windows, reopens Antigravity workspaces, reopens Google Chrome tabs, and prints your tasks so you immediately resume right where you left off!

---

## 🏁 Quick Start (Ready to Use)

All scripts are directly executable from this folder:

```bash
cd /Users/apple/data/task-tracker
```

### 1. Interactive Menu (Easiest)
```bash
./menu.sh
```
Launches an interactive menu with options 0–9 for snapshot, restore, task management, status inspection, and notes.

### 2. Check What's Open Right Now (Live Status)
```bash
./status.sh
# or
./track status
```

### 3. Save a Session Snapshot Before Shutdown
```bash
./snapshot.sh
# or
./track snapshot "end-of-day"
```

### 4. Restore Everything After Starting Your Mac
```bash
./restore.sh
# or
./track restore
```

---

## 📋 Daily Task & Notes Management

Keep track of your day's work and thoughts:

```bash
# Add a task
./track task add "Fix Browse Folder Error in colab" -p high
./track task add "Update desijat.github.io readBook feature"

# Mark task as in-progress
./track task doing 2

# Mark task as completed
./track task done 1

# List today's tasks
./track task list

# Add a quick note or blocker to your worklog
./track note "Blocked waiting for Colab VM quota reset"
```

---

## 💻 CLI Commands Reference

| Command | Description |
|---|---|
| `./track status` | Inspect live open VS Code, Antigravity, Chrome tabs & tasks |
| `./track snapshot [label]` | Save complete session snapshot with an optional label |
| `./track list` | List all saved historical snapshots |
| `./track show [id]` | Show detailed breakdown of a specific snapshot |
| `./track restore [id]` | Reopen all projects and Chrome tabs from snapshot |
| `./track restore --dry-run` | Preview what would be reopened without actually opening |
| `./track restore --vscode` | Restore only VS Code projects |
| `./track restore --antigravity` | Restore only Antigravity projects |
| `./track restore --chrome` | Restore only Chrome tabs |
| `./track task add <title>` | Add a new task for today (`-p high/normal/low`) |
| `./track task list` | View today's task list |
| `./track task doing <id>` | Mark task as in-progress (`🔨`) |
| `./track task done <id>` | Mark task as completed (`✅`) |
| `./track task rm <id>` | Delete a task |
| `./track note "<text>"` | Add a quick timestamped note / blocker |
| `./track export` | Export today's full session report to a markdown file |

---

## 📁 Automatic Worklogs & Storage Structure

All state is saved strictly inside this directory:

```
/Users/apple/data/task-tracker/
├── track.py              # Main Python engine
├── track                 # Executable launcher (./track)
├── snapshot.sh           # 1-click snapshot script
├── restore.sh            # 1-click restore script
├── status.sh             # 1-click live status script
├── menu.sh               # Interactive terminal menu
├── CURRENT_SESSION.md    # Auto-updating markdown overview of current state
├── DAILY_WORKLOG.md      # Auto-updating daily journal of tasks and snapshots
└── storage/              # Local data storage
    ├── snapshots/        # Saved JSON snapshots with timestamps
    └── tasks/            # Daily task JSON records (YYYY-MM-DD.json)
```

You can view `CURRENT_SESSION.md` or `DAILY_WORKLOG.md` directly in VS Code / Antigravity or any Markdown reader at any time!
