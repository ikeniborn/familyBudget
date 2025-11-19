#!/bin/bash
# Show backend logs related to import errors
# Usage: ./scripts/show_import_errors.sh

echo "🔍 Checking backend logs for import errors..."
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

# Check if in /opt/budget
if [ -f "docker-compose.yml" ] || [ -f "compose.yaml" ]; then
    echo "✅ Found docker compose configuration"
else
    echo "⚠️  Not in docker compose directory. Trying /opt/budget..."
    cd /opt/budget 2>/dev/null || {
        echo "❌ Could not find docker compose directory!"
        echo "   Please run from /opt/budget or ~/familyBudget"
        exit 1
    }
fi

echo ""
echo "📊 Backend container status:"
$DOCKER_COMPOSE ps backend

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔴 ERRORS in last 200 lines:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
$DOCKER_COMPOSE logs backend --tail=200 | grep -i -A 5 -B 2 "error\|exception\|traceback\|failed"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📥 IMPORT-related logs in last 200 lines:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
$DOCKER_COMPOSE logs backend --tail=200 | grep -i "import\|tinkoff\|staging\|csv"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Last 30 lines of backend logs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
$DOCKER_COMPOSE logs backend --tail=30

echo ""
echo "💡 To follow live logs:"
echo "   cd /opt/budget && $DOCKER_COMPOSE logs backend -f"
echo ""
echo "💡 To test import endpoint:"
echo "   1. Open browser to https://budget-dev.ikeniborn.ru/import"
echo "   2. Upload a CSV file"
echo "   3. Run this script again to see new errors"
