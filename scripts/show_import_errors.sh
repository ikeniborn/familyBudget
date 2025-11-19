#!/bin/bash
# Show backend logs related to import errors
# Usage: ./scripts/show_import_errors.sh

echo "🔍 Checking backend logs for import errors..."
echo ""

# Find backend container name
BACKEND_CONTAINER=$(docker ps --filter "name=backend" --format "{{.Names}}" | head -1)

if [ -z "$BACKEND_CONTAINER" ]; then
    echo "❌ Backend container is NOT running!"
    echo ""
    echo "Current docker containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    exit 1
fi

echo "✅ Found backend container: $BACKEND_CONTAINER"

echo ""
echo "📊 Backend container status:"
docker ps --filter "name=backend" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔴 ERRORS in last 200 lines:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker logs "$BACKEND_CONTAINER" --tail=200 2>&1 | grep -i -A 5 -B 2 "error\|exception\|traceback\|failed"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📥 IMPORT-related logs in last 200 lines:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker logs "$BACKEND_CONTAINER" --tail=200 2>&1 | grep -i "import\|tinkoff\|staging\|csv"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Last 30 lines of backend logs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker logs "$BACKEND_CONTAINER" --tail=30 2>&1

echo ""
echo "💡 To follow live logs:"
echo "   docker logs $BACKEND_CONTAINER -f"
echo ""
echo "💡 To test import endpoint:"
echo "   1. Open browser to https://budget-dev.ikeniborn.ru/import"
echo "   2. Upload a CSV file"
echo "   3. Run this script again to see new errors"
