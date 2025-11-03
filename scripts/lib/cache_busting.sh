#!/bin/bash
#
# Cache Busting Module для deploy.sh
# Автоматическое обновление версий статических файлов при деплое
#

# Генерация новой версии на основе timestamp
generate_cache_version() {
    echo "$(date +"%Y%m%d_%H%M")"
}

# Генерация версии на основе git commit hash (альтернатива)
generate_cache_version_git() {
    local git_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
    echo "${git_hash}"
}

# Обновление версий во всех template файлах
update_cache_versions() {
    local version=$1
    local repo_dir="${2:-.}"

    echo "🔄 Updating cache versions to: ${version}" >&2

    # Список файлов для обновления
    local files=(
        # Webapp HTML
        "${repo_dir}/webapp/add.html"
        "${repo_dir}/webapp/addplan.html"
        "${repo_dir}/webapp/edit.html"
        "${repo_dir}/webapp/index.html"
        "${repo_dir}/webapp/list.html"
        "${repo_dir}/webapp/stats.html"
        "${repo_dir}/webapp/summary.html"
        "${repo_dir}/webapp/test.html"
        "${repo_dir}/webapp/today.html"
        # Web Templates
        "${repo_dir}/web/templates/facts.html"
        "${repo_dir}/web/templates/plan.html"
        "${repo_dir}/web/templates/index.html"
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
        perl -i.bak -pe "
            s{(\\/webapp\\/static\\/js\\/|\\/static\\/js\\/)([a-zA-Z_-]+\\.js)\\?v=(PLACEHOLDER|[0-9]+_[0-9]+)}{\$1\$2?v=${version}}g;
            s{(\\/webapp\\/static\\/css\\/)([a-zA-Z_-]+\\.css)\\?v=(PLACEHOLDER|[0-9]+_[0-9]+)}{\$1\$2?v=${version}}g;
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
        echo "✅ Cache versions updated in ${updated_count} files" >&2
        return 0
    else
        echo "❌ No files updated" >&2
        return 1
    fi
}

# Проверка текущих версий в файлах
check_cache_versions() {
    local repo_dir="${1:-.}"

    echo "📝 Current cache versions:"

    local files=(
        # Webapp HTML
        "${repo_dir}/webapp/add.html"
        "${repo_dir}/webapp/addplan.html"
        "${repo_dir}/webapp/edit.html"
        "${repo_dir}/webapp/index.html"
        "${repo_dir}/webapp/list.html"
        "${repo_dir}/webapp/stats.html"
        "${repo_dir}/webapp/summary.html"
        "${repo_dir}/webapp/test.html"
        "${repo_dir}/webapp/today.html"
        # Web Templates
        "${repo_dir}/web/templates/facts.html"
        "${repo_dir}/web/templates/plan.html"
        "${repo_dir}/web/templates/index.html"
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
            read -p "Enter new cache version (or press Enter for auto): " manual_version
            if [[ -z "$manual_version" ]]; then
                manual_version=$(generate_cache_version)
            fi
            update_cache_versions "$manual_version" "$repo_dir"
            ;;
        auto|*)
            local new_version=$(generate_cache_version)
            update_cache_versions "$new_version" "$repo_dir"
            ;;
    esac
}

# Если скрипт запущен напрямую (не sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    run_cache_busting "$@"
fi
