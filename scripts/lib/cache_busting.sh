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

    echo "🔄 Updating cache versions to: ${version}"

    # Список файлов для обновления
    local files=(
        "${repo_dir}/webapp/add.html"
        "${repo_dir}/webapp/addplan.html"
        "${repo_dir}/webapp/edit.html"
        "${repo_dir}/web/templates/facts.html"
        "${repo_dir}/web/templates/plan.html"
    )

    local updated_count=0

    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            # Обновляем tomSelectCategoryTree.js версии
            sed -i "s/tomSelectCategoryTree\.js?v=[0-9a-zA-Z_-]*/tomSelectCategoryTree.js?v=${version}/g" "$file"

            # Обновляем другие JS файлы если есть
            # sed -i "s/app\.js?v=[0-9a-zA-Z_-]*/app.js?v=${version}/g" "$file"
            # sed -i "s/dateFormatter\.js?v=[0-9a-zA-Z_-]*/dateFormatter.js?v=${version}/g" "$file"

            ((updated_count++))
            echo "  ✓ Updated: $(basename "$file")"
        else
            echo "  ⚠ File not found: $file"
        fi
    done

    if [[ $updated_count -gt 0 ]]; then
        echo "✅ Cache versions updated in ${updated_count} files"
        return 0
    else
        echo "❌ No files updated"
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
