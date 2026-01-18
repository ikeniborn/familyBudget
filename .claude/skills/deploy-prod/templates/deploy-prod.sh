#!/usr/bin/env bash
#
# deploy-prod.sh
# Автоматизированный деплой на production сервер budget-prod
#
# Использование:
#   ./deploy-prod.sh [--auto-fix] [--verbose]
#
# Опции:
#   --auto-fix    Автоматически исправлять найденные проблемы
#   --verbose     Детальный вывод логов
#   --dry-run     Показать что будет сделано без выполнения
#

set -euo pipefail

# Конфигурация
SSH_HOST="budget-prod"
REMOTE_DIR="~/familyBudget"
GIT_BRANCH="prod"
DEPLOY_SCRIPT_BASE="sudo bash deploy.sh --sync-mode update --cleanup-mode smart"
LOG_DIR="$(pwd)/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${LOG_DIR}/deploy-prod_${TIMESTAMP}.log"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Флаги
AUTO_FIX=false
VERBOSE=false
DRY_RUN=false
VERSION_OPTION=""  # Version option to pass to deploy.sh
FORCE_BUILD=""     # Force build option

# Парсинг аргументов
while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-fix)
            AUTO_FIX=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --version)
            # Validate TYPE (patch|minor|major)
            if [[ ! "$2" =~ ^(patch|minor|major)$ ]]; then
                echo -e "${RED}✗${NC} Invalid --version TYPE: $2"
                echo "Must be 'patch', 'minor', or 'major'"
                exit 1
            fi
            VERSION_OPTION="--version $2"
            shift 2
            ;;
        --force-build)
            FORCE_BUILD="--force-build"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--auto-fix] [--verbose] [--dry-run] [--version TYPE] [--force-build]"
            exit 1
            ;;
    esac
done

# Build final deploy command
DEPLOY_SCRIPT="${DEPLOY_SCRIPT_BASE}"
if [[ -n "$VERSION_OPTION" ]]; then
    DEPLOY_SCRIPT="${DEPLOY_SCRIPT} ${VERSION_OPTION}"
    echo -e "${BLUE}ℹ${NC} Version bump: ${VERSION_OPTION}"
else
    echo -e "${BLUE}ℹ${NC} Version bump: none (version will not change)"
fi

if [[ -n "$FORCE_BUILD" ]]; then
    DEPLOY_SCRIPT="${DEPLOY_SCRIPT} ${FORCE_BUILD}"
    echo -e "${BLUE}ℹ${NC} Force build: enabled"
fi

# Создать директорию для логов
mkdir -p "${LOG_DIR}"

# Функция логирования
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")

    case $level in
        INFO)
            echo -e "${BLUE}[INFO]${NC} ${message}" | tee -a "${LOG_FILE}"
            ;;
        SUCCESS)
            echo -e "${GREEN}[SUCCESS]${NC} ${message}" | tee -a "${LOG_FILE}"
            ;;
        WARNING)
            echo -e "${YELLOW}[WARNING]${NC} ${message}" | tee -a "${LOG_FILE}"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} ${message}" | tee -a "${LOG_FILE}"
            ;;
    esac
}

# Функция выполнения SSH команд
ssh_exec() {
    local cmd=$1
    local description=$2

    log INFO "Выполнение: ${description}"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log INFO "[DRY-RUN] Would execute: ssh ${SSH_HOST} '${cmd}'"
        return 0
    fi

    if [[ "${VERBOSE}" == "true" ]]; then
        ssh "${SSH_HOST}" "${cmd}" 2>&1 | tee -a "${LOG_FILE}"
    else
        ssh "${SSH_HOST}" "${cmd}" >> "${LOG_FILE}" 2>&1
    fi

    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        log SUCCESS "${description} - OK"
    else
        log ERROR "${description} - FAILED (exit code: ${exit_code})"
        return $exit_code
    fi

    return 0
}

# Функция проверки SSH подключения
check_ssh_connection() {
    log INFO "Проверка SSH подключения к ${SSH_HOST}..."

    if ssh -o ConnectTimeout=5 -o BatchMode=yes "${SSH_HOST}" true 2>/dev/null; then
        log SUCCESS "SSH подключение установлено"
        return 0
    else
        log ERROR "Не удалось подключиться к ${SSH_HOST}"
        log INFO "Попытка подключения с вводом пароля..."
        if ssh -o ConnectTimeout=10 "${SSH_HOST}" true; then
            log SUCCESS "SSH подключение установлено (с паролем)"
            return 0
        else
            log ERROR "SSH подключение не удалось"
            return 1
        fi
    fi
}

# Функция git pull
git_pull() {
    log INFO "Выполнение git pull в ветке ${GIT_BRANCH}..."

    local cmd="cd ${REMOTE_DIR} && git fetch --all && git checkout ${GIT_BRANCH} && git pull origin ${GIT_BRANCH}"

    ssh_exec "${cmd}" "Git pull в ветке ${GIT_BRANCH}"
}

# Функция деплоя
deploy() {
    log INFO "Запуск деплоя..."

    local cmd="cd ${REMOTE_DIR} && ${DEPLOY_SCRIPT}"

    # Перехватываем вывод для последующего анализа
    if [[ "${DRY_RUN}" == "true" ]]; then
        log INFO "[DRY-RUN] Would execute: ${cmd}"
        return 0
    fi

    log INFO "Команда деплоя: ${DEPLOY_SCRIPT}"

    # Создаем временный файл для вывода деплоя
    local deploy_output=$(mktemp)

    if ssh "${SSH_HOST}" "${cmd}" 2>&1 | tee "${deploy_output}" | tee -a "${LOG_FILE}"; then
        log SUCCESS "Деплой выполнен успешно"

        # Сохраняем вывод для анализа
        cat "${deploy_output}" > "${LOG_DIR}/deploy_output_${TIMESTAMP}.log"
        rm -f "${deploy_output}"

        return 0
    else
        log ERROR "Деплой завершился с ошибкой"

        # Сохраняем вывод для анализа
        cat "${deploy_output}" > "${LOG_DIR}/deploy_output_${TIMESTAMP}.log"
        rm -f "${deploy_output}"

        return 1
    fi
}

# Функция анализа логов деплоя
analyze_deploy_logs() {
    log INFO "Анализ логов деплоя на сервере..."

    local cmd="cat /opt/budget/logs/deploy.log | tail -100"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log INFO "[DRY-RUN] Would analyze: ${cmd}"
        return 0
    fi

    local deploy_log=$(ssh "${SSH_HOST}" "${cmd}" 2>&1)

    echo "${deploy_log}" > "${LOG_DIR}/server_deploy_${TIMESTAMP}.log"

    # Анализ на наличие ошибок
    local errors=$(echo "${deploy_log}" | grep -i -E "error|failed|fatal" || true)

    if [[ -n "${errors}" ]]; then
        log WARNING "Обнаружены ошибки в логах деплоя:"
        echo "${errors}" | tee -a "${LOG_FILE}"
        return 1
    else
        log SUCCESS "Логи деплоя не содержат ошибок"
        return 0
    fi
}

# Функция анализа логов контейнеров
analyze_container_logs() {
    log INFO "Анализ логов контейнеров..."

    local services=("backend" "postgres" "redis")
    local has_errors=false

    for service in "${services[@]}"; do
        log INFO "Проверка логов сервиса: ${service}"

        local cmd="cd /opt/budget && docker compose logs ${service} --tail=50"

        if [[ "${DRY_RUN}" == "true" ]]; then
            log INFO "[DRY-RUN] Would check logs for: ${service}"
            continue
        fi

        local service_log=$(ssh "${SSH_HOST}" "${cmd}" 2>&1)

        echo "${service_log}" > "${LOG_DIR}/container_${service}_${TIMESTAMP}.log"

        # Проверка на ошибки
        local errors=$(echo "${service_log}" | grep -i -E "error|exception|fatal|traceback" | grep -v "DEBUG" || true)

        if [[ -n "${errors}" ]]; then
            log WARNING "Обнаружены ошибки в логах ${service}:"
            echo "${errors}" | head -10 | tee -a "${LOG_FILE}"
            has_errors=true
        else
            log SUCCESS "Логи ${service} не содержат критических ошибок"
        fi
    done

    if [[ "${has_errors}" == "true" ]]; then
        return 1
    else
        return 0
    fi
}

# Функция проверки статуса контейнеров
check_container_status() {
    log INFO "Проверка статуса контейнеров..."

    local cmd="cd /opt/budget && docker compose ps --format json"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log INFO "[DRY-RUN] Would check container status"
        return 0
    fi

    local container_status=$(ssh "${SSH_HOST}" "${cmd}" 2>&1)

    echo "${container_status}" > "${LOG_DIR}/container_status_${TIMESTAMP}.json"

    # Проверка на unhealthy контейнеры
    local unhealthy=$(echo "${container_status}" | grep -i "unhealthy" || true)

    if [[ -n "${unhealthy}" ]]; then
        log WARNING "Обнаружены нездоровые контейнеры:"
        echo "${unhealthy}" | tee -a "${LOG_FILE}"
        return 1
    else
        log SUCCESS "Все контейнеры работают корректно"
        return 0
    fi
}

# Функция проверки запущенных процессов
check_running_processes() {
    log INFO "Проверка незавершенных процессов на сервере..."

    local cmd="ps aux | grep -E 'deploy|docker|npm|node' | grep -v grep || true"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log INFO "[DRY-RUN] Would check running processes"
        return 0
    fi

    local processes=$(ssh "${SSH_HOST}" "${cmd}" 2>&1)

    if [[ -n "${processes}" ]]; then
        log WARNING "Обнаружены запущенные процессы деплоя:"
        echo "${processes}" | tee -a "${LOG_FILE}"

        # Проверка на зависшие процессы
        local stuck_processes=$(echo "${processes}" | awk '{if ($10 > 300) print $0}' || true)

        if [[ -n "${stuck_processes}" ]]; then
            log ERROR "Обнаружены зависшие процессы (>5 минут):"
            echo "${stuck_processes}" | tee -a "${LOG_FILE}"

            if [[ "${AUTO_FIX}" == "true" ]]; then
                log INFO "Завершение зависших процессов..."
                # TODO: Implement auto-kill for stuck processes
                log WARNING "Автоматическое завершение процессов пока не реализовано"
            fi
        fi

        return 1
    else
        log SUCCESS "Незавершенных процессов деплоя не обнаружено"
        return 0
    fi
}

# Функция исправления проблем
fix_issues() {
    local issue_type=$1

    log INFO "Попытка исправления проблемы: ${issue_type}"

    case ${issue_type} in
        container_unhealthy)
            log INFO "Перезапуск нездоровых контейнеров..."
            ssh_exec "cd /opt/budget && docker compose restart" "Перезапуск контейнеров"
            ;;
        deploy_failed)
            log INFO "Повторная попытка деплоя..."
            deploy
            ;;
        stuck_processes)
            log WARNING "Необходима ручная проверка зависших процессов"
            ;;
        *)
            log WARNING "Неизвестный тип проблемы: ${issue_type}"
            ;;
    esac
}

# Главная функция
main() {
    log INFO "========================================="
    log INFO "Начало автоматизированного деплоя на production сервер"
    log INFO "Сервер: ${SSH_HOST}"
    log INFO "Ветка: ${GIT_BRANCH}"
    log INFO "Лог файл: ${LOG_FILE}"
    log INFO "========================================="

    # Шаг 1: Проверка SSH подключения
    if ! check_ssh_connection; then
        log ERROR "Деплой прерван: не удалось установить SSH подключение"
        exit 1
    fi

    # Шаг 2: Git pull
    if ! git_pull; then
        log ERROR "Деплой прерван: git pull завершился с ошибкой"
        exit 1
    fi

    # Шаг 3: Деплой
    local deploy_success=true
    if ! deploy; then
        deploy_success=false
        log WARNING "Деплой завершился с ошибкой, продолжаем анализ..."
    fi

    # Шаг 4: Анализ логов деплоя
    if ! analyze_deploy_logs; then
        log WARNING "Обнаружены проблемы в логах деплоя"

        if [[ "${AUTO_FIX}" == "true" ]]; then
            fix_issues "deploy_failed"
        fi
    fi

    # Шаг 5: Анализ логов контейнеров
    if ! analyze_container_logs; then
        log WARNING "Обнаружены проблемы в логах контейнеров"
    fi

    # Шаг 6: Проверка статуса контейнеров
    if ! check_container_status; then
        log WARNING "Обнаружены проблемы со статусом контейнеров"

        if [[ "${AUTO_FIX}" == "true" ]]; then
            fix_issues "container_unhealthy"
        fi
    fi

    # Шаг 7: Проверка запущенных процессов
    if ! check_running_processes; then
        log WARNING "Обнаружены незавершенные процессы"

        if [[ "${AUTO_FIX}" == "true" ]]; then
            fix_issues "stuck_processes"
        fi
    fi

    # Итоговый статус
    log INFO "========================================="
    if [[ "${deploy_success}" == "true" ]]; then
        log SUCCESS "Деплой завершен успешно!"
        log INFO "Логи сохранены в: ${LOG_DIR}"
        exit 0
    else
        log ERROR "Деплой завершился с ошибками"
        log INFO "Логи сохранены в: ${LOG_DIR}"
        log INFO "Проверьте логи для получения деталей"
        exit 1
    fi
}

# Запуск главной функции
main
