# Auto-Cleanup Orphaned Deployment Processes

**Version:** 5.3.1
**Date:** 2025-12-24
**Type:** Feature Enhancement

## Problem

При неудачных деплоях или прерывании deploy.sh оставались "зомби" процессы:
- `bash deploy.sh` (состояние: Stopped/T+)
- `sudo bash deploy.sh`
- `alembic` (database migrations)
- `npm install/update`
- `rsync` (file synchronization)
- `git pull/fetch`

Эти процессы накапливались и требовали ручной очистки через `kill -9`.

**Пример обнаруженной проблемы** (budget-test, 2025-12-24):
```bash
root     1631618       1  0 Dec22 ?        00:00:00 sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch
root     1631619 1631618  0 Dec22 pts/1    00:00:00 sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch
root     1631620 1631619  0 Dec22 pts/1    00:00:00 bash deploy.sh --sync-mode update --cleanup-mode smart --patch
```

## Solution

Добавлена автоматическая очистка orphaned процессов при запуске deploy.sh:

### 1. Улучшена функция `check_orphaned_deployment_processes()` в `scripts/lib/utils.sh`

**Новые паттерны поиска:**
```bash
"sudo bash.*setup\.sh\|sudo bash.*deploy\.sh"
```

**Безопасность - исключение текущего процесса:**
```bash
# Exclude current deploy process and its parent chain
if [[ -n "${BASHPID:-}" ]]; then
    filtered_list=$(echo "$filtered_list" | grep -v -E "\\b${BASHPID}\\b" || true)
fi
if [[ -n "${PPID:-}" ]]; then
    filtered_list=$(echo "$filtered_list" | grep -v -E "\\b${PPID}\\b" || true)
fi
# Also exclude current shell's PID
filtered_list=$(echo "$filtered_list" | grep -v -E "\\b$$\\b" || true)
```

### 2. Добавлен автоматический вызов в `deploy.sh`

```bash
# Clean up orphaned deployment processes from previous failed deployments
# This runs automatically and terminates stuck processes (alembic, npm, rsync, etc.)
check_orphaned_deployment_processes --terminate || true
```

**Расположение:** Сразу после вывода заголовка, до validate_firewall_rules.

## Detected Process Types

Функция автоматически находит и убивает:

| Процесс | Паттерн | Описание |
|---------|---------|----------|
| Alembic | `alembic` | Database migrations |
| NPM | `npm install\|npm update\|npm ci` | Package installation |
| NPX | `npx` | Package execution |
| Pip | `pip install\|pip3 install` | Python packages |
| Git | `git clone\|git pull\|git fetch` | Repository operations |
| Rsync | `rsync.*familyBudget\|rsync.*budget` | File synchronization |
| Python scripts | `python.*setup\.sh\|python.*deploy\.sh` | Deployment scripts |
| Bash scripts | `bash.*setup\.sh\|bash.*deploy\.sh` | Deployment scripts |
| Sudo scripts | `sudo bash.*setup\.sh\|sudo bash.*deploy\.sh` | Root deployment scripts |

## Excluded Process Types

НЕ затрагиваются (legitimate service processes):

| Процесс | Паттерн | Описание |
|---------|---------|----------|
| Docker | `docker` | Docker daemon |
| Containerd | `containerd` | Container runtime |
| Backend | `uvicorn.*backend\.app\.main` | FastAPI workers |
| Bot | `python -m bot\.main` | Telegram bot |
| PostgreSQL | `postgres:` | Database server |
| Nginx | `nginx:` | Web server |
| Workers | `multiprocessing\.spawn` | Uvicorn workers |
| Current process | `${BASHPID}`, `${PPID}`, `$$` | Running deploy.sh |

## Cleanup Process

1. **SIGTERM** отправляется процессу (graceful shutdown)
2. **Wait 1 second**
3. **SIGKILL** если процесс всё ещё жив (forced termination)

```bash
kill -TERM "$pid" 2>/dev/null || true
sleep 1
if kill -0 "$pid" 2>/dev/null; then
    warning "Process $pid did not terminate gracefully, forcing..."
    kill -KILL "$pid" 2>/dev/null || true
fi
```

## Testing

### Ручное тестирование

```bash
# 1. Проверить наличие orphaned процессов
sudo bash scripts/lib/utils.sh
source scripts/lib/config.sh
source scripts/lib/utils.sh
check_orphaned_deployment_processes

# 2. Убить orphaned процессы
check_orphaned_deployment_processes --terminate

# 3. Автоматическая очистка при деплое
sudo bash deploy.sh --sync-mode update --cleanup-mode smart
```

### Результат на budget-test (2025-12-24)

**До изменений:**
```
root     1631618  sudo bash deploy.sh  (Stopped/T+)
root     1631619  sudo bash deploy.sh  (Stopped/T+)
root     1631620  bash deploy.sh       (Stopped/T+)
```

**После изменений:**
```
✓ All orphaned processes terminated
✓ No deploy processes remain
```

## Benefits

✅ **Автоматизация** - нет необходимости в ручной очистке
✅ **Безопасность** - текущий процесс деплоя защищён от убийства
✅ **Надёжность** - graceful shutdown с fallback на force kill
✅ **Прозрачность** - логирование всех найденных и убитых процессов
✅ **Производительность** - предотвращает накопление зомби-процессов

## Migration Guide

Никаких действий не требуется - функция работает автоматически при каждом запуске deploy.sh.

## Related

- Issue: Orphaned deploy processes accumulation
- Commit: `2d31c61d` - feat(deploy): auto-cleanup orphaned deployment processes on startup
- Files: `deploy.sh`, `scripts/lib/utils.sh`

## Future Improvements

1. **Metrics** - собирать статистику по количеству убитых процессов
2. **Notifications** - уведомлять если найдено > 5 orphaned процессов (possible system issue)
3. **Age-based cleanup** - убивать только процессы старше N минут
4. **Process tree cleanup** - убивать весь process tree, а не только parent process
