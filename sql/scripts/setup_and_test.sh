#!/bin/bash
# Comprehensive setup and test script for execute_sql_parallel.py
# Tests: Connection, DDL, Indexes, CRUD operations, Parallel execution, Cleanup
# Author: Claude Code
# Date: 2025-11-02

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$SCRIPT_DIR"

VENV_DIR="$SQL_ROOT/venv"
TESTS_DIR="$SCRIPT_DIR/tests"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${CYAN}================================================================================"
echo "Setup and Comprehensive Test Suite"
echo "================================================================================${NC}"

# =============================================================================
# PHASE 1: Setup
# =============================================================================

echo -e "\n${BLUE}Phase 1: Environment Setup${NC}"
echo "--------------------------------------------------------------------------------"

# Check Python version
echo -e "${CYAN}Checking Python version...${NC}"
python3 --version || {
    echo -e "${RED}❌ Python 3 not found. Please install Python 3.8+${NC}"
    exit 1
}
echo -e "${GREEN}✓ Python 3 detected${NC}"

# Create virtual environment if not exists
if [ ! -d "$VENV_DIR" ]; then
    echo ""
    echo -e "${CYAN}Creating virtual environment...${NC}"
    python3 -m venv "$VENV_DIR" || {
        echo -e "${RED}❌ Failed to create virtual environment${NC}"
        echo -e "${YELLOW}Install python3-venv: sudo apt install python3-venv${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ Virtual environment created at: $VENV_DIR${NC}"
else
    echo ""
    echo -e "${GREEN}✓ Virtual environment exists at: $VENV_DIR${NC}"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Install dependencies
echo ""
echo -e "${CYAN}Installing dependencies into venv...${NC}"
pip install -q --upgrade pip
pip install -q -r requirements.txt || {
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
}
echo -e "${GREEN}✓ Dependencies installed (asyncpg, python-dotenv, rich)${NC}"

# Check postgresql.env
echo ""
echo -e "${CYAN}Checking postgresql.env...${NC}"
if [ ! -f "postgresql.env" ]; then
    echo -e "${RED}❌ postgresql.env not found in current directory${NC}"
    echo -e "${YELLOW}Creating template...${NC}"
    cat > postgresql.env << 'EOF'
# PostgreSQL Connection Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=familybudget
POSTGRES_USER=familybudget
POSTGRES_PASSWORD=your_secure_password_here
EOF
    echo -e "${GREEN}✓ Template created at postgresql.env${NC}"
    echo -e "${RED}⚠️  Please update POSTGRES_PASSWORD before running!${NC}"
    deactivate
    exit 0
else
    echo -e "${GREEN}✓ postgresql.env found${NC}"
fi

# Create tests directory if not exists
if [ ! -d "$TESTS_DIR" ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Tests directory not found. Test SQL files should be in: $TESTS_DIR${NC}"
    mkdir -p "$TESTS_DIR"
    echo -e "${GREEN}✓ Created tests directory${NC}"
fi

echo ""
echo -e "${GREEN}================================================================================"
echo "✓ Phase 1 Complete: Environment Ready"
echo "================================================================================${NC}"

# =============================================================================
# PHASE 2: Database Testing
# =============================================================================

echo -e "\n${BLUE}Phase 2: Comprehensive Database Tests${NC}"
echo "--------------------------------------------------------------------------------"

# Test files in order
TEST_FILES=(
    "01_test_connection.sql"
    "02_test_create_table.sql"
    "03_test_create_indexes.sql"
    "04_test_insert_batch.sql"
    "05_test_update_records.sql"
    "06_test_delete_records.sql"
    "07_test_cleanup.sql"
)

TEST_DESCRIPTIONS=(
    "Database Connection & Permissions"
    "Table Creation (DDL)"
    "Index Creation & Optimization"
    "Batch Insert (Parallel Execution)"
    "Update Records (SCD Type 2)"
    "Delete Records (Hard & Soft)"
    "Cleanup Test Artifacts"
)

TOTAL_TESTS=${#TEST_FILES[@]}
PASSED_TESTS=0
FAILED_TESTS=0

# Execute each test
for idx in "${!TEST_FILES[@]}"; do
    file="${TEST_FILES[$idx]}"
    desc="${TEST_DESCRIPTIONS[$idx]}"
    num=$((idx + 1))
    test_file="$TESTS_DIR/$file"

    echo ""
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}Test $num/$TOTAL_TESTS: $desc${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════════════════════${NC}"

    if [ ! -f "$test_file" ]; then
        echo -e "${RED}❌ Test file not found: $test_file${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        continue
    fi

    START=$(date +%s)

    # Execute test using parallel executor
    python execute_sql_parallel.py \
        --file "$test_file" \
        --max-connections 10 \
        --env "postgresql.env"

    EXIT_CODE=$?
    END=$(date +%s)
    DURATION=$((END - START))

    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ Test $num PASSED: $desc (${DURATION}s)${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ Test $num FAILED: $desc (exit code: $EXIT_CODE)${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))

        # Ask to continue or abort
        echo ""
        read -p "Continue with remaining tests? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Test suite aborted after failure${NC}"
            break
        fi
    fi
done

# Deactivate virtual environment
deactivate

# =============================================================================
# PHASE 3: Summary
# =============================================================================

echo ""
echo -e "${CYAN}================================================================================"
echo "Test Suite Summary"
echo "================================================================================${NC}"
echo "Total tests:     $TOTAL_TESTS"
echo -e "Passed:          ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:          ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}================================================================================"
    echo "✅ All tests passed successfully!"
    echo "================================================================================${NC}"
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo "  1. Review postgresql.env credentials"
    echo "  2. Generate SQL files from CSV:"
    echo "     cd $SCRIPT_DIR"
    echo "     source $VENV_DIR/bin/activate"
    echo "     python transform_csv_to_sql.py"
    echo "     deactivate"
    echo "  3. Execute SQL files:"
    echo "     cd $SCRIPT_DIR && ./execute_all.sh"
    echo ""
    exit 0
else
    echo -e "${RED}================================================================================"
    echo "⚠️  $FAILED_TESTS test(s) failed"
    echo "================================================================================${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "  1. Check PostgreSQL is running:"
    echo "     docker ps | grep postgres"
    echo "  2. Verify postgresql.env credentials:"
    echo "     cat postgresql.env"
    echo "  3. Test connection manually:"
    echo "     psql -h \$(grep POSTGRES_HOST postgresql.env | cut -d= -f2) \\"
    echo "          -U \$(grep POSTGRES_USER postgresql.env | cut -d= -f2) \\"
    echo "          -d \$(grep POSTGRES_DB postgresql.env | cut -d= -f2)"
    echo "  4. Check PostgreSQL logs for errors"
    echo ""
    exit 1
fi
