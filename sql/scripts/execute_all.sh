#!/bin/bash
# Execute all SQL files in correct order
# Author: Claude Code
# Date: 2025-11-02

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$SCRIPT_DIR"

VENV_DIR="$SQL_ROOT/venv"
QUERIES_DIR="$SQL_ROOT/queries"

# Configuration
MAX_CONNECTIONS=50
ENV_FILE="$SCRIPT_DIR/postgresql.env"

# SQL files in execution order
# NOTE: 05_create_partitions_t_f_budget_fact.sql REMOVED
#       Partitions are now created via Alembic baseline migration (backend/db/migrations/)
#       This eliminates the overlap conflict between yearly and monthly partitions
SQL_FILES=(
    "$QUERIES_DIR/01_insert_t_d_financial_center.sql"
    "$QUERIES_DIR/02_insert_t_d_cost_center.sql"
    "$QUERIES_DIR/03_insert_t_d_article_parents.sql"
    "$QUERIES_DIR/04_insert_t_d_article_children.sql"
    "$QUERIES_DIR/06_insert_t_f_budget_fact.sql"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================"
echo "Execute All SQL Files"
echo "========================================${NC}"
echo ""
echo "Files to execute: ${#SQL_FILES[@]}"
echo "Max connections: $MAX_CONNECTIONS"
echo "Env file: $ENV_FILE"
echo ""

# Check prerequisites
if [ ! -f "execute_sql_parallel.py" ]; then
    echo -e "${RED}❌ execute_sql_parallel.py not found${NC}"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ postgresql.env not found at: $ENV_FILE${NC}"
    exit 1
fi

# Check virtual environment
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not found. Running setup...${NC}"
    ./setup_and_test.sh || {
        echo -e "${RED}❌ Setup failed${NC}"
        exit 1
    }
fi

# Activate virtual environment
echo -e "${CYAN}Activating virtual environment...${NC}"
source "$VENV_DIR/bin/activate"
echo -e "${GREEN}✓ Virtual environment activated${NC}"
echo ""

# Confirmation prompt
read -p "Execute all ${#SQL_FILES[@]} files? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted"
    deactivate
    exit 0
fi

echo ""

# Execute each file
TOTAL_START=$(date +%s)
SUCCESS_COUNT=0
FAIL_COUNT=0

for idx in "${!SQL_FILES[@]}"; do
    file="${SQL_FILES[$idx]}"
    num=$((idx + 1))
    filename=$(basename "$file")

    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}[$num/${#SQL_FILES[@]}] Executing: $filename${NC}"
    echo -e "${CYAN}========================================${NC}"

    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ File not found: $file${NC}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        continue
    fi

    START=$(date +%s)

    python execute_sql_parallel.py \
        --file "$file" \
        --max-connections $MAX_CONNECTIONS \
        --env "$ENV_FILE"

    EXIT_CODE=$?
    END=$(date +%s)
    DURATION=$((END - START))

    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ Success: $filename (${DURATION}s)${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}❌ Failed: $filename (exit code: $EXIT_CODE)${NC}"
        FAIL_COUNT=$((FAIL_COUNT + 1))

        # Ask to continue or abort
        echo ""
        read -p "Continue with remaining files? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Aborted after failure"
            break
        fi
    fi

    echo ""
done

TOTAL_END=$(date +%s)
TOTAL_DURATION=$((TOTAL_END - TOTAL_START))

# Deactivate virtual environment
deactivate

# Summary
echo ""
echo -e "${CYAN}========================================"
echo "Execution Summary"
echo "========================================${NC}"
echo "Total files:     ${#SQL_FILES[@]}"
echo -e "Successful:      ${GREEN}$SUCCESS_COUNT${NC}"
echo -e "Failed:          ${RED}$FAIL_COUNT${NC}"
echo "Total duration:  ${TOTAL_DURATION}s"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ All files executed successfully!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  $FAIL_COUNT file(s) failed${NC}"
    exit 1
fi
