# tree-size.sh Command Reference

A small directory tree and size report utility for Bash.

## Usage

```bash
tree-size.sh [OPTIONS] [DIRECTORY]
```

## Common examples

```bash
# Show a tree for the current directory
./tree-size.sh

# Show a tree for a specific folder
./tree-size.sh ~/project

# Limit depth to 3 levels
./tree-size.sh --max-depth 3 .

# Show only the largest 20 entries
./tree-size.sh --top 20 --sort size .

# Ignore files smaller than 10 MB
./tree-size.sh --min-size 10M .

# Ignore log files and node_modules
./tree-size.sh --exclude "*.log" --exclude "node_modules" .

# Show only summary information
./tree-size.sh --summary-only .

# List files only
./tree-size.sh --files-only .

# List directories only
./tree-size.sh --dirs-only .

# Reverse name sorting
./tree-size.sh --sort name --reverse .

# Output machine-readable JSON
./tree-size.sh --json --summary-only .

# Output CSV
./tree-size.sh --csv .

# Output Markdown
./tree-size.sh --markdown --top 10 .

# Disable color output
./tree-size.sh --no-color .
```

## Options

### General

- `--help`
  - Show the help screen.
  - Example: `./tree-size.sh --help`

- `--version`
  - Show the script version.
  - Example: `./tree-size.sh --version`

- `--max-depth N`
  - Limit recursion depth.
  - Use `-1` for unlimited depth.
  - Example: `./tree-size.sh --max-depth 3 .`

- `--top N`
  - Show only the top `N` largest entries.
  - Example: `./tree-size.sh --top 20 .`

- `--min-size SIZE`
  - Skip entries smaller than the given size.
  - Accepts values like `100K`, `2M`, `1G`.
  - Example: `./tree-size.sh --min-size 10M .`

### Filtering

- `--exclude PATTERN`
  - Exclude a matching path or name pattern.
  - Example: `./tree-size.sh --exclude "*.log" .`

- `--exclude-from FILE`
  - Read exclusions from a file, one pattern per line.
  - Example: `./tree-size.sh --exclude-from .gitignore .`

- `--hidden`
  - Include hidden files and directories.
  - Example: `./tree-size.sh --hidden .`

- `--follow-links`
  - Follow symbolic links during scanning.
  - Example: `./tree-size.sh --follow-links .`

### Sorting

- `--sort MODE`
  - Sort entries by `size`, `name`, `date`, or `extension`.
  - Example: `./tree-size.sh --sort name .`

- `--reverse`
  - Reverse the current sort order.
  - Example: `./tree-size.sh --sort size --reverse .`

### Output modes

- `--summary-only`
  - Show only the summary totals.
  - Example: `./tree-size.sh --summary-only .`

- `--files-only`
  - Show only files.
  - Example: `./tree-size.sh --files-only .`

- `--dirs-only`
  - Show only directories.
  - Example: `./tree-size.sh --dirs-only .`

- `--json`
  - Print JSON output.
  - Example: `./tree-size.sh --json .`

- `--csv`
  - Print CSV output.
  - Example: `./tree-size.sh --csv .`

- `--markdown`
  - Print Markdown output.
  - Example: `./tree-size.sh --markdown .`

### Display options

- `--ascii`
  - Use ASCII tree characters instead of Unicode.
  - Example: `./tree-size.sh --ascii .`

- `--no-color`
  - Disable colored output.
  - Example: `./tree-size.sh --no-color .`

## Sort behavior

The supported sort modes are:

- `size` — largest or smallest first based on byte size
- `name` — alphabetical order by entry name
- `date` — newest or oldest first by modification time
- `extension` — group by file extension name

Use `--reverse` to invert the direction.

## Notes

- The script accepts a directory argument; if omitted, it scans the current directory (`.`).
- Default output is the terminal tree view.
- Exclusions are applied before printing entries.
- The script validates invalid sort values and unknown options.
