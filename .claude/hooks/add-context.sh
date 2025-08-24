#!/usr/bin/env bash

# Hook script for adding project context to user prompts
# This script collects various project information and outputs it as context

# Get the project directory (Claude Code sets $CLAUDE_PROJECT_DIR)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 1

# Function to safely execute commands and handle errors
safe_exec() {
    local cmd="$1"
    local label="$2"
    local output
    output=$(eval "$cmd" 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$output" ]; then
        echo "### $label"
        echo "$output"
        echo ""
    fi
}

# Start context collection
echo "---PROJECT CONTEXT START---"
echo ""

# 1. Git Information
if [ -d .git ]; then
    echo "## Git Status"
    safe_exec "git branch --show-current" "Current Branch"
    safe_exec "git status --short" "Modified Files"
    safe_exec "git log -1 --oneline" "Last Commit"
fi

# 2. Docker Containers Status
if command -v docker &> /dev/null; then
    echo "## Docker Containers"
    safe_exec "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -10" "Running Containers"
fi

# 3. Project Structure (key directories)
echo "## Project Structure"
echo "Key directories:"
for dir in frontend-svelte frontend-api postgresql scripts docs; do
    if [ -d "$dir" ]; then
        echo "  ✓ $dir/"
    fi
done
echo ""

# 4. Current Tasks (from TASK.md if exists)
if [ -f "TASK.md" ]; then
    echo "## Current Tasks (from TASK.md)"
    # Extract uncompleted tasks (lines starting with - [ ])
    grep -E "^- \[ \]" TASK.md 2>/dev/null | head -5
    echo ""
fi

# 5. Recent Errors in Docker Logs (if any)
echo "## Recent Container Logs (errors/warnings)"
for container in frontend-svelte-dev frontend-api-dev; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        errors=$(docker logs "$container" 2>&1 | tail -20 | grep -iE "(error|warning|failed)" | tail -3)
        if [ -n "$errors" ]; then
            echo "### $container"
            echo "$errors"
            echo ""
        fi
    fi
done

# 6. Environment Mode
if [ -f ".env" ]; then
    echo "## Environment"
    if grep -q "NODE_ENV=production" .env 2>/dev/null; then
        echo "Mode: PRODUCTION"
    else
        echo "Mode: DEVELOPMENT"
    fi
    echo ""
fi

# 7. Test Status (if test results are available)
for test_dir in frontend-svelte/coverage frontend-api/coverage; do
    if [ -f "$test_dir/coverage-summary.json" ]; then
        echo "## Test Coverage ($(dirname $test_dir))"
        # Try to extract coverage percentage
        grep -o '"pct":[0-9.]*' "$test_dir/coverage-summary.json" 2>/dev/null | head -1 | cut -d: -f2
        echo ""
    fi
done

# 8. Custom Context (user can add custom checks here)
# Placeholder for user customization
# Example:
# safe_exec "npm list --depth=0" "Installed Packages"

echo "---PROJECT CONTEXT END---"

# Output the original user prompt (passed via stdin)
cat