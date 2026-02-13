#!/bin/bash
# Restore PLACEHOLDER in template files
# Use before committing to git to ensure templates don't have hardcoded versions
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔄 Restoring PLACEHOLDER in template files..."

# List of template files (same as cache_busting_ci.sh)
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
)

updated_count=0

for file in "${files[@]}"; do
    filepath="$REPO_ROOT/$file"

    if [[ ! -f "$filepath" ]]; then
        echo "  ⚠ File not found: $file"
        continue
    fi

    # Replace any version (semantic X.Y.Z or legacy v{timestamp}) with PLACEHOLDER
    # Pattern 1: JS files - /static/js/file.js, /static/js/dist/bundle.js, /shared/db/pglite.js
    # Pattern 2: CSS files - /static/css/file.css, /web/static/css/file.css
    # Pattern 3: Jinja2 url_for - {{ url_for(...) }}?v=VERSION
    perl -i.bak -pe "
        s{(\\/(?:webapp\\/|web\\/|shared\\/)?(?:static\\/js|db)\\/(?:[a-zA-Z_\\-]+\\/)*)([a-zA-Z_\\-]+\\.(?:min\\.|bundle\\.)?js)\\?v=(?:PLACEHOLDER|[0-9]+\\.[0-9]+\\.[0-9]+|v?[0-9a-f_]+)}{\$1\$2?v=PLACEHOLDER}g;
        s{(\\/(?:webapp\\/|web\\/|shared\\/)?static\\/css\\/(?:[a-zA-Z_\\-]+\\/)*)([a-zA-Z_\\-]+\\.(?:min\\.)?css)\\?v=(?:PLACEHOLDER|[0-9]+\\.[0-9]+\\.[0-9]+|v?[0-9a-f_]+)}{\$1\$2?v=PLACEHOLDER}g;
        s{(\\}\\})\\?v=(?:PLACEHOLDER|[0-9]+\\.[0-9]+\\.[0-9]+|v?[0-9a-f_]+)}{\$1?v=PLACEHOLDER}g;
    " "$filepath"

    if [[ $? -eq 0 ]]; then
        rm -f "${filepath}.bak"
        updated_count=$((updated_count + 1))
        echo "  ✓ Restored: $file"
    else
        echo "  ✗ Failed: $file"
        [[ -f "${filepath}.bak" ]] && mv "${filepath}.bak" "$filepath"
    fi
done

echo "✅ Restored PLACEHOLDER in ${updated_count} files"

if [[ $updated_count -eq 0 ]]; then
    echo "❌ No files were updated"
    exit 1
fi

exit 0
