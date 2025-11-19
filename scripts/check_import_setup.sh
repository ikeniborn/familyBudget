#!/bin/bash
# Helper script to check import infrastructure on server
# Usage: ./scripts/check_import_setup.sh

echo "🔍 Checking Tinkoff Import Infrastructure..."
echo ""

# Detect docker compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Neither 'docker compose' nor 'docker-compose' found!"
    exit 1
fi

echo "Using: $DOCKER_COMPOSE"
echo ""

DB_NAME="${DB_NAME:-familybudget}"
DB_USER="${DB_USER:-postgres}"

echo "📊 1. Checking if backend container is running..."
if $DOCKER_COMPOSE ps backend | grep -q "Up"; then
    echo "✅ Backend container is running"
    echo ""
    echo "📊 2. Checking Alembic migration status..."
    $DOCKER_COMPOSE exec -T backend alembic current || {
        echo "⚠️  Could not check Alembic status"
    }
else
    echo "⚠️  Backend container is NOT running. Skipping Alembic check."
    echo "   To start: cd /opt/budget && docker compose up -d"
fi

echo ""
echo "📋 3. Checking if t_import_staging table exists..."
if $DOCKER_COMPOSE exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "\d t_import_staging" 2>/dev/null | grep -q "Table"; then
    echo "✅ Table t_import_staging exists"

    echo ""
    echo "📊 4. Checking table structure..."
    $DOCKER_COMPOSE exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "\d+ t_import_staging" 2>/dev/null

    echo ""
    echo "📈 5. Checking staging records count..."
    $DOCKER_COMPOSE exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) as staging_count FROM t_import_staging;" 2>/dev/null
else
    echo "❌ Table t_import_staging does NOT exist!"
    echo "   Need to run migration: alembic upgrade head"
fi

echo ""
echo "🔑 6. Checking import endpoints in router..."
if [ -f "backend/app/api/v1/router.py" ]; then
    grep -n "import_router" backend/app/api/v1/router.py && echo "✅ import_router found in v1 router" || echo "⚠️  import_router not found in v1 router!"
else
    echo "⚠️  Not in project root directory"
fi

echo ""
echo "🔍 7. Checking import services..."
if [ -f "backend/app/services/tinkoff_csv_parser.py" ]; then
    echo "✅ tinkoff_csv_parser.py exists"
else
    echo "❌ tinkoff_csv_parser.py NOT found!"
fi

if [ -f "backend/app/services/import_executor.py" ]; then
    echo "✅ import_executor.py exists"
else
    echo "❌ import_executor.py NOT found!"
fi

if [ -f "backend/app/models/import_staging.py" ]; then
    echo "✅ import_staging.py model exists"
else
    echo "❌ import_staging.py model NOT found!"
fi

echo ""
echo "📋 Summary of checks completed!"
echo ""
echo "💡 To see backend logs:"
echo "   cd /opt/budget && $DOCKER_COMPOSE logs backend --tail=50"
echo ""
echo "💡 To see recent errors:"
echo "   cd /opt/budget && $DOCKER_COMPOSE logs backend --tail=100 | grep -i error"
