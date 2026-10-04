#!/usr/bin/env python3
"""
Work & Session Tracker (track)
Tracks daily tasks, active VS Code workspaces, Antigravity IDE workspaces,
Google Chrome tabs/windows, git status, and allows 1-command session snapshot & restoration.
"""

import sys
import os
import re
import json
import shlex
import shutil
import argparse
import subprocess
import urllib.parse
from datetime import datetime
from pathlib import Path

# --- ANSI Colors ---
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    ITALIC = "\033[3m"
    UNDERLINE = "\033[4m"

    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"

    BG_BLUE = "\033[44m"
    BG_MAGENTA = "\033[45m"
    BG_CYAN = "\033[46m"
    BG_GRAY = "\033[100m"

def c(text, color):
    if not sys.stdout.isatty():
        return str(text)
    return f"{color}{text}{Colors.RESET}"

# --- Platform & Paths ---
IS_MACOS = sys.platform.startswith("darwin")
IS_LINUX = sys.platform.startswith("linux")

WORKSPACE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = WORKSPACE_DIR / "storage"
HOME = Path.home()

CODE_APP_BIN = "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
ANTIGRAVITY_APP_BIN = "/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide"

def get_vscode_storage_files():
    paths = []
    if IS_MACOS:
        paths.append(HOME / "Library/Application Support/Code/User/globalStorage/storage.json")
    else:
        paths.append(HOME / ".config/Code/User/globalStorage/storage.json")
        paths.append(HOME / ".config/Code - OSS/User/globalStorage/storage.json")
        paths.append(HOME / ".var/app/com.visualstudio.code/config/Code/User/globalStorage/storage.json")
    return [p for p in paths if p.exists()]

def get_antigravity_storage_files():
    paths = []
    if IS_MACOS:
        paths.append(HOME / "Library/Application Support/Antigravity IDE/User/globalStorage/storage.json")
        paths.append(HOME / "Library/Application Support/Antigravity/User/globalStorage/storage.json")
    else:
        paths.append(HOME / ".config/Antigravity IDE/User/globalStorage/storage.json")
        paths.append(HOME / ".config/Antigravity/User/globalStorage/storage.json")
        paths.append(HOME / ".config/antigravity/User/globalStorage/storage.json")
        paths.append(HOME / ".gemini/antigravity-ide/User/globalStorage/storage.json")
    return [p for p in paths if p.exists()]

def get_code_command():
    if shutil.which("code"):
        return ["code"]
    if IS_MACOS and os.path.exists(CODE_APP_BIN):
        return [CODE_APP_BIN]
    return ["code"]

def get_antigravity_command():
    for bin_name in ["antigravity-ide", "antigravity"]:
        if shutil.which(bin_name):
            return [bin_name]
    if IS_MACOS and os.path.exists(ANTIGRAVITY_APP_BIN):
        return [ANTIGRAVITY_APP_BIN]
    return ["antigravity-ide"]

def get_chrome_command():
    for cmd in ["google-chrome", "google-chrome-stable", "chromium-browser", "chromium"]:
        if shutil.which(cmd):
            return cmd
    return "google-chrome"


def get_data_dir():
    override = os.environ.get("TRACK_DATA_DIR")
    if override:
        path = Path(override)
    else:
        path = DEFAULT_DATA_DIR
    path.mkdir(parents=True, exist_ok=True)
    (path / "snapshots").mkdir(exist_ok=True)
    (path / "tasks").mkdir(exist_ok=True)
    return path


def today_str():
    return datetime.now().strftime("%Y-%m-%d")


def timestamp_str():
    return datetime.now().strftime("%Y-%m-%d_%H-%M-%S")


def readable_time(dt_str=None):
    if dt_str:
        try:
            dt = datetime.fromisoformat(dt_str)
            return dt.strftime("%b %d, %Y %I:%M %p")
        except Exception:
            return dt_str
    return datetime.now().strftime("%b %d, %Y %I:%M %p")


# --- Task Manager ---
def get_task_file(date_key=None):
    if not date_key:
        date_key = today_str()
    data_dir = get_data_dir()
    return data_dir / "tasks" / f"{date_key}.json"


def load_tasks(date_key=None):
    task_file = get_task_file(date_key)
    if task_file.exists():
        try:
            with open(task_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"date": date_key or today_str(), "tasks": [], "notes": []}


def save_tasks(task_data, date_key=None):
    task_file = get_task_file(date_key)
    with open(task_file, "w", encoding="utf-8") as f:
        json.dump(task_data, f, indent=2, ensure_ascii=False)


def add_task(title, priority="normal"):
    data = load_tasks()
    task_id = len(data["tasks"]) + 1
    new_task = {
        "id": task_id,
        "title": title.strip(),
        "status": "pending",  # pending, doing, done
        "priority": priority, # low, normal, high
        "created_at": datetime.now().isoformat(),
        "completed_at": None,
    }
    data["tasks"].append(new_task)
    save_tasks(data)
    update_markdown_logs()
    return new_task


def update_task_status(task_id, new_status):
    data = load_tasks()
    found = False
    for t in data["tasks"]:
        if t["id"] == task_id:
            t["status"] = new_status
            if new_status == "done":
                t["completed_at"] = datetime.now().isoformat()
            else:
                t["completed_at"] = None
            found = True
            break
    if found:
        save_tasks(data)
        update_markdown_logs()
    return found


def delete_task(task_id):
    data = load_tasks()
    initial_len = len(data["tasks"])
    data["tasks"] = [t for t in data["tasks"] if t["id"] != task_id]
    # Re-index
    for idx, t in enumerate(data["tasks"], start=1):
        t["id"] = idx
    save_tasks(data)
    update_markdown_logs()
    return len(data["tasks"]) < initial_len


def add_note(note_text):
    data = load_tasks()
    new_note = {
        "id": len(data.get("notes", [])) + 1,
        "text": note_text.strip(),
        "created_at": datetime.now().isoformat()
    }
    if "notes" not in data:
        data["notes"] = []
    data["notes"].append(new_note)
    save_tasks(data)
    update_markdown_logs()
    return new_note


# --- Activity Extractors ---
def uri_to_path(uri):
    if not uri:
        return ""
    if uri.startswith("file://"):
        parsed = urllib.parse.urlparse(uri)
        return urllib.parse.unquote(parsed.path)
    return uri


def get_git_info(folder_path):
    p = Path(folder_path)
    if not (p / ".git").exists():
        return None
    try:
        # Branch
        res_branch = subprocess.run(
            ["git", "-C", folder_path, "branch", "--show-current"],
            capture_output=True, text=True, timeout=2
        )
        branch = res_branch.stdout.strip() or "HEAD (detached)"

        # Status
        res_status = subprocess.run(
            ["git", "-C", folder_path, "status", "--porcelain"],
            capture_output=True, text=True, timeout=2
        )
        status_lines = [l for l in res_status.stdout.splitlines() if l.strip()]
        dirty = len(status_lines) > 0
        untracked = sum(1 for l in status_lines if l.startswith("??"))
        modified = len(status_lines) - untracked

        # Last commit
        res_log = subprocess.run(
            ["git", "-C", folder_path, "log", "-1", "--pretty=format:%s (%cr)"],
            capture_output=True, text=True, timeout=2
        )
        last_commit = res_log.stdout.strip()

        return {
            "is_git": True,
            "branch": branch,
            "dirty": dirty,
            "modified_count": modified,
            "untracked_count": untracked,
            "total_changes": len(status_lines),
            "last_commit": last_commit,
            "status_samples": status_lines[:5]
        }
    except Exception:
        return {"is_git": True, "error": "Could not query git"}


def extract_vscode_workspaces():
    results = []
    seen = set()
    for storage_file in get_vscode_storage_files():
        try:
            with open(storage_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            bw = data.get("backupWorkspaces", {})
            for item in bw.get("folders", []):
                uri = item.get("folderUri")
                path = uri_to_path(uri)
                if path and path not in seen and os.path.exists(path):
                    seen.add(path)
                    git_info = get_git_info(path)
                    results.append({
                        "name": os.path.basename(path),
                        "path": path,
                        "type": "folder",
                        "git": git_info
                    })
            for item in bw.get("workspaces", []):
                uri = item.get("workspaceUri") or item.get("configPath")
                path = uri_to_path(uri)
                if path and path not in seen and os.path.exists(path):
                    seen.add(path)
                    results.append({
                        "name": os.path.basename(path),
                        "path": path,
                        "type": "workspace",
                        "git": get_git_info(os.path.dirname(path))
                    })
        except Exception:
            pass
    return results


def extract_antigravity_workspaces():
    results = []
    seen = set()
    for storage_file in get_antigravity_storage_files():
        try:
            with open(storage_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            bw = data.get("backupWorkspaces", {})
            for item in bw.get("folders", []):
                uri = item.get("folderUri")
                path = uri_to_path(uri)
                if path and path not in seen and os.path.exists(path):
                    seen.add(path)
                    git_info = get_git_info(path)
                    results.append({
                        "name": os.path.basename(path),
                        "path": path,
                        "type": "folder",
                        "git": git_info
                    })
            for item in bw.get("workspaces", []):
                uri = item.get("workspaceUri") or item.get("configPath")
                path = uri_to_path(uri)
                if path and path not in seen and os.path.exists(path):
                    seen.add(path)
                    results.append({
                        "name": os.path.basename(path),
                        "path": path,
                        "type": "workspace",
                        "git": get_git_info(os.path.dirname(path))
                    })
        except Exception:
            pass
    return results


def extract_chrome_tabs_macos():
    script = """
    tell application "System Events"
        set isRunning to (count of (every process whose name is "Google Chrome")) > 0
    end tell
    if isRunning then
        tell application "Google Chrome"
            set outText to ""
            set winIndex to 1
            repeat with w in windows
                set tabIndex to 1
                repeat with t in tabs of w
                    set outText to outText & winIndex & "|||" & tabIndex & "|||" & (title of t) & "|||" & (URL of t) & linefeed
                    set tabIndex to tabIndex + 1
                end repeat
                set winIndex to winIndex + 1
            end repeat
            return outText
        end tell
    else
        return ""
    end if
    """
    try:
        res = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=5)
        raw = res.stdout.strip()
        if not raw:
            return []
        windows_map = {}
        for line in raw.splitlines():
            parts = line.split("|||")
            if len(parts) >= 4:
                w_idx = int(parts[0])
                t_idx = int(parts[1])
                title = parts[2].strip()
                url = parts[3].strip()
                if w_idx not in windows_map:
                    windows_map[w_idx] = []
                windows_map[w_idx].append({
                    "tab_index": t_idx,
                    "title": title or url,
                    "url": url
                })
        
        results = []
        for w_idx in sorted(windows_map.keys()):
            results.append({
                "window_index": w_idx,
                "tabs": windows_map[w_idx]
            })
        return results
    except Exception:
        return []


def extract_chrome_tabs_linux():
    # Attempt to read active URLs from Chrome/Chromium sessions folder on Linux
    candidate_dirs = [
        HOME / ".config/google-chrome/Default/Sessions",
        HOME / ".config/chromium/Default/Sessions",
        HOME / ".config/google-chrome-beta/Default/Sessions",
        HOME / ".config/BraveSoftware/Brave-Browser/Default/Sessions"
    ]
    tabs = []
    seen = set()
    for s_dir in candidate_dirs:
        if s_dir.exists():
            for f in sorted(s_dir.glob("Tabs_*"), key=lambda p: p.stat().st_mtime, reverse=True)[:1]:
                try:
                    with open(f, "rb") as bf:
                        content = bf.read().decode("latin1", errors="ignore")
                    matches = re.findall(r"https?://[^\s\x00-\x1f\"\'<>]+", content)
                    for u in matches:
                        if len(u) > 10 and u not in seen and not any(u.endswith(ext) for ext in [".png", ".jpg", ".js", ".css"]):
                            seen.add(u)
                            tabs.append({
                                "tab_index": len(tabs) + 1,
                                "title": u,
                                "url": u
                            })
                except Exception:
                    pass
    if tabs:
        return [{"window_index": 1, "tabs": tabs}]
    return []


def extract_chrome_tabs():
    if IS_MACOS:
        return extract_chrome_tabs_macos()
    return extract_chrome_tabs_linux()


def capture_current_session(label="manual"):
    vscode_ws = extract_vscode_workspaces()
    antigravity_ws = extract_antigravity_workspaces()
    chrome_windows = extract_chrome_tabs()
    tasks_data = load_tasks()

    total_tabs = sum(len(w.get("tabs", [])) for w in chrome_windows)

    snapshot = {
        "id": timestamp_str(),
        "created_at": datetime.now().isoformat(),
        "label": label,
        "vscode": {
            "count": len(vscode_ws),
            "projects": vscode_ws
        },
        "antigravity": {
            "count": len(antigravity_ws),
            "projects": antigravity_ws
        },
        "chrome": {
            "window_count": len(chrome_windows),
            "tab_count": total_tabs,
            "windows": chrome_windows
        },
        "tasks": tasks_data.get("tasks", []),
        "notes": tasks_data.get("notes", [])
    }
    return snapshot


# --- Snapshot Storage ---
def save_snapshot(snapshot):
    data_dir = get_data_dir()
    filepath = data_dir / "snapshots" / f"{snapshot['id']}.json"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2, ensure_ascii=False)
    
    # Save latest pointer
    latest_file = data_dir / "snapshots" / "latest.json"
    with open(latest_file, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2, ensure_ascii=False)
    
    update_markdown_logs()
    return filepath


def load_snapshot(snapshot_id=None):
    data_dir = get_data_dir()
    if not snapshot_id or snapshot_id in ["latest", "last"]:
        target = data_dir / "snapshots" / "latest.json"
    else:
        if not snapshot_id.endswith(".json"):
            target = data_dir / "snapshots" / f"{snapshot_id}.json"
        else:
            target = data_dir / "snapshots" / snapshot_id

    if not target.exists():
        return None
    try:
        with open(target, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def list_snapshots():
    data_dir = get_data_dir()
    snapshots_dir = data_dir / "snapshots"
    snapshots = []
    for p in sorted(snapshots_dir.glob("*.json"), reverse=True):
        if p.name == "latest.json":
            continue
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                snapshots.append({
                    "id": data.get("id", p.stem),
                    "created_at": data.get("created_at"),
                    "label": data.get("label", ""),
                    "vscode_count": data.get("vscode", {}).get("count", 0),
                    "antigravity_count": data.get("antigravity", {}).get("count", 0),
                    "chrome_tabs": data.get("chrome", {}).get("tab_count", 0),
                    "tasks_count": len(data.get("tasks", []))
                })
        except Exception:
            continue
    return snapshots


# --- Markdown Generation ---
def update_markdown_logs():
    data_dir = get_data_dir()
    latest_snapshot = load_snapshot("latest")
    today_tasks = load_tasks()

    # 1. CURRENT_SESSION.md
    cs_path = data_dir / "CURRENT_SESSION.md"
    workspace_cs_path = WORKSPACE_DIR / "CURRENT_SESSION.md"
    
    content = []
    content.append("# 🚀 Current Working Session & Activity State")
    content.append(f"> **Last Updated:** {readable_time()}\n")

    # Tasks Section
    content.append("## 📋 Daily Tasks")
    tasks = today_tasks.get("tasks", [])
    if tasks:
        for t in tasks:
            status_icon = "✅" if t["status"] == "done" else ("🔨" if t["status"] == "doing" else "⏳")
            prio = f"`[{t.get('priority', 'normal').upper()}]`" if t.get("priority") != "normal" else ""
            content.append(f"- {status_icon} **#{t['id']}** {prio} {t['title']} *({t['status']})*")
    else:
        content.append("_No tasks logged yet today._")
    content.append("")

    # Notes Section
    notes = today_tasks.get("notes", [])
    if notes:
        content.append("## 💡 Quick Notes / Blockers")
        for n in notes:
            created = readable_time(n.get("created_at"))
            content.append(f"- **[{created}]** {n['text']}")
        content.append("")

    # Snapshot context
    if latest_snapshot:
        content.append("## 💻 Last Saved Open Workspaces & Activity")
        content.append(f"**Snapshot ID:** `{latest_snapshot.get('id')}` | **Label:** `{latest_snapshot.get('label')}`\n")
        
        # VS Code
        vscode_list = latest_snapshot.get("vscode", {}).get("projects", [])
        content.append(f"### Visual Studio Code Projects ({len(vscode_list)})")
        if vscode_list:
            for p in vscode_list:
                git = p.get("git")
                git_str = ""
                if git and git.get("is_git"):
                    branch = git.get("branch", "unknown")
                    changes = git.get("total_changes", 0)
                    dirty_badge = f"⚠️ {changes} uncommitted files" if changes > 0 else "clean"
                    git_str = f" `[git: {branch} ({dirty_badge})]`"
                content.append(f"- **{p['name']}** `{p['path']}`{git_str}")
        else:
            content.append("- _None open_")
        content.append("")

        # Antigravity
        anti_list = latest_snapshot.get("antigravity", {}).get("projects", [])
        content.append(f"### Antigravity IDE Projects ({len(anti_list)})")
        if anti_list:
            for p in anti_list:
                git = p.get("git")
                git_str = ""
                if git and git.get("is_git"):
                    branch = git.get("branch", "unknown")
                    changes = git.get("total_changes", 0)
                    dirty_badge = f"⚠️ {changes} uncommitted files" if changes > 0 else "clean"
                    git_str = f" `[git: {branch} ({dirty_badge})]`"
                content.append(f"- **{p['name']}** `{p['path']}`{git_str}")
        else:
            content.append("- _None open_")
        content.append("")

        # Chrome Tabs
        chrome_windows = latest_snapshot.get("chrome", {}).get("windows", [])
        tab_total = latest_snapshot.get("chrome", {}).get("tab_count", 0)
        content.append(f"### 🌐 Google Chrome Open Tabs ({tab_total} tabs in {len(chrome_windows)} windows)")
        if chrome_windows:
            for w in chrome_windows:
                content.append(f"#### Window {w.get('window_index')}")
                for t in w.get("tabs", []):
                    title = t.get("title") or t.get("url")
                    content.append(f"- [{title}]({t.get('url')})")
        else:
            content.append("- _No Chrome tabs captured_")
        content.append("")

    cs_text = "\n".join(content)
    try:
        with open(cs_path, "w", encoding="utf-8") as f:
            f.write(cs_text)
        with open(workspace_cs_path, "w", encoding="utf-8") as f:
            f.write(cs_text)
    except Exception:
        pass

    # 2. DAILY_WORKLOG.md
    dw_path = WORKSPACE_DIR / "DAILY_WORKLOG.md"
    log_content = []
    log_content.append(f"# 📅 Daily Work Journal — {today_str()}")
    log_content.append(f"> Auto-maintained worklog of tasks, notes, and activity snapshots.\n")

    # Tasks
    log_content.append("## 📋 Tasks for Today")
    if tasks:
        for t in tasks:
            status_icon = "✅" if t["status"] == "done" else ("🔨" if t["status"] == "doing" else "⏳")
            prio = f"`[{t.get('priority', 'normal').upper()}]`" if t.get("priority") != "normal" else ""
            log_content.append(f"- {status_icon} **#{t['id']}** {prio} {t['title']} *({t['status']})*")
    else:
        log_content.append("_No tasks recorded today._")
    log_content.append("")

    # Notes
    if notes:
        log_content.append("## 💡 Notes & Blockers")
        for n in notes:
            created = readable_time(n.get("created_at"))
            log_content.append(f"- **[{created}]** {n['text']}")
        log_content.append("")

    # Snapshots taken today
    all_snaps = list_snapshots()
    today_snaps = [s for s in all_snaps if s["id"].startswith(today_str())]
    log_content.append(f"## 🕒 Saved Snapshots Today ({len(today_snaps)})")
    if today_snaps:
        for s in today_snaps:
            log_content.append(f"- **`{s['id']}`** — Label: *{s['label']}* (VS Code: {s['vscode_count']}, Antigravity: {s['antigravity_count']}, Chrome: {s['chrome_tabs']} tabs)")
    else:
        log_content.append("_No snapshots saved today yet._")
    log_content.append("")

    try:
        with open(dw_path, "w", encoding="utf-8") as f:
            f.write("\n".join(log_content))
    except Exception:
        pass


# --- Restoration Logic ---
def restore_session(snapshot, restore_vscode=True, restore_antigravity=True, restore_chrome=True, dry_run=False):
    print(c("\n⚡ Initiating Workspace & Session Restoration...", Colors.BOLD + Colors.CYAN))
    print(c(f"Snapshot: {snapshot.get('id')} | Label: {snapshot.get('label')}", Colors.DIM))
    print("-" * 65)

    # 1. VS Code Projects
    if restore_vscode:
        vscode_projects = snapshot.get("vscode", {}).get("projects", [])
        print(c(f"\n💻 VS Code Workspaces to Reopen ({len(vscode_projects)}):", Colors.BOLD + Colors.BLUE))
        for p in vscode_projects:
            path = p["path"]
            if not os.path.exists(path):
                print(c(f"  [MISSING] {path}", Colors.YELLOW))
                continue
            print(c(f"  ➜ Reopening: {p['name']} ({path})", Colors.GREEN))
            if not dry_run:
                code_cmd = get_code_command()
                subprocess.Popen(code_cmd + ["-n", path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 2. Antigravity Projects
    if restore_antigravity:
        anti_projects = snapshot.get("antigravity", {}).get("projects", [])
        print(c(f"\n🚀 Antigravity IDE Workspaces to Reopen ({len(anti_projects)}):", Colors.BOLD + Colors.MAGENTA))
        for p in anti_projects:
            path = p["path"]
            if not os.path.exists(path):
                print(c(f"  [MISSING] {path}", Colors.YELLOW))
                continue
            print(c(f"  ➜ Reopening: {p['name']} ({path})", Colors.GREEN))
            if not dry_run:
                anti_cmd = get_antigravity_command()
                subprocess.Popen(anti_cmd + ["-n", path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 3. Google Chrome Tabs & Windows
    if restore_chrome:
        chrome_windows = snapshot.get("chrome", {}).get("windows", [])
        tab_total = snapshot.get("chrome", {}).get("tab_count", 0)
        print(c(f"\n🌐 Google Chrome Tabs to Reopen ({tab_total} tabs in {len(chrome_windows)} windows):", Colors.BOLD + Colors.CYAN))
        for w in chrome_windows:
            w_idx = w.get("window_index")
            tabs = w.get("tabs", [])
            valid_urls = [t["url"] for t in tabs if t["url"].startswith("http://") or t["url"].startswith("https://") or t["url"].startswith("chrome://")]
            print(c(f"  ➜ Window #{w_idx}: Restoring {len(valid_urls)} tabs", Colors.WHITE))
            for t in tabs[:5]:
                print(c(f"     • {t['title'][:55]} ({t['url'][:45]}...)", Colors.DIM))
            if len(tabs) > 5:
                print(c(f"     • ... and {len(tabs) - 5} more tabs", Colors.DIM))

            if not dry_run and valid_urls:
                if IS_MACOS:
                    cmd = ["open", "-na", "Google Chrome", "--args"] + valid_urls
                    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    chrome_bin = get_chrome_command()
                    cmd = [chrome_bin, "--new-window"] + valid_urls
                    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 4. Display Active Tasks & Notes
    tasks = snapshot.get("tasks", [])
    if tasks:
        print(c(f"\n📋 Tasks from this session:", Colors.BOLD + Colors.YELLOW))
        for t in tasks:
            status_icon = "✅" if t["status"] == "done" else ("🔨" if t["status"] == "doing" else "⏳")
            print(f"  {status_icon} #{t['id']} [{t['status'].upper()}] {t['title']}")

    notes = snapshot.get("notes", [])
    if notes:
        print(c(f"\n💡 Notes & Context:", Colors.BOLD + Colors.WHITE))
        for n in notes:
            print(f"  • {n['text']}")

    if dry_run:
        print(c("\n[DRY RUN COMPLETED] No apps were launched. Run without --dry-run to restore.", Colors.YELLOW))
    else:
        print(c("\n✅ Session successfully restored! You are back in context.", Colors.BOLD + Colors.GREEN))


# --- CLI Commands Formatter ---
def format_snapshot_summary(snap, title="Session Snapshot"):
    out = []
    out.append(c(f"\n{'='*20} {title} {'='*20}", Colors.BOLD + Colors.CYAN))
    out.append(f" {c('Snapshot ID:', Colors.BOLD)} {snap.get('id')}  |  {c('Label:', Colors.BOLD)} {snap.get('label')}")
    out.append(f" {c('Captured At:', Colors.BOLD)} {readable_time(snap.get('created_at'))}")
    out.append("-" * 65)

    # VS Code
    vscode = snap.get("vscode", {})
    projects_vc = vscode.get("projects", [])
    out.append(c(f"💻 VS Code Projects ({len(projects_vc)}):", Colors.BOLD + Colors.BLUE))
    if projects_vc:
        for p in projects_vc:
            git = p.get("git")
            git_badge = ""
            if git and git.get("is_git"):
                b = git.get("branch", "unknown")
                dirty = f"{git.get('total_changes')} uncommitted" if git.get("dirty") else "clean"
                git_badge = c(f" [{b} | {dirty}]", Colors.YELLOW if git.get("dirty") else Colors.GREEN)
            out.append(f"   • {c(p['name'], Colors.BOLD)}  {c(p['path'], Colors.DIM)}{git_badge}")
    else:
        out.append("   (None open)")

    # Antigravity
    anti = snap.get("antigravity", {})
    projects_anti = anti.get("projects", [])
    out.append(c(f"\n🚀 Antigravity IDE Projects ({len(projects_anti)}):", Colors.BOLD + Colors.MAGENTA))
    if projects_anti:
        for p in projects_anti:
            git = p.get("git")
            git_badge = ""
            if git and git.get("is_git"):
                b = git.get("branch", "unknown")
                dirty = f"{git.get('total_changes')} uncommitted" if git.get("dirty") else "clean"
                git_badge = c(f" [{b} | {dirty}]", Colors.YELLOW if git.get("dirty") else Colors.GREEN)
            out.append(f"   • {c(p['name'], Colors.BOLD)}  {c(p['path'], Colors.DIM)}{git_badge}")
    else:
        out.append("   (None open)")

    # Chrome
    chrome = snap.get("chrome", {})
    windows = chrome.get("windows", [])
    tab_count = chrome.get("tab_count", 0)
    out.append(c(f"\n🌐 Google Chrome ({tab_count} tabs in {len(windows)} windows):", Colors.BOLD + Colors.CYAN))
    if windows:
        for w in windows:
            out.append(c(f"   Window #{w.get('window_index')}:", Colors.BOLD))
            for t in w.get("tabs", [])[:6]:
                title = t.get("title") or t.get("url")
                out.append(f"     - {title[:55]} {c('(' + t.get('url')[:40] + '...)', Colors.DIM)}")
            if len(w.get("tabs", [])) > 6:
                out.append(c(f"     ... and {len(w.get('tabs', [])) - 6} more tabs", Colors.DIM))
    else:
        out.append("   (No open Chrome tabs detected)")

    # Tasks
    tasks = snap.get("tasks", [])
    out.append(c(f"\n📋 Daily Tasks ({len(tasks)}):", Colors.BOLD + Colors.YELLOW))
    if tasks:
        for t in tasks:
            status_icon = "✅" if t["status"] == "done" else ("🔨" if t["status"] == "doing" else "⏳")
            out.append(f"   {status_icon} #{t['id']} [{t['status'].upper()}] {t['title']}")
    else:
        out.append("   (No tasks added today. Use: track task add \"task name\")")

    # Notes
    notes = snap.get("notes", [])
    if notes:
        out.append(c(f"\n💡 Notes & Context ({len(notes)}):", Colors.BOLD + Colors.WHITE))
        for n in notes:
            out.append(f"   • {n['text']}")

    out.append("=" * 65)
    return "\n".join(out)


# --- CLI Routing ---
def main():
    parser = argparse.ArgumentParser(
        prog="track",
        description=c("Work & Session Tracker: Track daily tasks and snapshot/restore all VS Code, Antigravity, and Chrome sessions.", Colors.BOLD + Colors.CYAN),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  track snapshot "before reboot"    # Snapshot all open VS Code, Antigravity, and Chrome tabs
  track status                     # Check current live open windows and tasks
  track restore                    # Restore latest session (reopen all projects & tabs)
  track restore --vscode           # Reopen only VS Code workspaces
  track list                       # View snapshot history
  track task add "Fix login API"   # Add a task to today's list
  track task list                  # View today's tasks
  track task done 1                # Mark task #1 completed
  track note "Blocked on DB query" # Add a quick note/blocker
"""
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # snapshot / save
    p_snap = subparsers.add_parser("snapshot", aliases=["save", "snap"], help="Capture current open projects, tabs, and tasks")
    p_snap.add_argument("label", nargs="?", default="manual", help="Optional label or note for this snapshot")

    # status / current
    subparsers.add_parser("status", aliases=["current", "check"], help="Inspect current live open windows, tabs, and tasks without saving")

    # restore / resume
    p_res = subparsers.add_parser("restore", aliases=["resume", "open"], help="Reopen projects and tabs from a snapshot")
    p_res.add_argument("snapshot_id", nargs="?", default="latest", help="Snapshot ID or 'latest'")
    p_res.add_argument("--vscode", action="store_true", help="Restore VS Code workspaces only")
    p_res.add_argument("--antigravity", action="store_true", help="Restore Antigravity workspaces only")
    p_res.add_argument("--chrome", action="store_true", help="Restore Google Chrome tabs only")
    p_res.add_argument("--dry-run", action="store_true", help="Preview what would be reopened without launching")

    # list / history
    subparsers.add_parser("list", aliases=["history", "ls"], help="List saved session snapshots")

    # show
    p_show = subparsers.add_parser("show", help="Show details of a specific snapshot")
    p_show.add_argument("snapshot_id", nargs="?", default="latest", help="Snapshot ID or 'latest'")

    # task
    p_task = subparsers.add_parser("task", aliases=["t"], help="Manage daily tasks")
    task_sub = p_task.add_subparsers(dest="task_command")

    p_t_add = task_sub.add_parser("add", help="Add a task")
    p_t_add.add_argument("title", help="Task description")
    p_t_add.add_argument("-p", "--priority", choices=["low", "normal", "high"], default="normal", help="Priority level")

    p_t_list = task_sub.add_parser("list", aliases=["ls"], help="List today's tasks")
    p_t_list.add_argument("--date", help="View tasks for date (YYYY-MM-DD)")

    p_t_done = task_sub.add_parser("done", help="Mark task as done")
    p_t_done.add_argument("id", type=int, help="Task ID")

    p_t_doing = task_sub.add_parser("doing", help="Mark task as in-progress")
    p_t_doing.add_argument("id", type=int, help="Task ID")

    p_t_rm = task_sub.add_parser("rm", aliases=["delete"], help="Remove task")
    p_t_rm.add_argument("id", type=int, help="Task ID")

    p_t_note = task_sub.add_parser("note", help="Add a quick note / blocker")
    p_t_note.add_argument("text", help="Note text")

    # note shortcut
    p_note = subparsers.add_parser("note", help="Add a quick note / blocker to today's log")
    p_note.add_argument("text", help="Note text")

    # export
    p_exp = subparsers.add_parser("export", help="Export today's summary to a markdown file")
    p_exp.add_argument("--output", "-o", help="Output file path")

    args = parser.parse_args()

    if not args.command:
        # Default behavior: show current live status and tasks
        snap = capture_current_session(label="live-preview")
        print(format_snapshot_summary(snap, title="Current Live System Activity"))
        print(c("\n💡 Tip: Run 'track snapshot' to save this state, or 'track --help' for commands.\n", Colors.DIM))
        return

    # Handle commands
    cmd = args.command

    if cmd in ["snapshot", "save", "snap"]:
        snap = capture_current_session(label=args.label)
        saved_path = save_snapshot(snap)
        print(format_snapshot_summary(snap, title="Snapshot Saved Successfully"))
        print(c(f"\n💾 Saved to: {saved_path}", Colors.GREEN))
        print(c(f"📄 Markdown log: {WORKSPACE_DIR}/CURRENT_SESSION.md", Colors.GREEN))
        print(c(f"👉 Next time you boot up, run: {c('track restore', Colors.BOLD + Colors.CYAN)} to resume everything!\n", Colors.YELLOW))

    elif cmd in ["status", "current", "check"]:
        snap = capture_current_session(label="live-preview")
        print(format_snapshot_summary(snap, title="Current Live System Activity"))

    elif cmd in ["list", "history", "ls"]:
        snaps = list_snapshots()
        print(c(f"\n📜 Saved Session Snapshots ({len(snaps)}):", Colors.BOLD + Colors.CYAN))
        print("-" * 75)
        if not snaps:
            print("  No snapshots saved yet. Run 'track snapshot' to capture your first session!")
        else:
            print(f"  {'ID':<22} {'LABEL':<18} {'VSCODE':<8} {'ANTIGRAV':<10} {'CHROME':<8} {'TASKS':<6}")
            print("-" * 75)
            for s in snaps:
                print(f"  {c(s['id'], Colors.BOLD):<22} {s['label']:<18} {s['vscode_count']:<8} {s['antigravity_count']:<10} {s['chrome_tabs']:<8} {s['tasks_count']:<6}")
        print("-" * 75)
        print(c("💡 To inspect a snapshot: track show <id>", Colors.DIM))
        print(c("💡 To restore a snapshot: track restore <id>\n", Colors.DIM))

    elif cmd == "show":
        snap = load_snapshot(args.snapshot_id)
        if not snap:
            print(c(f"❌ Error: Snapshot '{args.snapshot_id}' not found.", Colors.RED))
            sys.exit(1)
        print(format_snapshot_summary(snap, title=f"Snapshot Details: {args.snapshot_id}"))

    elif cmd in ["restore", "resume", "open"]:
        snap = load_snapshot(args.snapshot_id)
        if not snap:
            print(c(f"❌ Error: Snapshot '{args.snapshot_id}' not found.", Colors.RED))
            sys.exit(1)
        
        # If user specified flags, honor them; otherwise restore all
        if args.vscode or args.antigravity or args.chrome:
            restore_vc = args.vscode
            restore_anti = args.antigravity
            restore_ch = args.chrome
        else:
            restore_vc = True
            restore_anti = True
            restore_ch = True

        restore_session(
            snap,
            restore_vscode=restore_vc,
            restore_antigravity=restore_anti,
            restore_chrome=restore_ch,
            dry_run=args.dry_run
        )

    elif cmd in ["task", "t"]:
        task_cmd = args.task_command or "list"
        if task_cmd == "add":
            t = add_task(args.title, args.priority)
            print(c(f"✅ Added Task #{t['id']}: {t['title']} [{t['priority']}]", Colors.GREEN))

        elif task_cmd in ["list", "ls"]:
            data = load_tasks(getattr(args, "date", None))
            tasks = data.get("tasks", [])
            notes = data.get("notes", [])
            print(c(f"\n📋 Daily Tasks for {data.get('date')}:", Colors.BOLD + Colors.YELLOW))
            print("-" * 65)
            if not tasks:
                print("  No tasks logged for today. Add one with: track task add \"Task Name\"")
            else:
                for t in tasks:
                    status_icon = "✅" if t["status"] == "done" else ("🔨" if t["status"] == "doing" else "⏳")
                    prio = c(f"[{t.get('priority', 'normal').upper()}]", Colors.MAGENTA) if t.get('priority') != 'normal' else ""
                    print(f"  {status_icon} #{t['id']:<2} {prio:<8} [{t['status'].upper():<7}] {t['title']}")
            
            if notes:
                print(c(f"\n💡 Quick Notes / Blockers:", Colors.BOLD + Colors.WHITE))
                for n in notes:
                    print(f"  • {n['text']}")
            print("-" * 65 + "\n")

        elif task_cmd == "done":
            if update_task_status(args.id, "done"):
                print(c(f"🎉 Task #{args.id} marked as COMPLETED!", Colors.BOLD + Colors.GREEN))
            else:
                print(c(f"❌ Task #{args.id} not found.", Colors.RED))

        elif task_cmd == "doing":
            if update_task_status(args.id, "doing"):
                print(c(f"🔨 Task #{args.id} marked as IN-PROGRESS.", Colors.BOLD + Colors.CYAN))
            else:
                print(c(f"❌ Task #{args.id} not found.", Colors.RED))

        elif task_cmd in ["rm", "delete"]:
            if delete_task(args.id):
                print(c(f"🗑️ Task #{args.id} deleted.", Colors.YELLOW))
            else:
                print(c(f"❌ Task #{args.id} not found.", Colors.RED))

        elif task_cmd == "note":
            n = add_note(args.text)
            print(c(f"💡 Note #{n['id']} added.", Colors.GREEN))

    elif cmd == "note":
        n = add_note(args.text)
        print(c(f"💡 Note #{n['id']} added.", Colors.GREEN))

    elif cmd == "export":
        data_dir = get_data_dir()
        latest = load_snapshot("latest")
        tasks = load_tasks()
        out_file = args.output or (WORKSPACE_DIR / f"WORK_SUMMARY_{today_str()}.md")
        update_markdown_logs()
        cs_path = data_dir / "CURRENT_SESSION.md"
        shutil.copyfile(cs_path, out_file)
        print(c(f"📄 Daily summary exported to: {out_file}", Colors.GREEN))

if __name__ == "__main__":
    main()
