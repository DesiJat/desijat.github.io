Perfect. I suggest we build this like a professional open-source utility, similar in quality to `tree`, `du`, or `fd`.

## 🚀 Project: tree-size v3.0

### Design Goals

* Single file: `tree-size.sh`
* No external dependencies
* Runs on:

  * ✅ Ubuntu
  * ✅ Debian
  * ✅ Fedora
  * ✅ CentOS/RHEL
  * ✅ Arch
  * ✅ Alpine
  * ✅ macOS (Intel & Apple Silicon)
* Bash **3.2+ compatible** (no associative arrays)
* Auto-detect GNU utilities when available
* Fast and memory efficient
* ShellCheck clean
* Easy to extend

---

# Development Plan

We'll make approximately 12 parts.

| Part | Module                     | Status |
| ---- | -------------------------- | ------ |
| 1    | Framework & Platform Layer | 🔨     |
| 2    | Command Line Parser        |        |
| 3    | Exclusion Engine           |        |
| 4    | Size Engine                |        |
| 5    | Tree Engine                |        |
| 6    | Sorting Engine             |        |
| 7    | Rendering Engine           |        |
| 8    | Statistics                 |        |
| 9    | Export Formats             |        |
| 10   | Performance Optimizations  |        |
| 11   | Testing & Compatibility    |        |
| 12   | Final Polish               |        |

---

# Part 1 — Framework

This is the foundation. Every other feature depends on it.

## File Header

```bash
#!/usr/bin/env bash

###############################################################################
#
# tree-size.sh
#
# Version : 3.0.0
#
# Cross-platform directory tree viewer with file sizes.
#
# Supported Platforms
#
#   ✓ Ubuntu
#   ✓ Debian
#   ✓ Fedora
#   ✓ CentOS
#   ✓ RHEL
#   ✓ Rocky Linux
#   ✓ AlmaLinux
#   ✓ Arch Linux
#   ✓ Alpine Linux
#   ✓ macOS Intel
#   ✓ macOS Apple Silicon
#
# Bash Compatibility
#
#   ✓ Bash 3.2+
#
###############################################################################
```

---

# Strict Mode

```bash
set -e
set -u
```

Notice we **do not** use:

```bash
set -o pipefail
```

until we've verified it's supported in every environment we target.

---

# Global Constants

```bash
VERSION="3.0.0"

PROGRAM_NAME="$(basename "$0")"

OS=""
ARCH=""
PLATFORM=""

HAS_GNU_COREUTILS=0
HAS_GNU_FINDUTILS=0

USE_COLOR=1
UNICODE_TREE=1

ROOT_DIR="."

MAX_DEPTH=-1

TOP_LIMIT=0

MIN_SIZE=0

FOLLOW_SYMLINKS=0

SHOW_HIDDEN=0

SUMMARY_ONLY=0

SORT_MODE="size"

SORT_ORDER="desc"

OUTPUT_MODE="terminal"
```

---

# Logging Functions

```bash
info() {

    printf "[INFO] %s\n" "$*"

}

warn() {

    printf "[WARN] %s\n" "$*" >&2

}

error() {

    printf "[ERROR] %s\n" "$*" >&2

    exit 1

}
```

---

# Detect Operating System

```bash
detect_os() {

    case "$(uname -s)" in

        Linux)

            OS="linux"
            ;;

        Darwin)

            OS="macos"
            ;;

        *)

            OS="unknown"
            ;;

    esac

}
```

---

# Detect CPU

```bash
detect_arch() {

    ARCH="$(uname -m)"

}
```

---

# Detect GNU Utilities

Instead of assuming GNU commands exist, we'll detect them.

```bash
detect_gnu_tools() {

    if command -v gdu >/dev/null 2>&1; then
        HAS_GNU_COREUTILS=1
    fi

    if command -v gfind >/dev/null 2>&1; then
        HAS_GNU_FINDUTILS=1
    fi

}
```

Later we'll automatically use

```
gdu
gstat
gfind
grealpath
```

only if available.

---

# Platform Layer

The biggest improvement over your current script.

Instead of writing

```bash
du
```

or

```bash
stat
```

everywhere,

we'll define wrapper variables.

```bash
DU="du"
STAT="stat"
FIND="find"
READLINK="readlink"
SORT="sort"
```

Then configure them.

Linux

```
DU=du
STAT=stat
```

macOS with GNU tools

```
DU=gdu
STAT=gstat
```

macOS without GNU tools

```
DU=du
STAT=stat
```

The rest of the script never needs to know which platform it's running on.

---

# Color Engine

```bash
init_colors() {

    if [ "$USE_COLOR" -eq 0 ]; then

        RESET=""

        RED=""

        GREEN=""

        BLUE=""

        YELLOW=""

        GRAY=""

        return

    fi

    if [ -t 1 ]; then

        RESET="$(printf '\033[0m')"

        RED="$(printf '\033[31m')"

        GREEN="$(printf '\033[32m')"

        BLUE="$(printf '\033[34m')"

        YELLOW="$(printf '\033[33m')"

        GRAY="$(printf '\033[90m')"

    fi

}
```

Works on Linux and macOS.

---

# Unicode Detection

If terminal cannot display Unicode.

```
├──

└──
```

Automatically switch to

```
|--

`--
```

Useful for CI systems.

---

# Initialization

```bash
initialize() {

    detect_os

    detect_arch

    detect_gnu_tools

    init_colors

}
```

---

# Main

```bash
main() {

    initialize

    info "tree-size $VERSION"

    info "OS      : $OS"

    info "ARCH    : $ARCH"

    info "Root    : $ROOT_DIR"

}

main "$@"
```

---

## What Part 1 Achieves

By the end of Part 1, we'll have:

* A single `tree-size.sh` with a clean project structure.
* Automatic OS detection.
* Automatic architecture detection.
* Automatic GNU tool detection.
* Centralized command abstraction.
* Color handling.
* Logging utilities.
* Initialization flow.

In **Part 2**, we'll build a robust argument parser supporting:

```bash
./tree-size.sh
./tree-size.sh ~/project
./tree-size.sh --top 20
./tree-size.sh --max-depth 3
./tree-size.sh --min-size 10M
./tree-size.sh --exclude "*.log"
./tree-size.sh --sort name
./tree-size.sh --json
./tree-size.sh --markdown
./tree-size.sh --csv
```

By the end of Part 2, the CLI interface will be complete and stable, and every subsequent feature will plug into that parser.

Excellent. Now we build what I consider the **heart of the project**.

Unlike most Bash scripts, we are **not** going to sprinkle `if`, `case`, and variables throughout the code. Instead, we'll create a clean CLI parser that makes adding future options trivial.

---

# Part 2 — Command Line Parser

By the end of this part, the parser will understand commands like:

```bash
tree-size.sh

tree-size.sh ~/project

tree-size.sh --top 20

tree-size.sh --max-depth 3

tree-size.sh --min-size 10M

tree-size.sh --exclude "*.log"

tree-size.sh --exclude "*.zip"

tree-size.sh --exclude-from .gitignore

tree-size.sh --json

tree-size.sh --csv

tree-size.sh --markdown

tree-size.sh --summary-only

tree-size.sh --dirs-only

tree-size.sh --files-only

tree-size.sh --ascii

tree-size.sh --no-color

tree-size.sh --sort name

tree-size.sh --reverse
```

---

# 1. Global Configuration

Replace the previous globals with a structured configuration.

```bash
###############################################################################
# Configuration
###############################################################################

VERSION="3.0.0"

ROOT_DIR="."

USE_COLOR=1
USE_UNICODE=1

SHOW_HIDDEN=0
FOLLOW_SYMLINKS=0

SUMMARY_ONLY=0
FILES_ONLY=0
DIRS_ONLY=0

MAX_DEPTH=-1
TOP_LIMIT=0
MIN_SIZE_BYTES=0

SORT_MODE="size"
SORT_REVERSE=0

OUTPUT_MODE="terminal"

EXCLUDE_PATTERNS=""
EXCLUDE_FILE=""
```

Notice something important:

There are **no Bash associative arrays**.

Everything works on Bash 3.2.

---

# 2. Version

```bash
show_version() {

cat <<EOF

tree-size $VERSION

Cross Platform Directory Tree Utility

Supported

 Linux
 macOS
 BSD

EOF

}
```

---

# 3. Help Screen

Use a heredoc.

```bash
show_help() {

cat <<EOF

Usage:

    tree-size.sh [OPTIONS] [DIRECTORY]

Options

    --help

    --version

    --max-depth N

    --top N

    --min-size SIZE

    --exclude PATTERN

    --exclude-from FILE

    --sort MODE

    --reverse

    --hidden

    --follow-links

    --files-only

    --dirs-only

    --summary-only

    --json

    --csv

    --markdown

    --ascii

    --no-color

Examples

    tree-size.sh

    tree-size.sh ~/project

    tree-size.sh --top 20

    tree-size.sh --exclude "*.log"

EOF

}
```

---

# 4. Size Parser

Instead of keeping everything as strings, convert once.

```bash
parse_size() {

    local input
    local number
    local unit

    input=$(printf "%s" "$1" | tr '[:lower:]' '[:upper:]')

    number=$(printf "%s" "$input" | sed 's/[^0-9].*//')

    unit=$(printf "%s" "$input" | sed 's/[0-9]//g')

    case "$unit" in

        K|KB)

            echo $((number*1024))

            ;;

        M|MB)

            echo $((number*1024*1024))

            ;;

        G|GB)

            echo $((number*1024*1024*1024))

            ;;

        T|TB)

            echo $((number*1024*1024*1024*1024))

            ;;

        *)

            echo "$number"

            ;;

    esac

}
```

---

# 5. Exclude Registration

Instead of arrays, use newline-separated values.

```bash
add_exclude() {

    if [ -z "$EXCLUDE_PATTERNS" ]; then

        EXCLUDE_PATTERNS="$1"

    else

        EXCLUDE_PATTERNS="$EXCLUDE_PATTERNS
$1"

    fi

}
```

Later we'll iterate using

```bash
while IFS= read -r pattern
do
    ...
done
```

This works perfectly on every Bash version.

---

# 6. Argument Validation

Small reusable helpers.

```bash
require_value() {

    if [ $# -lt 2 ]; then

        error "Missing value for $1"

    fi

}
```

---

# 7. Parser

Now the real parser.

```bash
parse_arguments() {

while [ $# -gt 0 ]
do

    case "$1" in

        --help)

            show_help

            exit 0

            ;;

        --version)

            show_version

            exit 0

            ;;

        --no-color)

            USE_COLOR=0

            ;;

        --ascii)

            USE_UNICODE=0

            ;;

        --hidden)

            SHOW_HIDDEN=1

            ;;

        --follow-links)

            FOLLOW_SYMLINKS=1

            ;;

        --summary-only)

            SUMMARY_ONLY=1

            ;;

        --files-only)

            FILES_ONLY=1

            ;;

        --dirs-only)

            DIRS_ONLY=1

            ;;

        --reverse)

            SORT_REVERSE=1

            ;;

        --json)

            OUTPUT_MODE="json"

            ;;

        --csv)

            OUTPUT_MODE="csv"

            ;;

        --markdown)

            OUTPUT_MODE="markdown"

            ;;

        --max-depth)

            require_value "$@"

            MAX_DEPTH="$2"

            shift

            ;;

        --top)

            require_value "$@"

            TOP_LIMIT="$2"

            shift

            ;;

        --min-size)

            require_value "$@"

            MIN_SIZE_BYTES=$(parse_size "$2")

            shift

            ;;

        --exclude)

            require_value "$@"

            add_exclude "$2"

            shift

            ;;

        --exclude-from)

            require_value "$@"

            EXCLUDE_FILE="$2"

            shift

            ;;

        --sort)

            require_value "$@"

            SORT_MODE="$2"

            shift

            ;;

        -*)

            error "Unknown option: $1"

            ;;

        *)

            ROOT_DIR="$1"

            ;;

    esac

    shift

done

}
```

---

# 8. Validation

After parsing, verify options.

```bash
validate_options() {

case "$SORT_MODE" in

    size|name|date|extension)

        ;;

    *)

        error "Invalid sort mode"

        ;;

esac

if [ ! -d "$ROOT_DIR" ]; then

    error "Directory not found: $ROOT_DIR"

fi

}
```

---

# 9. Initialize

```bash
main() {

    initialize

    parse_arguments "$@"

    validate_options

}
```

---

# What We Gained

The parser is now:

* **Extensible**: adding a new option is a single `case` block.
* **Portable**: no Bash 4 features, so it works on macOS Bash 3.2.
* **Validated**: unknown options and missing values are handled cleanly.
* **Future-proof**: output modes (`terminal`, `json`, `csv`, `markdown`) are already wired in.

## Part 3 Preview — Exclusion Engine

This is where we'll build one of the strongest parts of the utility. Instead of simple filename checks, it will support:

* Multiple `--exclude` options.
* Wildcards (`*.log`, `*.tmp`, `cache*`).
* Exact names (`node_modules`, `.git`).
* `--exclude-from` files.
* Optional `.gitignore` support.
* Fast matching without GNU-specific features.
* Cross-platform behavior on Linux and macOS.

Once Part 3 is complete, the exclusion engine will be reusable throughout the tree traversal, size calculation, and summary logic.

```bash
bash -n tree-size.sh && bash tree-size.sh --help | head -n 40 && printf '\n---\n' && bash tree-size.sh --max-depth 2 --top 10 --summary-only . | head -n 40


bash tree-size.sh --help && printf '\n---\n' && bash tree-size.sh --sort name --reverse . | head -n 20 && printf '\n---\n' && bash tree-size.sh --json --summary-only . | head -n 20 && printf '\n---\n' && bash tree-size.sh --csv . | head -n 10

# 

cd /Users/apple/data/code/code-graph && \
for args in \
  '--version' \
  '--help' \
  '--summary-only .' \
  '--dirs-only .' \
  '--files-only .' \
  '--sort name .' \
  '--sort name --reverse .' \
  '--max-depth 1 .' \
  '--min-size 1K .' \
  '--exclude "*.log" .' \
  '--json --summary-only .' \
  '--csv .' \
  '--markdown --top 5 .' \
  '--no-color --sort size .' \
  '--ascii --summary-only .' \
; do \
  echo "=== $args ==="; \
  bash tree-size.sh $args >/tmp/tree_test_out 2>/tmp/tree_test_err; \
  status=$?; \
  echo "exit=$status"; \
  head -n 8 /tmp/tree_test_out 2>/dev/null || true; \
  if [ -s /tmp/tree_test_err ]; then echo "stderr:"; head -n 5 /tmp/tree_test_err; fi; \
  echo; \
 done
```