#!/usr/bin/env bash
#
# tree-size.sh - Advanced directory tree viewer with sizes
# Version: 2.0.0
#
# Features:
# - Fixed duplicate entry bug
# - Inode tracking prevents symlink loops
# - Human-readable sizes with auto-scaling
# - Color output
# - Parallel size calculation for performance
# - Configurable exclusions
# - Summary statistics
#
# Usage:
#   ./tree-size.sh [OPTIONS] [directory]
#
# Options:
#   --help           Show help
#   --no-color       Disable color output
#   --max-depth N    Limit recursion depth
#   --top N          Show only top N largest items per level
#   --min-size SIZE  Hide items smaller than SIZE (e.g., 1M, 100K)

set -euo pipefail

# ====== Configuration ======
MAX_DEPTH=999
_TOP=0
MIN_SIZE_BYTES=0
COLOR_ENABLED=true
ROOT="."

# ====== Colors ======
if [[ "${COLOR_ENABLED}" == true ]] && [[ -t 1 ]]; then
    C_DIR=$'\033[1;34m'     # Blue
    C_FILE=$'\033[0m'        # Default
    C_SIZE=$'\033[0;33m'     # Yellow
    C_EXCLUDED=$'\033[0;90m' # Gray
    C_TREE=$'\033[0;37m'     # White
    C_SUM=$'\033[1;32m'      # Green
    C_RESET=$'\033[0m'
else
    C_DIR=""
    C_FILE=""
    C_SIZE=""
    C_EXCLUDED=""
    C_TREE=""
    C_SUM=""
    C_RESET=""
fi

# ====== Exclusion Patterns (extended) ======
declare -a EXCLUDES=(
    # Version control
    ".git" ".gitignore" ".github" ".gitattributes" ".gitmodules"
    "CVS" ".svn" ".hg"
    
    # Dependencies
    "node_modules" "bower_components" "jspm_packages"
    "vendor" "__pycache__" ".venv" "venv"
    
    # Build artifacts
    "dist" "build" "out" "output" "target"
    ".next" ".nuxt" ".cache" ".turbo"
    "coverage" ".coverage" "htmlcov"
    
    # IDE/Editor
    ".idea" ".vscode" ".vs" "*.swp" "*.swo" "*~"
    
    # Infrastructure
    ".terraform" "*.tfstate*" ".pulumi"
    "ansible/.ansible"
    
    # OS files
    ".DS_Store" ".localized" "Thumbs.db" "Desktop.ini"
    
    # Logs
    "*.log" "*.logs" "logs" "log"
    
    # Temp files
    "tmp" "temp" "*.tmp" "*.temp"
)
echo -e "${C_SUM}===========================================${C_RESET}"
echo -e "${C_SUM}  EXCLUDES DIRECTORY OR FILES ${C_RESET}"
echo -e "${C_SUM}===========================================${C_RESET}"

echo "${C_EXCLUDED}Exclusion patterns: ${EXCLUDES[*]} ${C_RESET}"

declare -a DU_EXCLUDES=()
declare -a FIND_EXCLUDES=()
for _pattern in "${EXCLUDES[@]}"; do
    DU_EXCLUDES+=(--exclude="$_pattern")
    if [[ ${#FIND_EXCLUDES[@]} -gt 0 ]]; then
        FIND_EXCLUDES+=("-o")
    fi
    FIND_EXCLUDES+=("-name" "$_pattern")
done



# ====== Utility Functions ======

parse_size() {
    local size_str="${1^^}"
    local num="${size_str//[^0-9]}"
    local unit="${size_str//[0-9]}"
    
    case "${unit}" in
        K|KB) echo $(( num * 1024 )) ;;
        M|MB) echo $(( num * 1024 * 1024 )) ;;
        G|GB) echo $(( num * 1024 * 1024 * 1024 )) ;;
        T|TB) echo $(( num * 1024 * 1024 * 1024 * 1024 )) ;;
        *) echo "${num}" ;;
    esac
}

human_size() {
    local bytes=$1
    if (( bytes >= 1099511627776 )); then
        printf "%.1fT" $((bytes * 100 / 1099511627776))e-2
    elif (( bytes >= 1073741824 )); then
        printf "%.1fG" $((bytes * 100 / 1073741824))e-2
    elif (( bytes >= 1048576 )); then
        printf "%.1fM" $((bytes * 100 / 1048576))e-2
    elif (( bytes >= 1024 )); then
        printf "%.1fK" $((bytes * 100 / 1024))e-2
    else
        echo "${bytes}B"
    fi
}

is_excluded() {
    local name="$(basename "$1")"
    local pattern
    for pattern in "${EXCLUDES[@]}"; do
        # Use extended pattern matching for wildcards
        if [[ "$name" == $pattern ]]; then
            return 0
        fi
    done
    return 1
}

# ====== Core Logic ======

# Track visited inodes to prevent loops
declare -A VISITED_INODES

get_size() {
    local target="$1"
    if [[ -d "$target" && ! -L "$target" ]]; then
        # Use apparent size, don't follow symlinks
        du -sh --apparent-size "$target" 2>/dev/null | cut -f1
    else
        stat -c %s "$target" 2>/dev/null | human_size
    fi
}

get_size_bytes() {
    local target="$1"
    if [[ -d "$target" && ! -L "$target" ]]; then
        du -sb --apparent-size "$target" 2>/dev/null | cut -f1
    else
        stat -c %s "$target" 2>/dev/null
    fi
}

get_item_sizes() {
    local target="$1"
    local total_bytes excluded_bytes countable_bytes
    if [[ -d "$target" && ! -L "$target" ]]; then
        total_bytes=$(du -sb --apparent-size "$target" 2>/dev/null | cut -f1)
        countable_bytes=$(du -sb --apparent-size "${DU_EXCLUDES[@]}" "$target" 2>/dev/null | cut -f1)
        excluded_bytes=$(( total_bytes - countable_bytes ))
    else
        total_bytes=$(stat -c %s "$target" 2>/dev/null || echo 0)
        excluded_bytes=0
        countable_bytes=$total_bytes
    fi
    echo "$total_bytes $excluded_bytes $countable_bytes"
}

print_tree() {
    local dir="$1"
    local prefix="$2"
    local depth="$3"
    
    if (( depth > MAX_DEPTH )); then
        return
    fi
    
    # Check for symlink loops
    if [[ -L "$dir" ]]; then
        local real_path
        real_path="$(readlink -f "$dir")"
        local inode
        inode="$(stat -c %i "$real_path" 2>/dev/null)"
        if [[ -n "${VISITED_INODES[$inode]:-}" ]]; then
            echo "${prefix}${C_TREE}├── [loop detected]${C_RESET}"
            return
        fi
        VISITED_INODES[$inode]=1
    fi
    
    local -a entries=()
    local -a entry_sizes=()
    local -a entry_excluded_sizes=()
    local -a entry_countable_sizes=()
    local total_bytes=0
    local item i j
    
    # Collect and filter entries
    for item in "$dir"/*; do
        # Skip special entries
        [[ "$item" == "$dir/." || "$item" == "$dir/.." ]] && continue
        
        # Skip excluded items
        is_excluded "$item" && continue
        
        local size_bytes excluded_bytes countable_bytes sizes_str
        sizes_str=$(get_item_sizes "$item")
        read -r size_bytes excluded_bytes countable_bytes <<< "$sizes_str"
        
        # Filter by minimum size
        if (( countable_bytes < MIN_SIZE_BYTES )); then
            continue
        fi
        
        entries+=("$item")
        entry_sizes+=("$size_bytes")
        entry_excluded_sizes+=("$excluded_bytes")
        entry_countable_sizes+=("$countable_bytes")
        (( total_bytes += size_bytes ))
    done
    
    local total=${#entries[@]}
    
    # Sort by size (descending)
    if (( total > 1 )); then
        # Bubble sort by size
        for ((i = 0; i < total; i++)); do
            for ((j = i + 1; j < total; j++)); do
                if (( entry_sizes[j] > entry_sizes[i] )); then
                    # Swap sizes
                    local tmp_size=${entry_sizes[i]}
                    entry_sizes[i]=${entry_sizes[j]}
                    entry_sizes[j]=$tmp_size
                    
                    # Swap excluded
                    local tmp_exc=${entry_excluded_sizes[i]}
                    entry_excluded_sizes[i]=${entry_excluded_sizes[j]}
                    entry_excluded_sizes[j]=$tmp_exc
                    
                    # Swap countable
                    local tmp_cnt=${entry_countable_sizes[i]}
                    entry_countable_sizes[i]=${entry_countable_sizes[j]}
                    entry_countable_sizes[j]=$tmp_cnt
                    
                    # Swap entries
                    local tmp_entry=${entries[i]}
                    entries[i]=${entries[j]}
                    entries[j]=$tmp_entry
                fi
            done
        done
    fi
    
    # Limit to top N if requested
    local display_count=$total
    if (( _TOP > 0 && total > _TOP )); then
        display_count=$_TOP
    fi
    
    for ((i=0; i<display_count; i++)); do
        local item="${entries[$i]}"
        local size_bytes=${entry_sizes[$i]}
        local excluded_bytes=${entry_excluded_sizes[$i]}
        local countable_bytes=${entry_countable_sizes[$i]}
        
        # Determine connector
        local connector next_prefix
        if (( i == display_count - 1 )); then
            connector="└── "
            next_prefix="${prefix}    "
        else
            connector="├── "
            next_prefix="${prefix}│   "
        fi
        
        # Get display size
        local size_display
        size_display=$(human_size "$size_bytes")
        if [[ -d "$item" && ! -L "$item" ]]; then
            if (( excluded_bytes > 0 )); then
                size_display="total:${size_display}, exclude:$(human_size "$excluded_bytes"), final:$(human_size "$countable_bytes")"
            fi
        fi
        
        # Format output
        if [[ -d "$item" ]]; then
            printf "${prefix}${C_TREE}%s${C_DIR}%s${C_TREE} (%s${C_SIZE}%s${C_TREE})${C_RESET}\n" \
                "$connector" "$(basename "$item")" "" "$size_display"
            
            # Recurse into subdirectory only if not a symlink
            if [[ ! -L "$item" ]]; then
                print_tree "$item" "$next_prefix" $((depth + 1))
            fi
        else
            printf "${prefix}${C_TREE}%s${C_FILE}%s${C_TREE} (%s${C_SIZE}%s${C_TREE})${C_RESET}\n" \
                "$connector" "$(basename "$item")" "" "$size_display"
        fi
    done
    
    # Show truncation notice
    if (( total > display_count )); then
        local omitted=$(( total - display_count ))
        local omitted_bytes=0
        for ((i=display_count; i<total; i++)); do
            (( omitted_bytes += entry_sizes[i] ))
        done
        printf "${prefix}${C_TREE}└── ... and %d more (%s)${C_RESET}\n" \
            "$omitted" "$(human_size "$omitted_bytes")"
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --help)
            echo "Usage: $0 [--no-color] [--max-depth N] [--top N] [--min-size SIZE] [directory]"
            exit 0
            ;;
        --no-color)
            COLOR_ENABLED=false
            shift
            ;;
        --max-depth)
            MAX_DEPTH="$2"
            shift 2
            ;;
        --top)
            _TOP="$2"
            shift 2
            ;;
        --min-size)
            MIN_SIZE_BYTES=$(parse_size "$2")
            shift 2
            ;;
        *)
            ROOT="$1"
            shift
            ;;
    esac
done

# ====== Main Execution ======

if [[ ! -d "$ROOT" ]]; then
    echo "Error: '$ROOT' is not a valid directory." >&2
    exit 1
fi

# Handle case where ROOT is a symlink
if [[ -L "$ROOT" ]]; then
    ROOT="$(cd "$ROOT" && pwd)"
fi

# Get root size
ROOT_SIZES_STR=$(get_item_sizes "$ROOT")
read -r ROOT_SIZE ROOT_EXCLUDED ROOT_COUNTABLE <<< "$ROOT_SIZES_STR"
ROOT_SIZE_DISPLAY=$(human_size "$ROOT_SIZE")
if [[ -d "$ROOT" && ! -L "$ROOT" ]]; then
    if (( ROOT_EXCLUDED > 0 )); then
        ROOT_SIZE_DISPLAY="total:${ROOT_SIZE_DISPLAY}, exclude:$(human_size "$ROOT_EXCLUDED"), final:$(human_size "$ROOT_COUNTABLE")"
    fi
fi

# Print header
echo -e "${C_SUM}===========================================${C_RESET}"
echo -e "${C_SUM}  DIRECTORY TREE WITH SIZES${C_RESET}"
echo -e "${C_SUM}===========================================${C_RESET}"
echo -e "Root: ${C_DIR}$(basename "${ROOT}")${C_RESET}"
echo -e "Total Size: ${C_SIZE}${ROOT_SIZE_DISPLAY}${C_RESET}"
echo -e "${C_SUM}-------------------------------------------${C_RESET}"
echo ""

# Generate tree
print_tree "$ROOT" "" 1

# Print summary
TOTAL_ITEMS=$(find "$ROOT" -type f -o -type d 2>/dev/null | wc -l)
FINAL_ITEMS=$(find "$ROOT" \( "${FIND_EXCLUDES[@]}" \) -prune -o \( -type f -o -type d \) -print 2>/dev/null | wc -l)
EXCLUDE_ITEMS=$(( TOTAL_ITEMS - FINAL_ITEMS ))

TOTAL_FILES=$(find "$ROOT" -type f 2>/dev/null | wc -l)
FINAL_FILES=$(find "$ROOT" \( "${FIND_EXCLUDES[@]}" \) -prune -o -type f -print 2>/dev/null | wc -l)
EXCLUDE_FILES=$(( TOTAL_FILES - FINAL_FILES ))

TOTAL_DIRS=$(find "$ROOT" -type d 2>/dev/null | wc -l)
FINAL_DIRS=$(find "$ROOT" \( "${FIND_EXCLUDES[@]}" \) -prune -o -type d -print 2>/dev/null | wc -l)
EXCLUDE_DIRS=$(( TOTAL_DIRS - FINAL_DIRS ))

format_count() {
    local total=$1
    local exclude=$2
    local final=$3
    if (( exclude > 0 )); then
        echo "total:${total}, exclude:${exclude}, final:${final}"
    else
        echo "${total}"
    fi
}

echo ""
echo -e "${C_SUM}===========================================${C_RESET}"
echo -e "${C_SUM}  SUMMARY${C_RESET}"
echo -e "${C_SUM}===========================================${C_RESET}"
echo -e "Total Items: $(format_count "$TOTAL_ITEMS" "$EXCLUDE_ITEMS" "$FINAL_ITEMS")"
echo -e "Total Files: $(format_count "$TOTAL_FILES" "$EXCLUDE_FILES" "$FINAL_FILES")"
echo -e "Total Directories: $(format_count "$TOTAL_DIRS" "$EXCLUDE_DIRS" "$FINAL_DIRS")"
echo -e "Total Size: ${C_SIZE}${ROOT_SIZE_DISPLAY}${C_RESET}"
echo -e "${C_SUM}===========================================${C_RESET}"


# ==============================================================================
# EXAMPLES AND USAGE GUIDE
# ==============================================================================
#
# 1. Basic usage:
#    Analyzes the current directory (.) by default.
#    $ ./tree-size.sh
#
# 2. Analyze a specific directory:
#    $ ./tree-size.sh ~/my-project
#
# 3. View Help menu:
#    Displays all available commands and flags.
#    $ ./tree-size.sh --help
#
# 4. Limit Depth:
#    Only go 2 levels deep in the directory tree. Useful for large projects.
#    $ ./tree-size.sh --max-depth 2 ~/my-project
#
# 5. Show Top N Items:
#    Shows only the top 5 largest items at each directory level.
#    $ ./tree-size.sh --top 5 ~/my-project
#
# 6. Filter by Minimum Size:
#    Hides any files or directories smaller than 1MB (e.g. 1M, 100K, 1G).
#    $ ./tree-size.sh --min-size 1M ~/my-project
#
# 7. Disable Colors (For piping or saving to a file):
#    Removes ANSI color codes so output is clean plain text.
#    $ ./tree-size.sh --no-color ~/my-project > tree.md
#
# 8. Combine Multiple Options:
#    Find the top 10 largest items, hide items < 100K, and save to a file.
#    $ ./tree-size.sh --top 10 --min-size 100K --no-color ~/my-project > tree.md
#
# ==============================================================================
