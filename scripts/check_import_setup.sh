#!/bin/bash
# Helper script to check import infrastructure on server
# Usage: ./scripts/check_import_setup.sh

echo "🔍 Checking Tinkoff Import Infrastructure..."
echo ""

DB_NAME="${DB_NAME:-familybudget}"
DB_USER="${DB_USER:-postgres}"
BUDGET_DIR="/opt/budget"

# Find backend container name
BACKEND_CONTAINER=$(docker ps --filter "name=backend" --format "{{.Names}}" | head -1)
# Try multiple patterns for postgres container
POSTGRES_CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "(postgres|familybudget.*postgres)" | head -1)

echo "📊 1. Checking if backend container is running..."
if [ -n "$BACKEND_CONTAINER" ]; then
    echo "✅ Backend container is running: $BACKEND_CONTAINER"
    echo ""
    echo "📊 2. Checking Alembic migration status..."
    docker exec -i "$BACKEND_CONTAINER" sh -c "cd /app/backend/db/migrations && alembic current" 2>/dev/null || {
        echo "⚠️  Could not check Alembic status"
    }
else
    echo "❌ Backend container is NOT running!"
    echo "   To start: cd /opt/budget && docker-compose up -d backend"
    echo ""
    echo "   Current docker containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
fi

echo ""
echo "📋 3. Checking if t_import_staging table exists..."
if [ -n "$POSTGRES_CONTAINER" ]; then
    echo "   Using postgres container: $POSTGRES_CONTAINER"

    # Check if table exists
    TABLE_CHECK=$(docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 't_import_staging');" 2>/dev/null | tr -d '[:space:]')

    if [ "$TABLE_CHECK" = "t" ]; then
        echo "✅ Table t_import_staging exists"

        echo ""
        echo "📊 4. Checking table structure..."
        docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "\d+ t_import_staging" 2>/dev/null | head -30

        echo ""
        echo "📈 5. Checking staging records count..."
        docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) as staging_count FROM t_import_staging;" 2>/dev/null
    else
        echo "❌ Table t_import_staging does NOT exist!"
        echo "   Database: $DB_NAME"
        echo "   Need to run migration:"
        echo "   docker exec -i $BACKEND_CONTAINER sh -c 'cd /app/backend/db/migrations && alembic upgrade head'"
    fi
else
    echo "❌ Postgres container is NOT running!"
    echo "   Available containers:"
    docker ps --format "   - {{.Names}}"
fi

echo ""
echo "🔑 6. Checking import endpoints in $BUDGET_DIR..."
if [ -f "$BUDGET_DIR/backend/app/api/v1/router.py" ]; then
    if grep -q "import_router" "$BUDGET_DIR/backend/app/api/v1/router.py"; then
        echo "✅ import_router found in v1 router"
    else
        echo "❌ import_router NOT found in v1 router!"
    fi
else
    echo "⚠️  $BUDGET_DIR/backend/app/api/v1/router.py not found"
fi

echo ""
echo "🔍 7. Checking import services in $BUDGET_DIR..."
if [ -f "$BUDGET_DIR/backend/app/services/tinkoff_csv_parser.py" ]; then
    echo "✅ tinkoff_csv_parser.py exists"
else
    echo "❌ tinkoff_csv_parser.py NOT found!"
fi

if [ -f "$BUDGET_DIR/backend/app/services/import_executor.py" ]; then
    echo "✅ import_executor.py exists"
else
    echo "❌ import_executor.py NOT found!"
fi

if [ -f "$BUDGET_DIR/backend/app/models/import_staging.py" ]; then
    echo "✅ import_staging.py model exists"
else
    echo "❌ import_staging.py model NOT found!"
fi

if [ -f "$BUDGET_DIR/backend/app/api/v1/endpoints/import_tinkoff.py" ]; then
    echo "✅ import_tinkoff.py endpoints exist"
else
    echo "❌ import_tinkoff.py endpoints NOT found!"
fi

echo ""
echo "📋 Summary of checks completed!"
echo ""
if [ -n "$BACKEND_CONTAINER" ]; then
    echo "💡 To see backend logs:"
    echo "   docker logs $BACKEND_CONTAINER --tail=50"
    echo ""
    echo "💡 To follow live logs:"
    echo "   docker logs $BACKEND_CONTAINER -f"
    echo ""
    echo "💡 To see recent errors:"
    echo "   docker logs $BACKEND_CONTAINER --tail=200 | grep -i error"
    echo ""
    echo "💡 To apply migrations (if needed):"
    echo "   docker exec -i $BACKEND_CONTAINER sh -c 'cd /app/backend/db/migrations && alembic upgrade head'"
fi
