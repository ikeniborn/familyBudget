#!/bin/bash

# recovery-strategies.sh
# Модуль стратегий восстановления с повторными попытками
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

RECOVERY_SCRIPT_DIR="$(get_script_dir)"

# Source модулей
source "${RECOVERY_SCRIPT_DIR}/error-classifier.sh"
source "${RECOVERY_SCRIPT_DIR}/local-fixer.sh"

# Логирование (если не определено в deploy-test.sh)
if ! declare -f log &>/dev/null; then
    log() {
        local level="$1"
        shift
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*"
    }
fi

# Замена плейсхолдеров в командах
# {service}, {file}, и т.д.
substitute_placeholders() {
    local command="$1"
    local service="${2:-}"
    local file="${3:-}"

    command="${command//\{service\}/$service}"
    command="${command//\{file\}/$file}"

    echo "$command"
}

# Git pull на удаленном сервере
git_pull_remote() {
    local ssh_host="$1"
    local remote_dir="${2:-/opt/budget}"

    log "INFO" "Выполнение git pull на сервере $ssh_host..."

    if ssh "$ssh_host" "cd $remote_dir && git pull"; then
        log "SUCCESS" "Git pull на сервере выполнен успешно"
        return 0
    else
        log "ERROR" "Git pull на сервере завершился с ошибкой"
        return 1
    fi
}

# ПРИМЕЧАНИЕ: Удаленное исправление (fix_remotely) УДАЛЕНО
# Согласно требованиям, исправления применяются ТОЛЬКО локально с коммитом
# и получением изменений на сервере через git pull

# Показать инструкции для ручного исправления
show_manual_action() {
    local classification="$1"

    local category=$(get_error_category "$classification")
    local manual_action=$(get_manual_action "$classification")
    local severity=$(get_severity "$classification")

    log "ERROR" "========================================="
    log "ERROR" "ТРЕБУЕТСЯ РУЧНОЕ ИСПРАВЛЕНИЕ"
    log "ERROR" "========================================="
    log "ERROR" "Категория: $category"
    log "ERROR" "Severity:  $severity"
    log "ERROR" ""
    log "ERROR" "Инструкции:"
    echo "$manual_action" | while IFS= read -r line; do
        log "ERROR" "  $line"
    done
    log "ERROR" "========================================="
}

# Выполнение деплоя (должна быть определена в deploy-test.sh)
# Эта функция будет переопределена в главном скрипте
run_deploy() {
    log "ERROR" "run_deploy() не определена в deploy-test.sh"
    return 1
}

# Exponential backoff задержка
calculate_backoff_delay() {
    local attempt="$1"
    local base_delay="$2"
    local max_delay="${3:-60}"

    # Exponential: base_delay * 2^(attempt-1)
    local delay=$((base_delay * (2 ** (attempt - 1))))

    # Ограничение max_delay
    if [[ $delay -gt $max_delay ]]; then
        delay=$max_delay
    fi

    echo "$delay"
}

# Цикл повторных попыток деплоя с автоматическим восстановлением
retry_deploy_with_backoff() {
    local max_attempts="${1:-3}"
    local base_delay="${2:-5}"
    local ssh_host="${SSH_HOST:-}"
    local remote_dir="${REMOTE_DIR:-/opt/budget}"
    local auto_commit="${NO_AUTO_COMMIT:-false}"
    local log_file="${LOG_FILE:-}"

    # Инверсия NO_AUTO_COMMIT для передачи в fix_locally
    if [[ "$auto_commit" == "true" ]]; then
        auto_commit="false"
    else
        auto_commit="true"
    fi

    log "INFO" "========================================="
    log "INFO" "Запуск деплоя с автоматическим восстановлением"
    log "INFO" "Максимум попыток: $max_attempts"
    log "INFO" "Базовая задержка: ${base_delay}s"
    log "INFO" "========================================="

    for attempt in $(seq 1 "$max_attempts"); do
        log "INFO" ""
        log "INFO" "========================================="
        log "INFO" "ПОПЫТКА $attempt из $max_attempts"
        log "INFO" "========================================="

        # Попытка деплоя
        if run_deploy; then
            log "SUCCESS" "========================================="
            log "SUCCESS" "ДЕПЛОЙ УСПЕШЕН НА ПОПЫТКЕ $attempt"
            log "SUCCESS" "========================================="
            return 0
        fi

        log "WARNING" "Деплой завершился с ошибкой на попытке $attempt"

        # Если это последняя попытка, не анализируем
        if [[ $attempt -eq $max_attempts ]]; then
            log "ERROR" "Все попытки исчерпаны ($max_attempts)"
            return 1
        fi

        # Анализ логов деплоя
        log "INFO" "Анализ логов деплоя..."

        if [[ ! -f "$log_file" ]]; then
            log "WARNING" "Лог файл не найден: $log_file, используем последний вывод"
            log_file="/tmp/deploy_error_${attempt}.log"
            # Здесь должен быть механизм сохранения последнего вывода
        fi

        # Классификация ошибки
        local classification
        classification=$(classify_error "$log_file")

        if [[ -z "$classification" ]]; then
            log "ERROR" "Не удалось классифицировать ошибку"
            continue
        fi

        print_classification "$classification"

        local error_type=$(get_error_type "$classification")
        local category=$(get_error_category "$classification")
        local retry_delay=$(get_retry_delay "$classification")

        # Проверка на критические ошибки
        if is_critical_error "$(cat "$log_file")"; then
            log "ERROR" "Обнаружена критическая ошибка, прерывание попыток"
            show_manual_action "$classification"
            return 1
        fi

        # Обработка по типу ошибки
        case "$error_type" in
            FIXABLE_LOCALLY)
                log "INFO" "Ошибка исправима локально"

                # Локальное исправление
                if fix_locally "$classification" "$log_file" "$auto_commit"; then
                    log "SUCCESS" "Локальное исправление выполнено"

                    # Git pull на сервере (получить исправления)
                    if [[ -n "$ssh_host" ]]; then
                        git_pull_remote "$ssh_host" "$remote_dir"
                    fi
                else
                    log "ERROR" "Локальное исправление не удалось"
                fi
                ;;

            FIXABLE_REMOTELY)
                log "WARNING" "Ошибка требует ручного исправления на сервере"
                log "INFO" "Исправления применяются ТОЛЬКО локально с коммитом"
                log "INFO" "Для устранения этой ошибки выполните команды вручную:"

                local fix_command=$(get_fix_command "$classification")
                if [[ -n "$fix_command" ]]; then
                    log "INFO" ""
                    log "INFO" "  ssh $ssh_host \"cd $remote_dir && $fix_command\""
                    log "INFO" ""
                fi

                # Не прерываем, даем шанс следующей попытке
                log "WARNING" "Попытка продолжить без исправления..."
                ;;

            NOT_FIXABLE)
                log "ERROR" "Ошибка не исправима автоматически"
                show_manual_action "$classification"
                return 1
                ;;

            UNKNOWN)
                log "WARNING" "Ошибка не распознана, пытаемся повторить деплой"
                ;;

            *)
                log "ERROR" "Неизвестный тип ошибки: $error_type"
                ;;
        esac

        # Backoff задержка перед следующей попыткой
        local delay=$(calculate_backoff_delay "$attempt" "$base_delay" 60)
        log "INFO" "Задержка перед следующей попыткой: ${delay}s"
        sleep "$delay"
    done

    log "ERROR" "========================================="
    log "ERROR" "ВСЕ ПОПЫТКИ ИСЧЕРПАНЫ"
    log "ERROR" "========================================="
    return 1
}

# Пример использования (для тестирования)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "recovery-strategies.sh должен быть source'ен из deploy-test.sh"
    echo "Этот скрипт не предназначен для прямого запуска"
    exit 1
fi
