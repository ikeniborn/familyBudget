#!/bin/bash
# Quick validation of frontend structure
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Validating frontend paths..."

test -d "$PROJECT_ROOT/frontend" && echo "✓ frontend/" || { echo "✗ frontend/"; exit 1; }
test -d "$PROJECT_ROOT/frontend/web" && echo "✓ frontend/web/" || { echo "✗ frontend/web/"; exit 1; }
test -d "$PROJECT_ROOT/frontend/webapp" && echo "✓ frontend/webapp/" || { echo "✗ frontend/webapp/"; exit 1; }
test -d "$PROJECT_ROOT/frontend/shared" && echo "✓ frontend/shared/" || { echo "✗ frontend/shared/"; exit 1; }
test -f "$PROJECT_ROOT/backend/app/core/paths.py" && echo "✓ backend/app/core/paths.py" || { echo "✗ backend/app/core/paths.py"; exit 1; }

echo "✓ All paths validated successfully"
