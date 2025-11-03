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
    echo "   Repository: ${repo_dir}" >&2

    # Flush output to ensure it's visible
    sync 2>/dev/null || true

    # Список файлов для обновления
    local files=(
        "${repo_dir}/webapp/add.html"
        "${repo_dir}/webapp/addplan.html"
        "${repo_dir}/webapp/edit.html"
        "${repo_dir}/web/templates/facts.html"
        "${repo_dir}/web/templates/plan.html"
    )

    echo "   Files to update: ${#files[@]}" >&2

    local updated_count=0

    echo "   Starting file processing..." >&2

    for file in "${files[@]}"; do
        echo "  → Checking: $(basename "$file")..." >&2

        if [[ ! -f "$file" ]]; then
            echo "    ⚠ File not found: $file" >&2
            continue
        fi

        echo "    File exists, checking permissions..." >&2

        # Проверяем права на запись
        if [[ ! -w "$file" ]]; then
            local perms=$(stat -c '%a' "$file" 2>/dev/null || echo 'unknown')
            local owner=$(stat -c '%U:%G' "$file" 2>/dev/null || echo 'unknown')
            echo "    ⚠ File not writable: $file" >&2
            echo "      Permissions: $perms, Owner: $owner, Current user: $(whoami)" >&2
            continue
        fi

        echo "    Permissions OK, running replacement..." >&2

        # Обновляем tomSelectCategoryTree.js версии
        # Используем perl с in-place edit (прямое редактирование без temp файлов)
        # perl -i создает backup автоматически и безопасно работает с sudo
        if perl -i.bak -pe "s|tomSelectCategoryTree\\.js\\?v=[0-9a-zA-Z_-]*|tomSelectCategoryTree.js?v=${version}|g" "$file" 2>&1; then
            echo "    Perl completed, cleaning backup..." >&2
            # Удаляем backup файл
            rm -f "${file}.bak" 2>/dev/null || true
            ((updated_count++))
            echo "    ✓ Updated: $(basename "$file")" >&2
        else
            local exit_code=$?
            echo "    ✗ Perl command failed with exit code $exit_code for: $(basename "$file")" >&2
            # Восстанавливаем из backup если есть
            if [[ -f "${file}.bak" ]]; then
                mv "${file}.bak" "$file" 2>/dev/null || true
            fi
        fi

        # Обновляем другие JS файлы если есть
        # sed "s/app\\.js?v=[0-9a-zA-Z_-]*/app.js?v=${version}/g" "$file"
        # sed "s/dateFormatter\\.js?v=[0-9a-zA-Z_-]*/dateFormatter.js?v=${version}/g" "$file"
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
        "${repo_dir}/webapp/add.html"
        "${repo_dir}/webapp/addplan.html"
        "${repo_dir}/webapp/edit.html"
        "${repo_dir}/web/templates/facts.html"
        "${repo_dir}/web/templates/plan.html"
    )

    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            local version=$(grep -oP 'tomSelectCategoryTree\.js\?v=\K[0-9a-zA-Z_-]+' "$file" 2>/dev/null | head -1)
            if [[ -n "$version" ]]; then
                echo "  $(basename "$file"): v=${version}"
            else
                echo "  $(basename "$file"): no version found"
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
