#!/bin/bash
# Frontend Paths Validation Script
# Проверяет существование всех ключевых путей frontend структуры

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Счетчики
TOTAL=0
PASSED=0
FAILED=0

# Функция проверки пути
check_path() {
    local path="$1"
    local description="$2"

    TOTAL=$((TOTAL + 1))

    if [[ -e "$path" ]]; then
        echo -e "${GREEN}✓${NC} $description: $path"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $description: $path (NOT FOUND)"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Определяем базовую директорию
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "======================================"
echo "Frontend Paths Validation"
echo "======================================"
echo "Project root: $PROJECT_ROOT"
echo ""

# Frontend root
echo "1. Frontend Root Structure:"
check_path "$PROJECT_ROOT/frontend" "Frontend root directory"
check_path "$PROJECT_ROOT/frontend/web" "Web UI directory"
check_path "$PROJECT_ROOT/frontend/webapp" "Telegram Web Apps directory"
check_path "$PROJECT_ROOT/frontend/shared" "Shared modules directory"
echo ""

# Web структура
echo "2. Web UI Structure:"
check_path "$PROJECT_ROOT/frontend/web/static" "Web static directory"
check_path "$PROJECT_ROOT/frontend/web/static/js" "Web JavaScript directory"
check_path "$PROJECT_ROOT/frontend/web/static/css" "Web CSS directory"
check_path "$PROJECT_ROOT/frontend/web/templates" "Web templates directory"
check_path "$PROJECT_ROOT/frontend/web/templates/base.html" "Web base template"
echo ""

# Webapp структура
echo "3. Telegram Web Apps Structure:"
check_path "$PROJECT_ROOT/frontend/webapp/static" "Webapp static directory"
check_path "$PROJECT_ROOT/frontend/webapp/static/js" "Webapp JavaScript directory"
check_path "$PROJECT_ROOT/frontend/webapp/static/css" "Webapp CSS directory"
check_path "$PROJECT_ROOT/frontend/webapp/index.html" "Webapp index file"
check_path "$PROJECT_ROOT/frontend/webapp/add.html" "Webapp add transaction form"
echo ""

# Shared структура
echo "4. Shared Modules Structure:"
check_path "$PROJECT_ROOT/frontend/shared/static" "Shared static directory"
check_path "$PROJECT_ROOT/frontend/shared/static/js" "Shared JavaScript directory"
check_path "$PROJECT_ROOT/frontend/shared/static/js/calendar-widget.js" "Calendar widget module"
check_path "$PROJECT_ROOT/frontend/shared/static/js/dateFormatter.js" "Date formatter module"
echo ""

# Backend paths.py
echo "5. Backend Configuration:"
check_path "$PROJECT_ROOT/backend/app/core/paths.py" "FrontendPaths configuration"
echo ""

# Итоговый отчет
echo "======================================"
echo "Validation Summary"
echo "======================================"
echo -e "Total checks: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}✓ All frontend paths are valid!${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILED path(s) are missing!${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Did you run 'git mv web frontend/web'?"
    echo "2. Did you run 'git mv webapp frontend/webapp'?"
    echo "3. Did you run 'git mv shared frontend/shared'?"
    echo "4. Did you create backend/app/core/paths.py?"
    exit 1
fi
