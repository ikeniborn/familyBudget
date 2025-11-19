#!/bin/bash
# Quick start script for dev server containers
# Usage: ./scripts/start_dev_containers.sh

set -e

echo "🚀 Starting dev server containers..."
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

# Check if in /opt/budget or need to use it
if [ -f "/opt/budget/docker-compose.yml" ] || [ -f "/opt/budget/compose.yaml" ]; then
    COMPOSE_DIR="/opt/budget"
else
    echo "❌ /opt/budget docker compose configuration not found!"
    exit 1
fi

cd "$COMPOSE_DIR"
echo "📂 Working directory: $COMPOSE_DIR"
echo ""

echo "📊 Current container status:"
$DOCKER_COMPOSE ps
echo ""

echo "🔄 Starting containers..."
$DOCKER_COMPOSE up -d

echo ""
echo "⏳ Waiting for containers to start (5 seconds)..."
sleep 5

echo ""
echo "📊 Container status after start:"
$DOCKER_COMPOSE ps

echo ""
echo "🔍 Checking backend health..."
if $DOCKER_COMPOSE ps backend | grep -q "Up"; then
    echo "✅ Backend is UP"

    echo ""
    echo "📋 Checking Alembic migration status..."
    $DOCKER_COMPOSE exec -T backend alembic current || echo "⚠️  Could not check Alembic"

    echo ""
    echo "🗄️  Checking database..."
    if $DOCKER_COMPOSE ps postgres | grep -q "Up"; then
        echo "✅ Postgres is UP"

        echo ""
        echo "📊 Checking t_import_staging table..."
        if $DOCKER_COMPOSE exec -T postgres psql -U familybudget -d familybudget -c "\d t_import_staging" 2>/dev/null | grep -q "Table"; then
            echo "✅ t_import_staging table exists"
        else
            echo "⚠️  t_import_staging table NOT found"
            echo "   Run: docker-compose exec backend alembic upgrade head"
        fi
    else
        echo "❌ Postgres is NOT running!"
    fi
else
    echo "❌ Backend is NOT running!"
    echo ""
    echo "📋 Checking backend logs for errors:"
    $DOCKER_COMPOSE logs backend --tail=30
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Startup sequence completed!"
echo ""
echo "💡 Next steps:"
echo "   1. Check infrastructure: cd ~/familyBudget && ./scripts/check_import_setup.sh"
echo "   2. View logs: cd /opt/budget && $DOCKER_COMPOSE logs backend -f"
echo "   3. Test import: https://budget-dev.ikeniborn.ru/import"
echo ""
echo "💡 If migration needed:"
echo "   cd /opt/budget && $DOCKER_COMPOSE exec backend alembic upgrade head"
