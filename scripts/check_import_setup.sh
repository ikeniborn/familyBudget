#!/bin/bash
# Helper script to check import infrastructure on server
# Usage: ./scripts/check_import_setup.sh

set -e

echo "🔍 Checking Tinkoff Import Infrastructure..."
echo ""

# Check if running in Docker
if [ -f /.dockerenv ]; then
    DB_HOST="postgres"
else
    DB_HOST="${DB_HOST:-localhost}"
fi

DB_NAME="${DB_NAME:-familybudget}"
DB_USER="${DB_USER:-postgres}"

echo "📊 1. Checking Alembic migration status..."
docker compose exec backend alembic current 2>/dev/null || {
    echo "❌ Failed to check Alembic status. Is backend container running?"
    exit 1
}

echo ""
echo "📋 2. Checking if t_import_staging table exists..."
docker compose exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c "\d t_import_staging" 2>/dev/null || {
    echo "❌ Table t_import_staging does NOT exist!"
    echo "   Need to run migration: alembic upgrade head"
    exit 1
}

echo ""
echo "📊 3. Checking table structure..."
docker compose exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c "\d+ t_import_staging" 2>/dev/null

echo ""
echo "📈 4. Checking staging records count..."
docker compose exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) as staging_count FROM t_import_staging;" 2>/dev/null

echo ""
echo "🔑 5. Checking import endpoints in router..."
grep -n "import_router" backend/app/api/v1/router.py || echo "⚠️  import_router not found in v1 router!"

echo ""
echo "✅ All checks completed!"
