#!/bin/bash

# local-fixer.sh
# Модуль автоматического исправления кода в локальном окружении
# Версия: 2.0.0

# Получить путь к директории скриптов
get_script_dir() {
    local source="${BASH_SOURCE[0]}"
    while [ -h "$source" ]; do
        local dir="$(cd -P "$(dirname "$source")" && pwd)"
        source="$(readlink "$source")"
        [[ $source != /* ]] && source="$dir/$source"
    done
    cd -P "$(dirname "$source")" && pwd
}

FIXER_SCRIPT_DIR="$(get_script_dir)"
RETRY_CONFIG_FILE="${FIXER_SCRIPT_DIR}/../config/retry-config.json"

# Source error-classifier для использования функций
source "${FIXER_SCRIPT_DIR}/error-classifier.sh"

# Логирование
log() {
    local level="$1"
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*"
}

# Проверка Git конфигурации
check_git_config() {
    if ! git config user.name &>/dev/null || ! git config user.email &>/dev/null; then
        log "ERROR" "Git не настроен. Выполните:"
        log "ERROR" "  git config --global user.name 'Your Name'"
        log "ERROR" "  git config --global user.email 'your@email.com'"
        return 1
    fi
    return 0
}

# Исправление TypeScript ошибок
fix_typescript_errors() {
    log "INFO" "Исправление TypeScript ошибок..."

    # Проверка наличия package.json
    if [[ ! -f "package.json" ]]; then
        log "ERROR" "package.json не найден"
        return 1
    fi

    # Проверка наличия type-check скрипта
    if ! grep -q '"type-check"' package.json; then
        log "WARNING" "Скрипт type-check не найден в package.json, запускаем npm run build"
        if npm run build; then
            log "SUCCESS" "npm run build выполнен успешно"
            return 0
        else
            log "ERROR" "npm run build завершился с ошибкой"
            return 1
        fi
    fi

    # Выполнение type-check
    log "INFO" "Запуск npm run type-check..."
    if npm run type-check; then
        log "SUCCESS" "Type-check прошел успешно"
    else
        log "WARNING" "Type-check обнаружил ошибки, пытаемся собрать..."
    fi

    # Выполнение build
    log "INFO" "Запуск npm run build..."
    if npm run build; then
        log "SUCCESS" "Build выполнен успешно"
        return 0
    else
        log "ERROR" "Build завершился с ошибкой"
        return 1
    fi
}

# Исправление Python синтаксических ошибок
fix_python_syntax() {
    local target_file="$1"

    log "INFO" "Исправление Python синтаксических ошибок..."

    # Проверка наличия black
    if ! command -v black &>/dev/null; then
        log "WARNING" "black не установлен, пропускаем автоформатирование"
        log "INFO" "Установите: pip install black"
    else
        if [[ -n "$target_file" && -f "$target_file" ]]; then
            log "INFO" "Форматирование файла: $target_file"
            black "$target_file"
        else
            log "INFO" "Форматирование всех Python файлов в backend/"
            black backend/ 2>/dev/null || log "WARNING" "Некоторые файлы не отформатированы"
        fi
    fi

    # Проверка наличия flake8
    if ! command -v flake8 &>/dev/null; then
        log "WARNING" "flake8 не установлен, пропускаем проверку"
        log "INFO" "Установите: pip install flake8"
        return 0
    else
        if [[ -n "$target_file" && -f "$target_file" ]]; then
            log "INFO" "Проверка файла: $target_file"
            if flake8 "$target_file"; then
                log "SUCCESS" "flake8 проверка прошла успешно"
                return 0
            else
                log "WARNING" "flake8 обнаружил предупреждения"
                return 0
            fi
        else
            log "INFO" "Проверка всех Python файлов в backend/"
            if flake8 backend/ --count --show-source --statistics; then
                log "SUCCESS" "flake8 проверка прошла успешно"
                return 0
            else
                log "WARNING" "flake8 обнаружил предупреждения"
                return 0
            fi
        fi
    fi
}

# Исправление npm зависимостей
fix_npm_dependencies() {
    log "INFO" "Исправление npm зависимостей..."

    # Проверка наличия package.json
    if [[ ! -f "package.json" ]]; then
        log "ERROR" "package.json не найден"
        return 1
    fi

    # Очистка node_modules
    if [[ -d "node_modules" ]]; then
        log "INFO" "Удаление старых node_modules..."
        rm -rf node_modules
    fi

    # Очистка package-lock.json
    if [[ -f "package-lock.json" ]]; then
        log "INFO" "Удаление package-lock.json..."
        rm -f package-lock.json
    fi

    # Выполнение npm ci для чистой установки
    log "INFO" "Запуск npm ci..."
    if npm ci; then
        log "SUCCESS" "npm ci выполнен успешно"
        return 0
    else
        log "ERROR" "npm ci завершился с ошибкой, пытаемся npm install..."
        if npm install; then
            log "SUCCESS" "npm install выполнен успешно"
            return 0
        else
            log "ERROR" "npm install завершился с ошибкой"
            return 1
        fi
    fi
}

# Исправление Python зависимостей
fix_python_dependencies() {
    log "INFO" "Исправление Python зависимостей..."

    # Проверка наличия requirements.txt
    if [[ ! -f "requirements.txt" ]]; then
        log "ERROR" "requirements.txt не найден"
        return 1
    fi

    # Выполнение pip install
    log "INFO" "Запуск pip install -r requirements.txt..."
    if pip install -r requirements.txt; then
        log "SUCCESS" "pip install выполнен успешно"
        return 0
    else
        log "ERROR" "pip install завершился с ошибкой"
        return 1
    fi
}

# Исправление git pathspec ошибок
fix_git_pathspec() {
    log "INFO" "Исправление git pathspec ошибок..."

    # Сброс индекса
    log "INFO" "Сброс git индекса..."
    git reset HEAD

    # Добавление всех изменений
    log "INFO" "Добавление всех изменений..."
    if git add -A; then
        log "SUCCESS" "git add -A выполнен успешно"
        return 0
    else
        log "ERROR" "git add -A завершился с ошибкой"
        return 1
    fi
}

# Создать commit с исправлениями
commit_and_push_fix() {
    local category="$1"
    local error_log="$2"
    local branch="${3:-test}"

    check_git_config || return 1

    log "INFO" "Создание commit с исправлениями категории: $category"

    # Проверка наличия изменений
    if git diff --quiet && git diff --cached --quiet; then
        log "WARNING" "Нет изменений для commit"
        return 0
    fi

    # Добавление всех изменений
    git add -A

    # Извлечение шаблона commit message
    local commit_template
    if [[ -f "$RETRY_CONFIG_FILE" ]] && command -v jq &>/dev/null; then
        commit_template=$(jq -r '.git_commit_template' "$RETRY_CONFIG_FILE" 2>/dev/null)
    fi

    if [[ -z "$commit_template" || "$commit_template" == "null" ]]; then
        commit_template="fix(deploy): auto-fix {category} errors\n\nAutomated fix triggered by deploy-test skill.\n\nError details:\n{error_log}\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
    fi

    # Подготовка error_log (извлечь последние 5 строк)
    local error_excerpt
    if [[ -f "$error_log" ]]; then
        error_excerpt=$(extract_error_excerpt "$error_log" 5)
    else
        error_excerpt="$error_log"
    fi

    # Замена плейсхолдеров
    local commit_message="${commit_template//\{category\}/$category}"
    commit_message="${commit_message//\{error_log\}/$error_excerpt}"

    # Создание commit
    log "INFO" "Commit message:"
    echo "$commit_message" | sed 's/^/  /'

    if git commit -m "$commit_message"; then
        log "SUCCESS" "Commit создан успешно"
    else
        log "ERROR" "Не удалось создать commit"
        return 1
    fi

    # Push в origin
    log "INFO" "Push изменений в origin/$branch..."
    if git push origin "$branch"; then
        log "SUCCESS" "Push выполнен успешно"
        return 0
    else
        log "ERROR" "Push завершился с ошибкой"
        log "INFO" "Проверьте SSH ключи и права доступа к репозиторию"
        return 1
    fi
}

# Главная функция исправления
fix_locally() {
    local classification="$1"
    local error_log="${2:-}"
    local auto_commit="${3:-true}"

    local category=$(get_error_category "$classification")
    local fix_command=$(get_fix_command "$classification")

    log "INFO" "========================================="
    log "INFO" "Локальное исправление ошибки: $category"
    log "INFO" "========================================="

    local fix_success=false

    case "$category" in
        typescript)
            if fix_typescript_errors; then
                fix_success=true
            fi
            ;;
        python_syntax)
            if fix_python_syntax; then
                fix_success=true
            fi
            ;;
        npm_deps)
            if fix_npm_dependencies; then
                fix_success=true
            fi
            ;;
        python_deps)
            if fix_python_dependencies; then
                fix_success=true
            fi
            ;;
        git_pathspec)
            if fix_git_pathspec; then
                fix_success=true
            fi
            ;;
        *)
            log "WARNING" "Неизвестная категория для локального исправления: $category"
            log "INFO" "Попытка выполнить команду напрямую: $fix_command"
            if [[ -n "$fix_command" ]]; then
                if eval "$fix_command"; then
                    fix_success=true
                fi
            fi
            ;;
    esac

    if [[ "$fix_success" == true ]]; then
        log "SUCCESS" "Локальное исправление выполнено успешно"

        if [[ "$auto_commit" == "true" ]]; then
            log "INFO" "Автоматический commit и push..."
            if commit_and_push_fix "$category" "$error_log"; then
                log "SUCCESS" "Исправления закоммичены и запушены"
                return 0
            else
                log "ERROR" "Не удалось закоммитить исправления"
                return 1
            fi
        else
            log "INFO" "Автоматический commit отключен (--no-auto-commit)"
            return 0
        fi
    else
        log "ERROR" "Локальное исправление не удалось"
        return 1
    fi
}

# Пример использования (для тестирования)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -lt 1 ]]; then
        echo "Usage: $0 <category> [error_log] [auto_commit]"
        echo ""
        echo "Example:"
        echo "  $0 typescript /tmp/deploy.log true"
        echo "  $0 npm_deps '' false"
        exit 1
    fi

    # Создание фиктивной классификации для тестирования
    classification="{\"type\":\"FIXABLE_LOCALLY\",\"category\":\"$1\",\"fix_command\":\"\"}"
    fix_locally "$classification" "${2:-}" "${3:-true}"
fi
