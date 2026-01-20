#!/bin/bash

# error-classifier.sh
# Модуль классификации ошибок деплоя для автоматического восстановления
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

CLASSIFIER_SCRIPT_DIR="$(get_script_dir)"
ERROR_PATTERNS_FILE="${CLASSIFIER_SCRIPT_DIR}/../config/error-patterns.json"

# Проверка наличия jq
check_jq_available() {
    if ! command -v jq &> /dev/null; then
        echo "ERROR: jq не установлен. Установите: sudo apt install jq" >&2
        return 1
    fi
    return 0
}

# Загрузить паттерны ошибок из JSON
load_error_patterns() {
    if [[ ! -f "$ERROR_PATTERNS_FILE" ]]; then
        echo "ERROR: Файл паттернов не найден: $ERROR_PATTERNS_FILE" >&2
        return 1
    fi

    check_jq_available || return 1

    # Валидация JSON
    if ! jq empty "$ERROR_PATTERNS_FILE" 2>/dev/null; then
        echo "ERROR: Некорректный JSON в $ERROR_PATTERNS_FILE" >&2
        return 1
    fi

    return 0
}

# Классифицировать ошибку по логу
# Аргументы:
#   $1 - путь к файлу лога или текст ошибки
# Возвращает (через stdout):
#   JSON объект с полями: type, category, fix_command, severity, retry_delay, manual_action
classify_error() {
    local log_input="$1"
    local log_content=""

    check_jq_available || return 1
    load_error_patterns || return 1

    # Определить, это файл или текст
    if [[ -f "$log_input" ]]; then
        log_content="$(cat "$log_input")"
    else
        log_content="$log_input"
    fi

    # Поиск совпадений в fixable_locally
    local match_result
    match_result=$(jq -r --arg log "$log_content" '
        .fixable_locally[] |
        select($log | test(.pattern; "i")) |
        {
            type: "FIXABLE_LOCALLY",
            category: .category,
            fix_command: .fix_command,
            severity: .severity,
            retry_delay: .retry_delay,
            description: .description,
            pattern: .pattern
        } |
        @json
    ' "$ERROR_PATTERNS_FILE" | head -n 1)

    if [[ -n "$match_result" ]]; then
        echo "$match_result"
        return 0
    fi

    # Поиск совпадений в fixable_remotely
    match_result=$(jq -r --arg log "$log_content" '
        .fixable_remotely[] |
        select($log | test(.pattern; "i")) |
        {
            type: "FIXABLE_REMOTELY",
            category: .category,
            fix_command: .fix_command,
            severity: .severity,
            retry_delay: .retry_delay,
            description: .description,
            pattern: .pattern
        } |
        @json
    ' "$ERROR_PATTERNS_FILE" | head -n 1)

    if [[ -n "$match_result" ]]; then
        echo "$match_result"
        return 0
    fi

    # Поиск совпадений в not_fixable
    match_result=$(jq -r --arg log "$log_content" '
        .not_fixable[] |
        select($log | test(.pattern; "i")) |
        {
            type: "NOT_FIXABLE",
            category: .category,
            manual_action: .manual_action,
            severity: .severity,
            description: .description,
            pattern: .pattern
        } |
        @json
    ' "$ERROR_PATTERNS_FILE" | head -n 1)

    if [[ -n "$match_result" ]]; then
        echo "$match_result"
        return 0
    fi

    # Ошибка не распознана
    echo '{
        "type": "UNKNOWN",
        "category": "unknown",
        "severity": "medium",
        "retry_delay": 10,
        "description": "Неизвестная ошибка, требуется анализ"
    }'
    return 0
}

# Получить тип ошибки (FIXABLE_LOCALLY, FIXABLE_REMOTELY, NOT_FIXABLE, UNKNOWN)
get_error_type() {
    local classification="$1"
    echo "$classification" | jq -r '.type'
}

# Получить категорию ошибки
get_error_category() {
    local classification="$1"
    echo "$classification" | jq -r '.category'
}

# Получить команду исправления
get_fix_command() {
    local classification="$1"
    echo "$classification" | jq -r '.fix_command // empty'
}

# Получить задержку перед повтором
get_retry_delay() {
    local classification="$1"
    echo "$classification" | jq -r '.retry_delay // 10'
}

# Получить severity
get_severity() {
    local classification="$1"
    echo "$classification" | jq -r '.severity // "unknown"'
}

# Получить manual_action для неисправимых ошибок
get_manual_action() {
    local classification="$1"
    echo "$classification" | jq -r '.manual_action // empty'
}

# Получить описание ошибки
get_description() {
    local classification="$1"
    echo "$classification" | jq -r '.description // "No description"'
}

# Проверить, является ли ошибка критической (abort_on_critical)
is_critical_error() {
    local log_content="$1"
    local retry_config_file="${CLASSIFIER_SCRIPT_DIR}/../config/retry-config.json"

    if [[ ! -f "$retry_config_file" ]]; then
        return 1
    fi

    check_jq_available || return 1

    # Проверка критических паттернов
    local is_critical
    is_critical=$(jq -r --arg log "$log_content" '
        .critical_error_patterns[] |
        select($log | test(.; "i")) |
        "true"
    ' "$retry_config_file" | head -n 1)

    if [[ "$is_critical" == "true" ]]; then
        return 0
    fi

    return 1
}

# Извлечь релевантный фрагмент лога для commit message
extract_error_excerpt() {
    local log_file="$1"
    local max_lines="${2:-10}"

    if [[ ! -f "$log_file" ]]; then
        echo "Log file not found"
        return 1
    fi

    # Поиск строк с ERROR, FAIL, error:
    grep -iE "(ERROR|FAIL|error:|exception)" "$log_file" | tail -n "$max_lines" || \
    tail -n "$max_lines" "$log_file"
}

# Вывести красиво отформатированную классификацию
print_classification() {
    local classification="$1"

    local type=$(get_error_type "$classification")
    local category=$(get_error_category "$classification")
    local severity=$(get_severity "$classification")
    local description=$(get_description "$classification")
    local fix_command=$(get_fix_command "$classification")
    local manual_action=$(get_manual_action "$classification")
    local retry_delay=$(get_retry_delay "$classification")

    echo "========================================="
    echo "Классификация ошибки:"
    echo "========================================="
    echo "Тип:         $type"
    echo "Категория:   $category"
    echo "Severity:    $severity"
    echo "Описание:    $description"

    if [[ -n "$fix_command" ]]; then
        echo "Команда:     $fix_command"
    fi

    if [[ -n "$manual_action" ]]; then
        echo "Ручные действия:"
        echo "$manual_action" | sed 's/^/  /'
    fi

    echo "Задержка:    ${retry_delay}s"
    echo "========================================="
}

# Пример использования (для тестирования)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -eq 0 ]]; then
        echo "Usage: $0 <log_file_or_text>"
        echo ""
        echo "Example:"
        echo "  $0 /path/to/deploy.log"
        echo "  $0 'TypeScript error TS2304: Cannot find name'"
        exit 1
    fi

    classification=$(classify_error "$1")
    print_classification "$classification"
fi
