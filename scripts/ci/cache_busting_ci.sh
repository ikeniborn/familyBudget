#!/bin/bash
# CI-compatible cache busting для GitHub Actions
# Обновляет ?v=PLACEHOLDER на ?v=<git-hash> во всех template файлах
set -e

# Принимаем cache version как параметр
CACHE_VERSION="${1:?Usage: cache_busting_ci.sh <version>}"

# Валидация: semantic versioning (X.Y.Z) ИЛИ старый формат (v{timestamp}/v{hash})
# Это обеспечивает backward compatibility во время миграции
if [[ ! "$CACHE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] && \
   [[ ! "$CACHE_VERSION" =~ ^v[0-9a-f_]+$ ]]; then
    echo "❌ Invalid version format: $CACHE_VERSION"
    echo "   Expected: X.Y.Z (e.g., 10.0.23) or legacy v{YYYYMMDD_HHMM}"
    exit 1
fi

# Debug output для semantic version
if [[ "$CACHE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "ℹ Using semantic version: $CACHE_VERSION"
fi

echo "🔄 Updating cache versions to: ${CACHE_VERSION}"

# Список файлов для обновления (скопировано из scripts/lib/cache_busting.sh:31-59)
files=(
    # Webapp HTML
    "frontend/webapp/add.html"
    "frontend/webapp/addplan.html"
    "frontend/webapp/edit.html"
    "frontend/webapp/index.html"
    "frontend/webapp/list.html"
    "frontend/webapp/stats.html"
    "frontend/webapp/summary.html"
    "frontend/webapp/test.html"
    "frontend/webapp/today.html"
    # Web Templates
    "frontend/web/templates/base.html"
    "frontend/web/templates/facts.html"
    "frontend/web/templates/plan.html"
    "frontend/web/templates/index.html"
    "frontend/web/templates/analytics.html"
    "frontend/web/templates/notifications.html"
    "frontend/web/templates/lists.html"
    "frontend/web/templates/admin_dashboard.html"
    "frontend/web/templates/admin_articles.html"
    "frontend/web/templates/admin_cost_centers.html"
    "frontend/web/templates/admin_financial_centers.html"
    "frontend/web/templates/admin_users.html"
    "frontend/web/templates/admin_stores.html"
    "frontend/web/templates/admin_product_groups.html"
    "frontend/web/templates/admin_monitoring.html"
    "frontend/web/templates/admin_logs.html"
    "frontend/web/templates/2fa_setup.html"
    "frontend/web/templates/2fa_setup_login.html"
    "frontend/web/templates/settings.html"
    # Web Template Scripts
    "frontend/web/templates/scripts/service-worker-registration.html"
    # Service Worker (minified - used in runtime)
    "frontend/web/static/sw.min.js"
)

updated_count=0

for file in "${files[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo "  ⚠ File not found: $file"
        continue
    fi

    # Special handling for Service Worker files (sw.min.js)
    # Replace: const CACHE_VERSION = 'PLACEHOLDER' → const CACHE_VERSION = '11.1.30'
    if [[ "$file" == *"sw.min.js"* ]] || [[ "$file" == *"sw.js"* ]]; then
        sed -i.bak "s/'PLACEHOLDER'/'${CACHE_VERSION}'/g; s/\"PLACEHOLDER\"/\"${CACHE_VERSION}\"/g" "$file"
        if [[ $? -eq 0 ]]; then
            rm -f "${file}.bak"
            updated_count=$((updated_count + 1))
            echo "  ✓ Updated: $file (Service Worker)"
        else
            echo "  ✗ Failed: $file"
            [[ -f "${file}.bak" ]] && mv "${file}.bak" "$file"
        fi
        continue
    fi

    # Perl regex замена для всех остальных файлов (HTML templates)
    # Обновляет ?v=PLACEHOLDER или ?v=<старая-версия> на ?v=<новая-версия>
    # Pattern supports:
    #   - Semantic versioning: X.Y.Z (e.g., 10.0.23)
    #   - Legacy timestamp: v{YYYYMMDD_HHMM} (e.g., v20260123_1530)
    #   - Legacy hash: v{hash} (e.g., v12345678)
    # Pattern 1: JS files - /static/js/file.js, /static/js/dist/bundle.js, /shared/db/pglite.js
    # Pattern 2: CSS files - /static/css/file.css, /web/static/css/file.css
    # Pattern 3: Jinja2 url_for - {{ url_for(...) }}?v=PLACEHOLDER
    # IMPORTANT: Order matters! Semantic version MUST be before v?[0-9a-f_]+ to avoid partial matches
    perl -i.bak -pe "
        s{(\\/(?:webapp\\/|web\\/|shared\\/)?(?:static\\/js|db)\\/(?:[a-zA-Z_\\-]+\\/)*)([a-zA-Z_\\-]+\\.(?:min\\.|bundle\\.)?js)\\?v=(PLACEHOLDER|[0-9]+\\.[0-9]+\\.[0-9]+|v?[0-9a-f_]+)}{\$1\$2?v=${CACHE_VERSION}}g;
        s{(\\/(?:webapp\\/|web\\/|shared\\/)?static\\/css\\/(?:[a-zA-Z_\\-]+\\/)*)([a-zA-Z_\\-]+\\.(?:min\\.)?css)\\?v=(PLACEHOLDER|[0-9]+\\.[0-9]+\\.[0-9]+|v?[0-9a-f_]+)}{\$1\$2?v=${CACHE_VERSION}}g;
        s{(['\"])\\s*\\)\\s*\\}\\}\\s*\\?v=(PLACEHOLDER|[0-9]+\\.[0-9]+\\.[0-9]+|v?[0-9a-f_]+)}{\$1) \\}\\}?v=${CACHE_VERSION}}g;
    " "$file"

    if [[ $? -eq 0 ]]; then
        rm -f "${file}.bak"
        updated_count=$((updated_count + 1))
        echo "  ✓ Updated: $file"
    else
        echo "  ✗ Failed: $file"
        # Восстановление из backup
        [[ -f "${file}.bak" ]] && mv "${file}.bak" "$file"
    fi
done

echo "✅ Updated ${updated_count} files with cache version: ${CACHE_VERSION}"

# Exit code
if [[ $updated_count -eq 0 ]]; then
    echo "❌ No files were updated"
    exit 1
fi

exit 0
