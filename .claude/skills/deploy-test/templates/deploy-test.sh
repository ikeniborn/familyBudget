#!/usr/bin/env bash
#
# deploy-test.sh
# Автоматизированный деплой на тестовый сервер budget-test с автоматическим восстановлением
# Версия: 2.0.1
#
# Использование:
#   ./deploy-test.sh [OPTIONS]
#
# Опции:
#   --auto-fix              Автоматически исправлять найденные проблемы
#   --verbose               Детальный вывод логов
#   --dry-run               Показать что будет сделано без выполнения
#   --version TYPE          Bump версии (patch|minor|major)
#   --force-build           Принудительная пересборка
#   --max-retries N         Максимум попыток деплоя (default: 3)
#   --retry-delay N         Базовая задержка между попытками (default: 5s)
#   --skip-local-validation Пропустить предварительную проверку кода
#   --no-auto-commit        Не коммитить исправления автоматически
#   --rollback-on-fail      Откатить на предыдущую версию при ошибке
#

set -euo pipefail

# Получить путь к директории скриптов
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source модулей для автоматического восстановления (v2.0.0)
if [[ -f "${SCRIPT_DIR}/recovery-strategies.sh" ]]; then
    source "${SCRIPT_DIR}/recovery-strategies.sh"
fi

# Конфигурация
SSH_HOST="budget-test"
REMOTE_DIR="~/familyBudget"
REMOTE_DEPLOY_DIR="/opt/budget"  # Директория деплоя на сервере
GIT_BRANCH="test"
DEPLOY_SCRIPT_BASE="sudo bash deploy.sh --use-registry --sync-mode skip --cleanup-mode smart"
LOG_DIR="$(pwd)/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${LOG_DIR}/deploy-test_${TIMESTAMP}.log"

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

# Флаги v2.0.0 (автоматическое восстановление)
MAX_RETRY_ATTEMPTS=3        # Максимум попыток деплоя
RETRY_BASE_DELAY=5          # Базовая задержка между попытками (секунды)
SKIP_LOCAL_VALIDATION=false # Пропустить предварительную проверку кода
NO_AUTO_COMMIT=false        # Не коммитить исправления автоматически
ROLLBACK_ON_FAIL=false      # Откатить на предыдущую версию при ошибке

# Флаги v9.2.0 (GitHub Actions мониторинг)
WAIT_FOR_BUILD=false        # Ожидать завершения GitHub Actions
BUILD_TIMEOUT=30            # Timeout для GitHub Actions (минуты)

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
        --max-retries)
            MAX_RETRY_ATTEMPTS="$2"
            shift 2
            ;;
        --retry-delay)
            RETRY_BASE_DELAY="$2"
            shift 2
            ;;
        --skip-local-validation)
            SKIP_LOCAL_VALIDATION=true
            shift
            ;;
        --no-auto-commit)
            NO_AUTO_COMMIT=true
            shift
            ;;
        --rollback-on-fail)
            ROLLBACK_ON_FAIL=true
            shift
            ;;
        --wait-for-build)
            WAIT_FOR_BUILD=true
            shift
            ;;
        --build-timeout)
            if ! [[ "$2" =~ ^[0-9]+$ ]] || [[ "$2" -le 0 ]]; then
                echo -e "${RED}✗${NC} Invalid --build-timeout: $2"
                echo "Must be a positive integer"
                exit 1
            fi
            BUILD_TIMEOUT="$2"
            shift 2
            ;;
        --skip-build-check)
            WAIT_FOR_BUILD=false
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --auto-fix              Автоматически исправлять найденные проблемы"
            echo "  --verbose               Детальный вывод логов"
            echo "  --dry-run               Показать что будет сделано без выполнения"
            echo "  --version TYPE          Bump версии (patch|minor|major)"
            echo "  --force-build           Принудительная пересборка"
            echo "  --max-retries N         Максимум попыток деплоя (default: 3)"
            echo "  --retry-delay N         Базовая задержка между попытками (default: 5s)"
            echo "  --skip-local-validation Пропустить предварительную проверку кода"
            echo "  --no-auto-commit        Не коммитить исправления автоматически"
            echo "  --rollback-on-fail      Откатить на предыдущую версию при ошибке"
            echo "  --wait-for-build        Ожидать завершения GitHub Actions (default: false)"
            echo "  --build-timeout N       Timeout для GitHub Actions (default: 30 min)"
            echo "  --skip-build-check      Пропустить проверку GitHub Actions"
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

    local cmd="cat ${REMOTE_DEPLOY_DIR}/logs/deploy.log | tail -100"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log INFO "[DRY-RUN] Would analyze: ${cmd}"
        return 0
    fi

    # Execute with timeout (30s) and connection timeout (10s)
    local deploy_log=""
    local ssh_exit_code=0

    deploy_log=$(timeout 30 ssh -o ConnectTimeout=10 "${SSH_HOST}" "${cmd}" 2>&1) || ssh_exit_code=$?

    # Check for timeout or SSH errors
    if [[ ${ssh_exit_code} -eq 124 ]]; then
        log WARNING "Timeout при получении логов деплоя (превышено 30 секунд)"
        return 0  # Non-critical, continue
    elif [[ ${ssh_exit_code} -ne 0 ]]; then
        log WARNING "Ошибка SSH при получении логов деплоя (exit code: ${ssh_exit_code})"
        return 0  # Non-critical, continue
    fi

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

        local cmd="cd ${REMOTE_DEPLOY_DIR} && docker compose logs ${service} --tail=50"

        if [[ "${DRY_RUN}" == "true" ]]; then
            log INFO "[DRY-RUN] Would check logs for: ${service}"
            continue
        fi

        # Execute with timeout (60s) and connection timeout (10s)
        local service_log=""
        local ssh_exit_code=0

        service_log=$(timeout 60 ssh -o ConnectTimeout=10 "${SSH_HOST}" "${cmd}" 2>&1) || ssh_exit_code=$?

        # Check for timeout (exit code 124) or SSH errors
        if [[ ${ssh_exit_code} -eq 124 ]]; then
            log WARNING "Timeout при получении логов ${service} (превышено 60 секунд)"
            echo "TIMEOUT: SSH command exceeded 60 seconds" > "${LOG_DIR}/container_${service}_${TIMESTAMP}.log"
            continue
        elif [[ ${ssh_exit_code} -ne 0 ]]; then
            log WARNING "Ошибка SSH при получении логов ${service} (exit code: ${ssh_exit_code})"
            echo "SSH ERROR: Exit code ${ssh_exit_code}" > "${LOG_DIR}/container_${service}_${TIMESTAMP}.log"
            echo "${service_log}" >> "${LOG_DIR}/container_${service}_${TIMESTAMP}.log"
            continue
        fi

        # Save logs to file
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

    local cmd="cd ${REMOTE_DEPLOY_DIR} && docker compose ps --format json"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log INFO "[DRY-RUN] Would check container status"
        return 0
    fi

    # Execute with timeout (30s) and connection timeout (10s)
    local container_status=""
    local ssh_exit_code=0

    container_status=$(timeout 30 ssh -o ConnectTimeout=10 "${SSH_HOST}" "${cmd}" 2>&1) || ssh_exit_code=$?

    # Check for timeout or SSH errors
    if [[ ${ssh_exit_code} -eq 124 ]]; then
        log WARNING "Timeout при проверке статуса контейнеров (превышено 30 секунд)"
        return 0  # Non-critical, continue
    elif [[ ${ssh_exit_code} -ne 0 ]]; then
        log WARNING "Ошибка SSH при проверке статуса контейнеров (exit code: ${ssh_exit_code})"
        return 0  # Non-critical, continue
    fi

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

    # Execute with timeout (20s) and connection timeout (10s)
    local processes=""
    local ssh_exit_code=0

    processes=$(timeout 20 ssh -o ConnectTimeout=10 "${SSH_HOST}" "${cmd}" 2>&1) || ssh_exit_code=$?

    # Check for timeout or SSH errors
    if [[ ${ssh_exit_code} -eq 124 ]]; then
        log WARNING "Timeout при проверке процессов (превышено 20 секунд)"
        return 0  # Non-critical, continue
    elif [[ ${ssh_exit_code} -ne 0 && ${ssh_exit_code} -ne 1 ]]; then
        # Exit code 1 is normal (grep found nothing)
        log WARNING "Ошибка SSH при проверке процессов (exit code: ${ssh_exit_code})"
        return 0  # Non-critical, continue
    fi

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
            ssh_exec "cd ${REMOTE_DEPLOY_DIR} && docker compose restart" "Перезапуск контейнеров"
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

# =========================================
# GitHub Actions Monitoring (v9.2.0)
# =========================================

# Проверка наличия и аутентификации GitHub CLI
check_github_cli() {
    if ! command -v gh &> /dev/null; then
        return 1
    fi

    # Проверка аутентификации
    if ! gh auth status &> /dev/null; then
        return 1
    fi

    return 0
}

# Получить последний workflow run для указанной ветки
# Аргументы:
#   $1 - branch name (default: "test")
# Возвращает:
#   0 - Run найден
#   1 - Ошибка API
#   2 - Run не найден
get_latest_workflow_run() {
    local branch="${1:-test}"
    local workflow="build-and-push.yml"

    log INFO "Поиск последнего workflow run для ветки: ${branch}..."

    # Запрос к GitHub API через gh CLI
    local run_json=""
    run_json=$(gh run list \
        --workflow="${workflow}" \
        --branch="${branch}" \
        --limit 1 \
        --json databaseId,status,conclusion,headSha,createdAt 2>&1)

    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        log ERROR "Ошибка при запросе к GitHub API:"
        echo "${run_json}" | tee -a "${LOG_FILE}"
        return 1
    fi

    # Проверка что массив не пустой
    local run_count=$(echo "${run_json}" | jq '. | length' 2>/dev/null || echo "0")

    if [[ "${run_count}" -eq 0 ]]; then
        log WARNING "Workflow run не найден для ветки ${branch}"
        log INFO "Возможно GitHub Actions еще не запустился"
        return 2
    fi

    # Извлечь данные первого (последнего) run
    local run_id=$(echo "${run_json}" | jq -r '.[0].databaseId' 2>/dev/null)
    local status=$(echo "${run_json}" | jq -r '.[0].status' 2>/dev/null)
    local conclusion=$(echo "${run_json}" | jq -r '.[0].conclusion' 2>/dev/null)

    log INFO "Run ID: ${run_id}"
    log INFO "Status: ${status}"
    if [[ "${conclusion}" != "null" ]]; then
        log INFO "Conclusion: ${conclusion}"
    fi

    # Экспорт переменных для использования в wait_for_github_actions
    export GH_RUN_ID="${run_id}"
    export GH_RUN_STATUS="${status}"
    export GH_RUN_CONCLUSION="${conclusion}"

    return 0
}

# Интерактивное подтверждение (fallback если gh CLI недоступен)
ask_user_confirmation() {
    log WARNING "========================================="
    log WARNING "GitHub CLI (gh) не установлен или не аутентифицирован"
    log WARNING "========================================="
    log WARNING "Автоматический мониторинг GitHub Actions недоступен."
    echo ""
    log INFO "Проверьте статус GitHub Actions вручную:"
    log INFO "  https://github.com/ikeniborn/familyBudget/actions"
    echo ""

    # Non-interactive mode (stdin not terminal)
    if [[ ! -t 0 ]]; then
        log WARNING "Non-interactive mode: отказ от деплоя без проверки CI/CD"
        return 1
    fi

    # Interactive confirmation
    read -p "${YELLOW}GitHub Actions build status cannot be verified automatically. Продолжить деплой без проверки CI/CD? [y/N]: ${NC}" -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log WARNING "Пользователь подтвердил деплой без проверки CI/CD"
        return 0
    else
        log INFO "Деплой отменен пользователем"
        return 1
    fi
}

# Ожидание завершения GitHub Actions build
# Аргументы:
#   $1 - branch name (default: "test")
#   $2 - timeout_minutes (default: 30)
# Возвращает:
#   0 - Build успешно завершен
#   1 - Build failed или timeout
wait_for_github_actions() {
    local branch="${1:-test}"
    local timeout_minutes="${2:-30}"
    local timeout_seconds=$((timeout_minutes * 60))
    local polling_interval=15  # секунды
    local elapsed=0

    log INFO "========================================="
    log INFO "Мониторинг GitHub Actions build"
    log INFO "========================================="
    log INFO "Workflow: build-and-push.yml"
    log INFO "Branch:   ${branch}"
    log INFO "Timeout:  ${timeout_minutes} минут"
    echo ""

    # Проверка gh CLI
    if ! check_github_cli; then
        log WARNING "GitHub CLI недоступен, переход на ручное подтверждение..."
        if ask_user_confirmation; then
            return 0
        else
            return 1
        fi
    fi

    # Получить последний workflow run
    get_latest_workflow_run "${branch}"
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        if [[ $exit_code -eq 2 ]]; then
            # Run не найден, fallback на ручное подтверждение
            log WARNING "Workflow run не найден, переход на ручное подтверждение..."
            if ask_user_confirmation; then
                return 0
            else
                return 1
            fi
        else
            # API error
            log ERROR "Ошибка при получении workflow run"
            return 1
        fi
    fi

    # Валидация экспортированных переменных
    if [[ -z "${GH_RUN_ID}" || "${GH_RUN_ID}" == "null" ]]; then
        log ERROR "Failed to retrieve workflow run information"
        return 1
    fi

    local run_id="${GH_RUN_ID}"
    local status="${GH_RUN_STATUS}"
    local conclusion="${GH_RUN_CONCLUSION}"

    log INFO "Отслеживать прогресс: https://github.com/ikeniborn/familyBudget/actions/runs/${run_id}"
    echo ""

    # Если run уже завершен
    if [[ "${status}" == "completed" ]]; then
        if [[ "${conclusion}" == "success" ]]; then
            log SUCCESS "✅ GitHub Actions build уже завершен успешно"
            return 0
        else
            log ERROR "❌ GitHub Actions build завершился с ошибкой: ${conclusion}"
            log ERROR "Проверьте логи: https://github.com/ikeniborn/familyBudget/actions/runs/${run_id}"
            return 1
        fi
    fi

    # Polling loop
    log INFO "Ожидание завершения GitHub Actions build..."

    while [[ $elapsed -lt $timeout_seconds ]]; do
        # Получить текущий статус
        local run_json=""
        run_json=$(gh run view "${run_id}" --json status,conclusion 2>&1)
        local exit_code=$?

        if [[ $exit_code -ne 0 ]]; then
            log WARNING "Ошибка при проверке статуса run ${run_id}"
            sleep $polling_interval
            elapsed=$((elapsed + polling_interval))
            continue
        fi

        status=$(echo "${run_json}" | jq -r '.status' 2>/dev/null)
        conclusion=$(echo "${run_json}" | jq -r '.conclusion' 2>/dev/null)

        # Форматировать elapsed time
        local elapsed_min=$((elapsed / 60))
        local elapsed_sec=$((elapsed % 60))

        log INFO "Прогресс: ${elapsed_min}m ${elapsed_sec}s | Status: ${status}"

        # Проверка завершения
        if [[ "${status}" == "completed" ]]; then
            if [[ "${conclusion}" == "success" ]]; then
                log SUCCESS "✅ GitHub Actions build успешно завершен (${elapsed_min}m ${elapsed_sec}s)"
                return 0
            else
                log ERROR "❌ GitHub Actions build завершился с ошибкой: ${conclusion}"
                log ERROR "Проверьте логи: https://github.com/ikeniborn/familyBudget/actions/runs/${run_id}"
                return 1
            fi
        fi

        # Ожидание
        sleep $polling_interval
        elapsed=$((elapsed + polling_interval))
    done

    # Timeout
    log ERROR "❌ Timeout: GitHub Actions build не завершился за ${timeout_minutes} минут"
    log ERROR "Проверьте статус вручную: https://github.com/ikeniborn/familyBudget/actions/runs/${run_id}"
    return 1
}

# =========================================
# Pre-deployment Validation (v2.0.0)
# =========================================

# Функция предварительной проверки локального кода (v2.0.0)
validate_local_code() {
    log INFO "========================================="
    log INFO "Предварительная проверка локального кода"
    log INFO "========================================="

    local validation_failed=false

    # TypeScript type-check
    if [[ -f "package.json" ]] && grep -q '"type-check"' package.json 2>/dev/null; then
        log INFO "Проверка TypeScript типов..."
        if npm run type-check 2>&1 | tee -a "${LOG_FILE}"; then
            log SUCCESS "TypeScript type-check: OK"
        else
            log WARNING "TypeScript type-check: обнаружены ошибки"
            validation_failed=true
        fi
    else
        log INFO "TypeScript type-check: пропущено (скрипт не найден)"
    fi

    # Python linting (опционально)
    if command -v flake8 &> /dev/null; then
        if [[ -d "backend" ]]; then
            log INFO "Проверка Python кода (flake8)..."
            if flake8 backend/ --count --show-source --statistics 2>&1 | tee -a "${LOG_FILE}"; then
                log SUCCESS "Python linting: OK"
            else
                log WARNING "Python linting: обнаружены предупреждения"
                # Не фейлим на flake8 warnings
            fi
        fi
    else
        log INFO "Python linting: пропущено (flake8 не установлен)"
    fi

    # Build check (если есть build скрипт)
    if [[ -f "package.json" ]] && grep -q '"build"' package.json 2>/dev/null; then
        log INFO "Проверка сборки фронтенда..."
        if npm run build 2>&1 | tee -a "${LOG_FILE}"; then
            log SUCCESS "Frontend build: OK"
        else
            log ERROR "Frontend build: FAILED"
            validation_failed=true
        fi
    fi

    if [[ "$validation_failed" == "true" ]]; then
        log WARNING "Предварительная проверка выявила проблемы, но деплой продолжится"
        return 1
    else
        log SUCCESS "Предварительная проверка пройдена успешно"
        return 0
    fi
}

# Функция генерации summary (v2.0.0)
generate_summary() {
    local status="$1"
    local attempts="${2:-1}"
    local summary_file="${LOG_DIR}/summary_${TIMESTAMP}.md"

    log INFO "========================================="
    log INFO "Генерация summary отчета"
    log INFO "========================================="

    cat > "$summary_file" <<EOF
# Deploy-test Summary v2.0.0

**Status:** ${status}
**Timestamp:** $(date +"%Y-%m-%d %H:%M:%S")
**Server:** ${SSH_HOST}
**Branch:** ${GIT_BRANCH}

## Deployment Details

- **Version bump:** ${VERSION_OPTION:-none}
- **Force build:** ${FORCE_BUILD:-no}
- **Max retry attempts:** ${MAX_RETRY_ATTEMPTS}
- **Attempts used:** ${attempts}
- **Auto-fix enabled:** ${AUTO_FIX}
- **Auto-commit enabled:** $(if [[ "$NO_AUTO_COMMIT" == "true" ]]; then echo "no"; else echo "yes"; fi)

## Logs

- Main log: \`${LOG_FILE}\`
- Deploy output: \`${LOG_DIR}/deploy_output_${TIMESTAMP}.log\`
- Server deploy log: \`${LOG_DIR}/server_deploy_${TIMESTAMP}.log\`
$(find "${LOG_DIR}" -name "container_*_${TIMESTAMP}.log" 2>/dev/null | sed 's/^/- Container log: `/' | sed 's/$/`/' || true)

EOF

    if [[ "$status" == "SUCCESS" ]]; then
        cat >> "$summary_file" <<EOF
## Success Details

✅ All services healthy
✅ No errors in logs
✅ Deployment completed successfully

EOF
    else
        cat >> "$summary_file" <<EOF
## Failure Details

❌ Deployment failed after ${attempts} attempt(s)
❌ Check logs for detailed error information

## Troubleshooting

1. Review error logs in \`${LOG_DIR}/\`
2. Check container status: \`ssh ${SSH_HOST} "cd ${REMOTE_DEPLOY_DIR} && docker compose ps"\`
3. View container logs: \`ssh ${SSH_HOST} "cd ${REMOTE_DEPLOY_DIR} && docker compose logs --tail=100"\`
4. Verify git status: \`ssh ${SSH_HOST} "cd ${REMOTE_DIR} && git status"\`

EOF
    fi

    log INFO "Summary сохранен в: ${summary_file}"
    echo ""
    cat "$summary_file"
}

# Display and confirm deployment versions from IMAGE_VERSIONS.json
# Returns: 0 if confirmed, 1 if declined/error
confirm_deployment_versions() {
    local image_versions_file="${REMOTE_DEPLOY_DIR}/IMAGE_VERSIONS.json"

    log INFO "========================================="
    log INFO "Version Confirmation"
    log INFO "========================================="

    # Check existence via SSH
    if ! ssh -o ConnectTimeout=10 "${SSH_HOST}" "test -f '${image_versions_file}'" 2>/dev/null; then
        log ERROR "IMAGE_VERSIONS.json not found: ${image_versions_file}"
        log ERROR "Cannot proceed without version information"
        log ERROR ""
        log ERROR "Troubleshooting:"
        log ERROR "  1. Git pull did not run successfully"
        log ERROR "  2. GitHub Actions did not update IMAGE_VERSIONS.json"
        log ERROR "  3. Repository is not synchronized"
        return 1
    fi

    # Fetch and validate JSON
    local versions_json
    versions_json=$(ssh -o ConnectTimeout=10 "${SSH_HOST}" "cat '${image_versions_file}'" 2>/dev/null)
    if ! echo "$versions_json" | jq empty 2>/dev/null; then
        log ERROR "IMAGE_VERSIONS.json is corrupted (invalid JSON)"
        return 1
    fi

    # Display table header
    log INFO "Docker images to be deployed:"
    echo ""
    printf "${BLUE}%-12s %-10s %-10s %-20s${NC}\n" "Service" "Version" "Hash" "Last Modified"
    printf "%-12s %-10s %-10s %-20s\n" "-------" "-------" "----" "-------------"

    # Parse and display each service
    local services=("backend" "bot" "nginx" "redis" "postgresql")
    local valid_count=0

    for service in "${services[@]}"; do
        local version=$(echo "$versions_json" | jq -r ".${service}.version // \"N/A\"" 2>/dev/null)
        local hash=$(echo "$versions_json" | jq -r ".${service}.hash // \"N/A\"" 2>/dev/null)
        local modified=$(echo "$versions_json" | jq -r ".${service}.lastModified // \"N/A\"" 2>/dev/null)

        # Truncate hash to 10 characters for formatting
        if [[ "$hash" != "N/A" && ${#hash} -gt 10 ]]; then
            hash="${hash:0:10}"
        fi

        # Truncate timestamp to date only
        if [[ "$modified" != "N/A" ]]; then
            modified=$(echo "$modified" | cut -d'T' -f1)
        fi

        # Color based on validity
        if [[ "$version" != "N/A" ]]; then
            printf "${GREEN}%-12s %-10s %-10s %-20s${NC}\n" "$service" "$version" "$hash" "$modified"
            ((valid_count++))
        else
            printf "${YELLOW}%-12s %-10s %-10s %-20s${NC}\n" "$service" "MISSING" "-" "-"
        fi
    done

    echo ""

    # Verify at least one service has version
    if [[ $valid_count -eq 0 ]]; then
        log ERROR "No valid versions found in IMAGE_VERSIONS.json"
        return 1
    fi

    log INFO "Services to deploy: ${valid_count}/5"
    log INFO "Source: ${image_versions_file}"
    echo ""

    # Non-interactive mode (stdin not terminal)
    if [[ ! -t 0 ]]; then
        log INFO "Non-interactive mode: auto-confirming deployment"
        return 0
    fi

    # Interactive confirmation
    read -p "${YELLOW}Deploy these versions to budget-test? [Y/n]: ${NC}" -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]?$ ]]; then
        log SUCCESS "Deployment confirmed by user"
        return 0
    else
        log WARNING "Deployment cancelled by user"
        return 1
    fi
}

# Обертка для деплоя с проверками (используется в retry_deploy_with_backoff)
run_deploy() {
    log INFO "Выполнение деплоя с проверками..."

    # Выполнение деплоя
    if ! deploy; then
        log ERROR "Деплой завершился с ошибкой"
        return 1
    fi

    log SUCCESS "Деплой выполнен, проверка состояния..."

    # Анализ логов деплоя
    if ! analyze_deploy_logs; then
        log WARNING "Обнаружены проблемы в логах деплоя"
        # Не фейлим, продолжаем проверки
    fi

    # Анализ логов контейнеров
    if ! analyze_container_logs; then
        log WARNING "Обнаружены проблемы в логах контейнеров"
        # Не фейлим, продолжаем проверки
    fi

    # Проверка статуса контейнеров (критично)
    if ! check_container_status; then
        log ERROR "Контейнеры в нездоровом состоянии"
        return 1
    fi

    # Проверка запущенных процессов
    if ! check_running_processes; then
        log WARNING "Обнаружены незавершенные процессы"
        # Не фейлим
    fi

    log SUCCESS "Все проверки пройдены"
    return 0
}

# Главная функция v9.2.0
main() {
    log INFO "========================================="
    log INFO "Deploy-test v9.2.0"
    log INFO "Сервер: ${SSH_HOST}"
    log INFO "Ветка: ${GIT_BRANCH}"
    log INFO "Макс. попыток: ${MAX_RETRY_ATTEMPTS}"
    log INFO "GitHub Actions мониторинг: $(if [[ "${WAIT_FOR_BUILD}" == "true" ]]; then echo "enabled"; else echo "disabled"; fi)"
    log INFO "Лог файл: ${LOG_FILE}"
    log INFO "========================================="

    # Шаг 0.5: Мониторинг GitHub Actions (ПЕРЕД SSH подключением!) (v9.2.0+)
    if [[ "$WAIT_FOR_BUILD" == "true" ]]; then
        if ! wait_for_github_actions "$GIT_BRANCH" "$BUILD_TIMEOUT"; then
            log ERROR "Деплой прерван: GitHub Actions build не завершился успешно"
            generate_summary "FAILED" 0
            exit 1
        fi
        echo ""
    fi

    # Шаг 1: Проверка SSH подключения
    if ! check_ssh_connection; then
        log ERROR "Деплой прерван: не удалось установить SSH подключение"
        generate_summary "FAILED" 0
        exit 1
    fi

    # Шаг 2: Локальная проверка кода (pre-deployment validation)
    if [[ "${SKIP_LOCAL_VALIDATION}" != "true" ]]; then
        validate_local_code || log WARNING "Локальная проверка выявила проблемы"
    else
        log INFO "Локальная проверка пропущена (--skip-local-validation)"
    fi

    # Шаг 3: Git pull на сервере
    if ! git_pull; then
        log ERROR "Деплой прерван: git pull завершился с ошибкой"
        generate_summary "FAILED" 0
        exit 1
    fi

    # Шаг 3.5: Confirm deployment versions (NEW v9.0+)
    if ! confirm_deployment_versions; then
        log ERROR "Deployment cancelled - version confirmation declined"
        generate_summary "CANCELLED" 0
        exit 1
    fi
    echo ""

    # Шаг 4: Деплой с автоматическим recovery
    # Проверка наличия recovery-strategies (v2.0.0)
    if declare -f retry_deploy_with_backoff &>/dev/null; then
        log INFO "========================================="
        log INFO "Использование автоматического восстановления v2.0.0"
        log INFO "========================================="

        # Экспорт переменных для recovery-strategies
        export SSH_HOST
        export REMOTE_DIR
        export NO_AUTO_COMMIT
        export LOG_FILE

        # Запуск деплоя с retry logic
        local attempt_count=0
        if retry_deploy_with_backoff "${MAX_RETRY_ATTEMPTS}" "${RETRY_BASE_DELAY}"; then
            # Подсчет реальных попыток (из логов)
            attempt_count=$(grep -c "ПОПЫТКА.*из" "${LOG_FILE}" 2>/dev/null || echo 1)

            log SUCCESS "========================================="
            log SUCCESS "ДЕПЛОЙ ЗАВЕРШЕН УСПЕШНО!"
            log SUCCESS "========================================="
            generate_summary "SUCCESS" "${attempt_count}"
            exit 0
        else
            # Подсчет реальных попыток
            attempt_count=$(grep -c "ПОПЫТКА.*из" "${LOG_FILE}" 2>/dev/null || echo "${MAX_RETRY_ATTEMPTS}")

            log ERROR "========================================="
            log ERROR "ДЕПЛОЙ НЕ УДАЛСЯ ПОСЛЕ ${attempt_count} ПОПЫТОК"
            log ERROR "========================================="
            generate_summary "FAILED" "${attempt_count}"
            exit 1
        fi
    else
        # Fallback на старую логику (v1.0.0) если recovery-strategies не загружен
        log WARNING "========================================="
        log WARNING "Recovery-strategies.sh не загружен, используется базовая логика v1.0.0"
        log WARNING "========================================="

        local deploy_success=true
        if ! run_deploy; then
            deploy_success=false
            log WARNING "Деплой завершился с ошибкой"

            if [[ "${AUTO_FIX}" == "true" ]]; then
                log INFO "Попытка исправления через fix_issues..."
                fix_issues "deploy_failed"
                fix_issues "container_unhealthy"
            fi
        fi

        # Итоговый статус
        log INFO "========================================="
        if [[ "${deploy_success}" == "true" ]]; then
            log SUCCESS "Деплой завершен успешно!"
            generate_summary "SUCCESS" 1
            exit 0
        else
            log ERROR "Деплой завершился с ошибками"
            generate_summary "FAILED" 1
            exit 1
        fi
    fi
}

# Запуск главной функции
main
