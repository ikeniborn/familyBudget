#!/bin/bash
#
# Cache Busting Module для deploy.sh
# Автоматическое обновление версий статических файлов при деплое
#

# Чтение версии из VERSION файла
generate_cache_version_from_file() {
    local version_file="${1:-VERSION}"

    if [[ ! -f "$version_file" ]]; then
        echo "ERROR: VERSION file not found: $version_file" >&2
        return 1
    fi

    local version=$(cat "$version_file" | tr -d '[:space:]')

    # Валидация semantic versioning
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "ERROR: Invalid VERSION format: $version (expected: X.Y.Z)" >&2
        return 1
    fi

    echo "$version"
}

# Обновление версий во всех template файлах
update_cache_versions() {
    local version=$1
    local repo_dir="${2:-.}"

    # Use print_message if available (when sourced from deploy.sh), otherwise echo
    if declare -f info &>/dev/null; then
        info "Updating cache versions to: ${version}"
    else
        echo "🔄 Updating cache versions to: ${version}" >&2
    fi

    # Список файлов для обновления
    local files=(
        # Webapp HTML
        "${repo_dir}/frontend/webapp/add.html"
        "${repo_dir}/frontend/webapp/addplan.html"
        "${repo_dir}/frontend/webapp/edit.html"
        "${repo_dir}/frontend/webapp/index.html"
        "${repo_dir}/frontend/webapp/list.html"
        "${repo_dir}/frontend/webapp/stats.html"
        "${repo_dir}/frontend/webapp/summary.html"
        "${repo_dir}/frontend/webapp/test.html"
        "${repo_dir}/frontend/webapp/today.html"
        # Web Templates
        "${repo_dir}/frontend/web/templates/base.html"
        "${repo_dir}/frontend/web/templates/facts.html"
        "${repo_dir}/frontend/web/templates/plan.html"
        "${repo_dir}/frontend/web/templates/index.html"
        "${repo_dir}/frontend/web/templates/analytics.html"
        "${repo_dir}/frontend/web/templates/notifications.html"
        "${repo_dir}/frontend/web/templates/lists.html"
        "${repo_dir}/frontend/web/templates/admin_dashboard.html"
        "${repo_dir}/frontend/web/templates/admin_articles.html"
        "${repo_dir}/frontend/web/templates/admin_cost_centers.html"
        "${repo_dir}/frontend/web/templates/admin_financial_centers.html"
        "${repo_dir}/frontend/web/templates/admin_users.html"
        "${repo_dir}/frontend/web/templates/admin_stores.html"
        "${repo_dir}/frontend/web/templates/admin_product_groups.html"
        "${repo_dir}/frontend/web/templates/2fa_setup.html"
        "${repo_dir}/frontend/web/templates/2fa_setup_login.html"
        "${repo_dir}/frontend/web/templates/settings.html"
    )

    local updated_count=0

    for file in "${files[@]}"; do
        if [[ ! -f "$file" ]]; then
            echo "  ⚠ File not found: $(basename "$file")" >&2
            continue
        fi

        # Проверяем права на запись
        if [[ ! -w "$file" ]]; then
            local perms=$(stat -c '%a' "$file" 2>/dev/null || echo 'unknown')
            local owner=$(stat -c '%U:%G' "$file" 2>/dev/null || echo 'unknown')
            echo "  ⚠ File not writable: $(basename "$file")" >&2
            echo "    Permissions: $perms, Owner: $owner, Current user: $(whoami)" >&2
            continue
        fi

        # Обновляем все версионированные файлы через perl
        # Perl лучше обрабатывает переменные и regex
        # Поддерживает:
        # - .min.js / .min.css файлы (минифицированные)
        # - /webapp/, /web/, /static/, /shared/ paths
        # - vendor/, offline/, workers/core/ и другие subdirectories (любая вложенность)
        # - Semantic versioning (X.Y.Z) и legacy timestamp format (v{YYYYMMDD_HHMM})
        # IMPORTANT: Order matters! Semantic version MUST be before v?[0-9a-f_]+ to avoid partial matches
        perl -i.bak -pe "
            s{(\\/webapp\\/static\\/js\\/(?:[a-zA-Z_\\-]+\\/)*|\\/web\\/static\\/js\\/(?:[a-zA-Z_\\-]+\\/)*|\\/static\\/js\\/(?:[a-zA-Z_\\-]+\\/)*|\\/shared\\/static\\/js\\/(?:[a-zA-Z_\\-]+\\/)*)([a-zA-Z_\\-]+\\.(?:min\\.)?js)\\?v=(PLACEHOLDER|[0-9]+\\.[0-9]+\\.[0-9]+|v?[0-9a-f_]+)}{\$1\$2?v=${version}}g;
            s{(\\/webapp\\/static\\/css\\/(?:[a-zA-Z_\\-]+\\/)*|\\/web\\/static\\/css\\/(?:[a-zA-Z_\\-]+\\/)*|\\/static\\/css\\/(?:[a-zA-Z_\\-]+\\/)*|\\/shared\\/static\\/css\\/(?:[a-zA-Z_\\-]+\\/)*)([a-zA-Z_\\-]+\\.(?:min\\.)?css)\\?v=(PLACEHOLDER|[0-9]+\\.[0-9]+\\.[0-9]+|v?[0-9a-f_]+)}{\$1\$2?v=${version}}g;
        " "$file" 2>&1

        local perl_exit=$?

        if [[ $perl_exit -eq 0 ]]; then
            # Удаляем backup файл
            rm -f "${file}.bak" 2>/dev/null || true
            updated_count=$((updated_count + 1))
            echo "  ✓ Updated: $(basename "$file")" >&2
        else
            echo "  ✗ Failed to update: $(basename "$file") (exit code: $perl_exit)" >&2
            # Восстанавливаем из backup если есть
            if [[ -f "${file}.bak" ]]; then
                mv "${file}.bak" "$file" 2>/dev/null || true
            fi
        fi
    done

    if [[ $updated_count -gt 0 ]]; then
        if declare -f success &>/dev/null; then
            success "Cache versions updated in ${updated_count} files (v=${version})"
        else
            echo "✅ Cache versions updated in ${updated_count} files" >&2
        fi
        return 0
    else
        if declare -f warning &>/dev/null; then
            warning "No files updated with cache versions"
        else
            echo "❌ No files updated" >&2
        fi
        return 1
    fi
}

# Проверка текущих версий в файлах
check_cache_versions() {
    local repo_dir="${1:-.}"

    echo "📝 Current cache versions:"

    local files=(
        # Webapp HTML
        "${repo_dir}/frontend/webapp/add.html"
        "${repo_dir}/frontend/webapp/addplan.html"
        "${repo_dir}/frontend/webapp/edit.html"
        "${repo_dir}/frontend/webapp/index.html"
        "${repo_dir}/frontend/webapp/list.html"
        "${repo_dir}/frontend/webapp/stats.html"
        "${repo_dir}/frontend/webapp/summary.html"
        "${repo_dir}/frontend/webapp/test.html"
        "${repo_dir}/frontend/webapp/today.html"
        # Web Templates
        "${repo_dir}/frontend/web/templates/base.html"
        "${repo_dir}/frontend/web/templates/facts.html"
        "${repo_dir}/frontend/web/templates/plan.html"
        "${repo_dir}/frontend/web/templates/index.html"
        "${repo_dir}/frontend/web/templates/analytics.html"
        "${repo_dir}/frontend/web/templates/notifications.html"
        "${repo_dir}/frontend/web/templates/admin_dashboard.html"
        "${repo_dir}/frontend/web/templates/admin_articles.html"
        "${repo_dir}/frontend/web/templates/admin_cost_centers.html"
        "${repo_dir}/frontend/web/templates/admin_financial_centers.html"
        "${repo_dir}/frontend/web/templates/admin_users.html"
    )

    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            # Ищем любой .js или .css файл с версией
            local versions=$(grep -oP '(static/js/|static/css/)[a-zA-Z_-]+\.(js|css)\?v=\K[0-9a-zA-Z_-]+' "$file" 2>/dev/null | sort -u)

            if [[ -n "$versions" ]]; then
                # Подсчитываем количество уникальных версий
                local version_count=$(echo "$versions" | wc -l)
                local first_version=$(echo "$versions" | head -1)

                if [[ $version_count -eq 1 ]]; then
                    echo "  $(basename "$file"): v=${first_version}"
                else
                    echo "  $(basename "$file"): ${version_count} versions (${first_version}, ...)"
                fi
            else
                # Проверяем PLACEHOLDER
                if grep -q '?v=PLACEHOLDER' "$file" 2>/dev/null; then
                    echo "  $(basename "$file"): PLACEHOLDER (needs update)"
                else
                    echo "  $(basename "$file"): no versions found"
                fi
            fi
        fi
    done
}

# Основная функция для вызова из deploy.sh
run_cache_busting() {
    local mode="${1:-auto}"  # auto|check|manual
    local repo_dir="${2:-.}"

    case "$mode" in
        check)
            check_cache_versions "$repo_dir"
            ;;
        manual)
            read -p "Enter new cache version (X.Y.Z format): " manual_version
            if [[ -z "$manual_version" ]]; then
                echo "❌ ERROR: Manual version required" >&2
                return 1
            fi
            # Валидация semantic versioning
            if [[ ! "$manual_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                echo "❌ ERROR: Invalid version format: $manual_version (expected: X.Y.Z)" >&2
                return 1
            fi
            update_cache_versions "$manual_version" "$repo_dir"
            ;;
        auto|*)
            # Чтение версии из VERSION файла (обязательно)
            local new_version=$(generate_cache_version_from_file "${repo_dir}/VERSION")
            if [[ -z "$new_version" ]]; then
                echo "❌ ERROR: VERSION file not found or invalid" >&2
                return 1
            fi
            echo "ℹ Using version from VERSION file: $new_version" >&2
            update_cache_versions "$new_version" "$repo_dir"
            ;;
    esac
}

# Если скрипт запущен напрямую (не sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_cache_busting "$@"
fi
