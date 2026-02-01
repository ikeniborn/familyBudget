#!/bin/bash
set -euo pipefail

# CI validation script for build artifacts
# Consolidates validation logic from build-and-push.yml and cache-busting-validation.yml
#
# Usage: bash scripts/ci/validate_build_artifacts.sh <CACHE_VERSION> [--strict-sw]
#
# Parameters:
#   CACHE_VERSION: Expected cache version (e.g., "11.1.13" or "v20260201_123456")
#   --strict-sw: (Optional) Fail if Service Worker validation fails (default: warning only)
#
# Exit codes:
#   0: All validations passed
#   1: Validation failed

CACHE_VERSION="${1:-}"
STRICT_SW="${2:-}"

if [[ -z "$CACHE_VERSION" ]]; then
  echo "❌ Error: CACHE_VERSION parameter required"
  echo "Usage: $0 <CACHE_VERSION> [--strict-sw]"
  exit 1
fi

echo "🔍 Validating build artifacts with cache version: $CACHE_VERSION"
echo ""

FAIL=0

# Test 1: Check PLACEHOLDER replaced
echo "📋 Test 1: Checking for unreplaced PLACEHOLDERs..."
if grep -rE '\?v=PLACEHOLDER' frontend/web/templates/ frontend/webapp/ 2>/dev/null; then
  echo "❌ PLACEHOLDER not replaced in templates"
  FAIL=1
else
  echo "✅ No PLACEHOLDER markers found"
fi
echo ""

# Test 2: Check version format in templates
echo "📋 Test 2: Checking cache version format..."
# Support both semantic versioning (X.Y.Z) and legacy format (v{timestamp})
if ! grep -rE '\?v=([0-9]+\.[0-9]+\.[0-9]+|v[0-9_]+)' frontend/web/templates/ >/dev/null 2>&1; then
  echo "❌ No valid cache versions found in templates"
  FAIL=1
else
  echo "✅ Valid cache versions found"
fi
echo ""

# Test 3: Check Dexie script tag exists
echo "📋 Test 3: Checking Dexie script tag in base.html..."
if ! grep -q "/shared/db/dexie.min.js" frontend/web/templates/base.html 2>/dev/null; then
  echo "❌ Dexie script tag missing in base.html"
  FAIL=1
else
  echo "✅ Dexie script tag found"
fi
echo ""

# Test 4: Check Service Worker file exists and has valid version
echo "📋 Test 4: Checking Service Worker cache version..."
if [[ ! -f frontend/web/static/sw.min.js ]]; then
  if [[ "$STRICT_SW" == "--strict-sw" ]]; then
    echo "❌ Service Worker file missing: sw.min.js (strict mode)"
    FAIL=1
  else
    echo "⚠️  Service Worker file missing (will be built in Docker)"
  fi
else
  # Service Worker uses minified code, check for version presence
  if ! grep -q "$CACHE_VERSION" frontend/web/static/sw.min.js; then
    if [[ "$STRICT_SW" == "--strict-sw" ]]; then
      echo "❌ Could not verify SW cache version (strict mode)"
      FAIL=1
    else
      echo "⚠️  Warning: Could not verify SW cache version (may be minified)"
    fi
  else
    echo "✅ Service Worker cache version verified"
  fi
fi
echo ""

# Final summary
if [[ $FAIL -eq 0 ]]; then
  echo "✅ All validation checks passed"
  exit 0
else
  echo "❌ Validation failed"
  exit 1
fi
