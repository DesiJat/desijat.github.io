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

set -e
set -u

###############################################################################
# Configuration
###############################################################################

VERSION="3.0.0"
PROGRAM_NAME="$(basename "$0")"

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

RESET=""
RED=""
GREEN=""
BLUE=""
YELLOW=""
GRAY=""

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

show_help() {
    cat <<EOF

Usage:

    tree-size.sh [OPTIONS] [DIRECTORY]

Options

    --help
        Show this help screen.

    --version
        Show version information.

    --max-depth N
        Limit recursion depth. Use -1 for unlimited.

    --top N
        Show only the top N largest entries.

    --min-size SIZE
        Ignore entries smaller than SIZE (for example: 100K, 2M, 1G).

    --exclude PATTERN
        Exclude a path or name pattern such as "*.log" or node_modules.

    --exclude-from FILE
        Read exclude patterns from a file, one pattern per line.

    --sort MODE
        Sort by: size, name, date, or extension.
        Examples: --sort size, --sort name, --sort date, --sort extension

    --reverse
        Reverse the sort order.

    --hidden
        Include hidden files and directories.

    --follow-links
        Follow symbolic links while scanning.

    --files-only
        Display only file entries.

    --dirs-only
        Display only directory entries.

    --summary-only
        Print the summary only.

    --json
        Output machine-readable JSON.

    --csv
        Output CSV data.

    --markdown
        Output Markdown-formatted data.

    --ascii
        Use ASCII tree characters instead of Unicode.

    --no-color
        Disable colored output.

Examples

    tree-size.sh
    tree-size.sh ~/project
    tree-size.sh --top 20 --sort size
    tree-size.sh --sort name --reverse ~/project
    tree-size.sh --max-depth 3 --min-size 10M .
    tree-size.sh --exclude "*.log" --exclude "node_modules" .
    tree-size.sh --json --summary-only .
    tree-size.sh --csv .
    tree-size.sh --markdown --top 10 .

EOF
}

parse_size() {
    local input
    local number
    local unit

    input=$(printf "%s" "$1" | tr '[:lower:]' '[:upper:]')
    number=$(printf "%s" "$input" | sed 's/[^0-9].*//')
    unit=$(printf "%s" "$input" | sed 's/[0-9]//g')

    case "$unit" in
        K|KB)
            echo $((number * 1024))
            ;;
        M|MB)
            echo $((number * 1024 * 1024))
            ;;
        G|GB)
            echo $((number * 1024 * 1024 * 1024))
            ;;
        T|TB)
            echo $((number * 1024 * 1024 * 1024 * 1024))
            ;;
        *)
            echo "$number"
            ;;
    esac
}

add_exclude() {
    if [ -z "$EXCLUDE_PATTERNS" ]; then
        EXCLUDE_PATTERNS="$1"
    else
        EXCLUDE_PATTERNS="$EXCLUDE_PATTERNS
$1"
    fi
}

trim() {
    local value="$1"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf '%s' "$value"
}

require_value() {
    if [ $# -lt 2 ]; then
        error "Missing value for $1"
    fi
}

load_exclude_file() {
    if [ -z "$EXCLUDE_FILE" ]; then
        return
    fi

    if [ ! -f "$EXCLUDE_FILE" ]; then
        error "Exclude file not found: $EXCLUDE_FILE"
    fi

    while IFS= read -r pattern || [ -n "$pattern" ]; do
        pattern=$(trim "$pattern")
        case "$pattern" in
            ""|\#*)
                continue
                ;;
        esac
        add_exclude "$pattern"
    done < "$EXCLUDE_FILE"
}

apply_default_excludes() {
    if [ -n "$EXCLUDE_PATTERNS" ]; then
        return
    fi

    EXCLUDE_PATTERNS=$(cat <<'EOF'
.git
.gitignore
.github
.gitattributes
.gitmodules
.gitkeep
CVS
.svn
.hg
node_modules
bower_components
jspm_packages
vendor
__pycache__
.venv
venv
.dist
build
out
output
target
.next
.nuxt
.cache
coverage
htmlcov
.idea
.vscode
.vs
*.swp
*.swo
*~
.terraform
*.tfstate*
.pulumi
ansible/.ansible
.DS_Store
.localized
Thumbs.db
Desktop.ini
*.log
*.logs
logs
log
tmp
temp
*.tmp
*.temp
EOF
)
}

is_excluded_path() {
    local path="$1"
    local name="${path##*/}"
    local pattern

    while IFS= read -r pattern; do
        [ -z "$pattern" ] && continue
        if [[ "$name" == $pattern ]]; then
            return 0
        fi
        if [[ "$path" == $pattern ]]; then
            return 0
        fi
        if [[ "$path" == *"/$pattern" ]]; then
            return 0
        fi
    done <<EOF
$EXCLUDE_PATTERNS
EOF

    return 1
}

has_hidden_prefix() {
    local value="${1##*/}"
    case "$value" in
        .*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

bytes_to_human() {
    local bytes="$1"
    local units=(B K M G T)
    local unit_index=0
    local value="$bytes"

    while [ "$value" -ge 1024 ] && [ "$unit_index" -lt 4 ]; do
        value=$((value / 1024))
        unit_index=$((unit_index + 1))
    done

    if [ "$unit_index" -eq 0 ]; then
        printf '%sB' "$bytes"
        return
    fi

    printf '%s%s' "$value" "${units[$unit_index]}"
}

item_size_bytes() {
    local path="$1"

    if [ -d "$path" ] && [ "$FOLLOW_SYMLINKS" -eq 0 ] && [ ! -L "$path" ]; then
        du -sk "$path" 2>/dev/null | awk '{print $1 * 1024}'
        return
    fi

    if [ -d "$path" ] && [ "$FOLLOW_SYMLINKS" -eq 1 ]; then
        du -sk "$path" 2>/dev/null | awk '{print $1 * 1024}'
        return
    fi

    if [ -f "$path" ] || [ -L "$path" ]; then
        if stat -f "%z" "$path" >/dev/null 2>&1; then
            stat -f "%z" "$path" 2>/dev/null
        else
            stat -c "%s" "$path" 2>/dev/null || printf '0'
        fi
        return
    fi

    printf '0'
}

item_kind() {
    local path="$1"

    if [ -d "$path" ] && [ ! -L "$path" ]; then
        printf 'dir'
        return
    fi

    printf 'file'
}

item_mtime() {
    local path="$1"

    if stat -f "%m" "$path" >/dev/null 2>&1; then
        stat -f "%m" "$path" 2>/dev/null
    else
        stat -c "%Y" "$path" 2>/dev/null || printf '0'
    fi
}

item_extension() {
    local name="${1##*/}"
    if [[ "$name" == *.* ]] && [[ "$name" != .* ]]; then
        printf '%s' "${name##*.}"
    else
        printf '%s' ""
    fi
}

sorted_child_items() {
    local dir="$1"
    local -a entries=()
    local item

    while IFS= read -r item; do
        [ -n "$item" ] || continue
        if [ -d "$item" ] && [ "$FOLLOW_SYMLINKS" -eq 0 ] && [ -L "$item" ]; then
            continue
        fi
        entries+=("$item")
    done < <(
        if [ "$FOLLOW_SYMLINKS" -eq 1 ]; then
            find -L "$dir" -mindepth 1 -maxdepth 1 -print 2>/dev/null
        else
            find "$dir" -mindepth 1 -maxdepth 1 -print 2>/dev/null
        fi | sort
    )

    case "$SORT_MODE" in
        size)
            local i j
            for ((i = 0; i < ${#entries[@]}; i++)); do
                for ((j = i + 1; j < ${#entries[@]}; j++)); do
                    local a_size b_size
                    a_size=$(item_size_bytes "${entries[i]}")
                    b_size=$(item_size_bytes "${entries[j]}")
                    if [ "$SORT_REVERSE" -eq 0 ]; then
                        if [ "$b_size" -gt "$a_size" ]; then
                            local tmp="${entries[i]}"
                            entries[i]="${entries[j]}"
                            entries[j]="$tmp"
                        fi
                    else
                        if [ "$b_size" -lt "$a_size" ]; then
                            local tmp="${entries[i]}"
                            entries[i]="${entries[j]}"
                            entries[j]="$tmp"
                        fi
                    fi
                done
            done
            ;;
        name)
            local i j
            for ((i = 0; i < ${#entries[@]}; i++)); do
                for ((j = i + 1; j < ${#entries[@]}; j++)); do
                    local left="${entries[i]##*/}"
                    local right="${entries[j]##*/}"
                    if [ "$SORT_REVERSE" -eq 0 ]; then
                        if [[ "$right" < "$left" ]]; then
                            local tmp="${entries[i]}"
                            entries[i]="${entries[j]}"
                            entries[j]="$tmp"
                        fi
                    else
                        if [[ "$right" > "$left" ]]; then
                            local tmp="${entries[i]}"
                            entries[i]="${entries[j]}"
                            entries[j]="$tmp"
                        fi
                    fi
                done
            done
            ;;
        date)
            local i j
            for ((i = 0; i < ${#entries[@]}; i++)); do
                for ((j = i + 1; j < ${#entries[@]}; j++)); do
                    local a_time b_time
                    a_time=$(item_mtime "${entries[i]}")
                    b_time=$(item_mtime "${entries[j]}")
                    if [ "$SORT_REVERSE" -eq 0 ]; then
                        if [ "$b_time" -gt "$a_time" ]; then
                            local tmp="${entries[i]}"
                            entries[i]="${entries[j]}"
                            entries[j]="$tmp"
                        fi
                    else
                        if [ "$b_time" -lt "$a_time" ]; then
                            local tmp="${entries[i]}"
                            entries[i]="${entries[j]}"
                            entries[j]="$tmp"
                        fi
                    fi
                done
            done
            ;;
        extension)
            local i j
            for ((i = 0; i < ${#entries[@]}; i++)); do
                for ((j = i + 1; j < ${#entries[@]}; j++)); do
                    local left right
                    left=$(item_extension "${entries[i]}")
                    right=$(item_extension "${entries[j]}")
                    if [ "$SORT_REVERSE" -eq 0 ]; then
                        if [[ "$right" < "$left" ]]; then
                            local tmp="${entries[i]}"
                            entries[i]="${entries[j]}"
                            entries[j]="$tmp"
                        fi
                    else
                        if [[ "$right" > "$left" ]]; then
                            local tmp="${entries[i]}"
                            entries[i]="${entries[j]}"
                            entries[j]="$tmp"
                        fi
                    fi
                done
            done
            ;;
    esac

    local item_index
    for item_index in "${!entries[@]}"; do
        printf '%s\n' "${entries[$item_index]}"
    done
}

render_tree() {
    local dir="$1"
    local prefix="$2"
    local depth="$3"
    local -a entries=()
    local item index max_index last_item
    local displayed=0

    if [ "$MAX_DEPTH" -ne -1 ] && [ "$depth" -ge "$MAX_DEPTH" ]; then
        return
    fi

    if [ "$depth" -eq 0 ]; then
        printf '%s%s%s\n' "$GREEN" "${dir##*/}" "$RESET"
    fi

    while IFS= read -r item; do
        [ -n "$item" ] || continue
        if [ "$SHOW_HIDDEN" -eq 0 ] && has_hidden_prefix "$item"; then
            continue
        fi
        if is_excluded_path "$item"; then
            continue
        fi
        if [ "$MIN_SIZE_BYTES" -gt 0 ]; then
            local item_bytes
            item_bytes=$(item_size_bytes "$item")
            if [ "$item_bytes" -lt "$MIN_SIZE_BYTES" ]; then
                continue
            fi
        fi
        entries+=("$item")
    done < <(sorted_child_items "$dir")

    max_index=$(( ${#entries[@]} - 1 ))
    for index in "${!entries[@]}"; do
        item="${entries[$index]}"
        local name kind size_bytes size_human connector next_prefix
        name="${item##*/}"
        kind=$(item_kind "$item")

        if [ "$FILES_ONLY" -eq 1 ] && [ "$kind" != "file" ]; then
            continue
        fi
        if [ "$DIRS_ONLY" -eq 1 ] && [ "$kind" != "dir" ]; then
            continue
        fi

        if [ "$TOP_LIMIT" -gt 0 ] && [ "$displayed" -ge "$TOP_LIMIT" ]; then
            break
        fi

        size_bytes=$(item_size_bytes "$item")
        size_human=$(bytes_to_human "$size_bytes")
        connector="├──"
        if [ "$index" -eq "$max_index" ]; then
            connector="└──"
        fi

        printf '%s%s %s %s%s\n' "$prefix" "$connector" "$name" "$size_human" "$RESET"
        displayed=$((displayed + 1))

        if [ "$kind" = "dir" ] && [ "$MAX_DEPTH" -eq -1 ] || [ "$MAX_DEPTH" -ne -1 ] && [ "$((depth + 1))" -lt "$MAX_DEPTH" ]; then
            if [ "$index" -eq "$max_index" ]; then
                next_prefix="${prefix}    "
            else
                next_prefix="${prefix}│   "
            fi
            render_tree "$item" "$next_prefix" "$((depth + 1))"
        fi
    done
}

print_summary() {
    local total_dirs=0 total_files=0 total_bytes=0
    local count=0
    local item

    while IFS= read -r item; do
        [ -n "$item" ] || continue
        if [ "$SHOW_HIDDEN" -eq 0 ] && has_hidden_prefix "$item"; then
            continue
        fi
        if is_excluded_path "$item"; then
            continue
        fi
        count=$((count + 1))
        if [ -d "$item" ] && [ ! -L "$item" ]; then
            total_dirs=$((total_dirs + 1))
        else
            total_files=$((total_files + 1))
        fi
        total_bytes=$((total_bytes + $(item_size_bytes "$item")))
    done < <(find "$ROOT_DIR" -mindepth 1 -print 2>/dev/null)

    printf '\n%sTotal:%s %s files, %s dirs, %s\n' "$GREEN" "$RESET" "$total_files" "$total_dirs" "$(bytes_to_human "$total_bytes")"
}

render_csv() {
    printf 'path,type,size_bytes,size_human\n'
    local item
    while IFS= read -r item; do
        [ -n "$item" ] || continue
        if [ "$SHOW_HIDDEN" -eq 0 ] && has_hidden_prefix "$item"; then
            continue
        fi
        if is_excluded_path "$item"; then
            continue
        fi
        local kind size_bytes
        kind=$(item_kind "$item")
        size_bytes=$(item_size_bytes "$item")
        printf '%s,%s,%s,%s\n' "$item" "$kind" "$size_bytes" "$(bytes_to_human "$size_bytes")"
    done < <(find "$ROOT_DIR" -mindepth 1 -print 2>/dev/null | sort)
}

render_markdown() {
    printf '%s\n\n' "# Tree for $ROOT_DIR"
    local item
    while IFS= read -r item; do
        [ -n "$item" ] || continue
        if [ "$SHOW_HIDDEN" -eq 0 ] && has_hidden_prefix "$item"; then
            continue
        fi
        if is_excluded_path "$item"; then
            continue
        fi
        local kind size_bytes
        kind=$(item_kind "$item")
        size_bytes=$(item_size_bytes "$item")
        printf '%s\n' "- ${item##*/} ($kind): $(bytes_to_human "$size_bytes")"
    done < <(find "$ROOT_DIR" -mindepth 1 -print 2>/dev/null | sort)
}

render_json() {
    local item
    local index=0
    printf '{\n  "root": "%s",\n  "items": [\n' "$ROOT_DIR"
    while IFS= read -r item; do
        [ -n "$item" ] || continue
        if [ "$SHOW_HIDDEN" -eq 0 ] && has_hidden_prefix "$item"; then
            continue
        fi
        if is_excluded_path "$item"; then
            continue
        fi
        local kind size_bytes name
        kind=$(item_kind "$item")
        size_bytes=$(item_size_bytes "$item")
        name="${item##*/}"
        if [ "$index" -gt 0 ]; then
            printf ',\n'
        fi
        printf '    {"name":"%s","path":"%s","type":"%s","size_bytes":%s,"size_human":"%s"}' "$name" "$item" "$kind" "$size_bytes" "$(bytes_to_human "$size_bytes")"
        index=$((index + 1))
    done < <(find "$ROOT_DIR" -mindepth 1 -print 2>/dev/null | sort)
    printf '\n  ]\n}\n'
}

parse_arguments() {
    while [ $# -gt 0 ]; do
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

    if [ "$FILES_ONLY" -eq 1 ] && [ "$DIRS_ONLY" -eq 1 ]; then
        error "Options --files-only and --dirs-only cannot be used together"
    fi
}

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

detect_arch() {
    ARCH="$(uname -m)"
}

detect_gnu_tools() {
    if command -v gdu >/dev/null 2>&1; then
        HAS_GNU_COREUTILS=1
    fi

    if command -v gfind >/dev/null 2>&1; then
        HAS_GNU_FINDUTILS=1
    fi
}

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

initialize() {
    detect_os
    detect_arch
    detect_gnu_tools
    init_colors
    apply_default_excludes
}

main() {
    initialize
    parse_arguments "$@"
    validate_options
    load_exclude_file

    case "$OUTPUT_MODE" in
        json)
            render_json
            ;;
        csv)
            render_csv
            ;;
        markdown)
            render_markdown
            ;;
        *)
            if [ "$SUMMARY_ONLY" -eq 1 ]; then
                print_summary
            else
                render_tree "$ROOT_DIR" "" 0
                if [ "$TOP_LIMIT" -gt 0 ]; then
                    :
                fi
                printf '\n'
                print_summary
            fi
            ;;
    esac
}

main "$@"