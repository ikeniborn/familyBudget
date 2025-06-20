#!/bin/bash

COUCHDB_CONTAINER="couchdb"
COUCHDB_HOST_URL="http://admin:2L6uEoNMjW9rVnPgy37t@localhost:5984"

echo "=== Testing CouchDB Connection ==="

echo "1. Docker ps check:"
docker ps --format "{{.Names}}" | grep "^${COUCHDB_CONTAINER}$" && echo "✓ Found via docker ps" || echo "✗ Not found via docker ps"

echo "2. Docker inspect check:"
if docker inspect "${COUCHDB_CONTAINER}" >/dev/null 2>&1; then
    status=$(docker inspect -f '{{.State.Running}}' "${COUCHDB_CONTAINER}" 2>/dev/null)
    echo "Container status: $status"
    [[ "$status" == "true" ]] && echo "✓ Running via docker inspect" || echo "✗ Not running via docker inspect"
else
    echo "✗ Container not found via docker inspect"
fi

echo "3. CouchDB API check:"
if curl -s --connect-timeout 2 "${COUCHDB_HOST_URL}/_up" >/dev/null 2>&1; then
    echo "✓ CouchDB API accessible"
else
    echo "✗ CouchDB API not accessible"
fi

echo "4. CouchDB API response:"
curl -s --connect-timeout 5 "${COUCHDB_HOST_URL}/_up" || echo "API call failed"

echo "5. All containers:"
docker ps --format "{{.Names}}"