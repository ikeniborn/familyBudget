#!/bin/bash
# CI-compatible cache busting для GitHub Actions
# Обновляет ?v=PLACEHOLDER на ?v=<git-hash> во всех template файлах
set -e

# Принимаем cache version как параметр
CACHE_VERSION="${1:?Usage: cache_busting_ci.sh <version>}"

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
    "frontend/web/templates/2fa_setup.html"
    "frontend/web/templates/2fa_setup_login.html"
)

updated_count=0

for file in "${files[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo "  ⚠ File not found: $file"
        continue
    fi

    # Perl regex замена (из cache_busting.sh:84-87)
    # Обновляет ?v=PLACEHOLDER или ?v=<старая-версия> на ?v=<новая-версия>
    perl -i.bak -pe "
        s{(\\/(?:webapp|web|static|shared)\\/static\\/js\\/(?:[a-zA-Z_\\-]+\\/)*)([a-zA-Z_\\-]+\\.(?:min\\.)?js)\\?v=(PLACEHOLDER|[0-9a-f]+)}{\$1\$2?v=${CACHE_VERSION}}g;
        s{(\\/(?:webapp|web|static|shared)\\/static\\/css\\/(?:[a-zA-Z_\\-]+\\/)*)([a-zA-Z_\\-]+\\.(?:min\\.)?css)\\?v=(PLACEHOLDER|[0-9a-f]+)}{\$1\$2?v=${CACHE_VERSION}}g;
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
