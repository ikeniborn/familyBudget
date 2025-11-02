#!/bin/bash
# Wrapper script to run execute_sql_parallel.py in isolated environment
# Author: Claude Code
# Date: 2025-11-02

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$SCRIPT_DIR"

VENV_DIR="$SQL_ROOT/venv"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if venv exists, create if not
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not found. Setting up...${NC}"
    echo ""
    ./setup_and_test.sh || {
        echo -e "${RED}❌ Setup failed${NC}"
        exit 1
    }
    echo ""
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Run execute_sql_parallel.py with all arguments passed to this script
python execute_sql_parallel.py "$@"

EXIT_CODE=$?

# Deactivate virtual environment
deactivate

exit $EXIT_CODE
