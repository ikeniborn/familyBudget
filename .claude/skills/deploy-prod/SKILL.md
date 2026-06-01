---
name: deploy-prod
description: Use when deploying new version to production server (fb.ikeniborn.ru). Covers full pipeline from merged PR to live deployment — git pull on server, registry image pull, smart container restart.
version: 1.0.0
author: Family Budget Team
tags:
  - deployment
  - production
  - docker
  - ci-cd
user-invocable: true
context: fork
---

# Deploy Prod — Production Deployment

Деплой новой версии на прод-сервер `fb.ikeniborn.ru` (194.34.239.2).

---

## Prerequisites

**Обязательно перед деплоем:**
1. PR влит в `prod` ветку на GitHub
2. CI/CD собрал Docker-образы и обновил `IMAGE_VERSIONS.json` (`chore(ci): auto-update IMAGE_VERSIONS.json`)
3. Нет незавершённых миграций БД с breaking changes

Проверить статус PR:
```bash
gh pr view <PR_NUMBER> --json state,mergedAt
```

---

## Deploy Pipeline

### Step 1 — Pull latest code on server

```bash
ssh budget-prod "cd ~/familyBudget && git pull 2>&1"
```

Репозиторий на сервере: `~/familyBudget` (НЕ `/opt/budget` — это deployment dir).

### Step 2 — Deploy

```bash
ssh budget-prod "sudo bash -c 'cd /opt/budget && ./deploy.sh --use-registry --sync-mode mirror --cleanup-mode smart --repo-dir /home/ikeniborn/familyBudget' 2>&1"
```

**Флаги:**

| Флаг | Значение |
|------|----------|
| `--use-registry` | Pull образов из ghcr.io (не собирать локально) |
| `--sync-mode mirror` | rsync с `--delete --checksum` из репо в `/opt/budget` |
| `--cleanup-mode smart` | Анализ изменений → перезапуск только изменившихся сервисов |
| `--repo-dir /home/ikeniborn/familyBudget` | Явный путь к репозиторию (без него — интерактивный запрос) |

`sudo` обязателен — `.env` принадлежит `root` (`-rw------- 1 root root`).

---

## Expected Output

Успешный деплой завершается:
```
✓ backend: healthy
✓ bot: healthy
✓ nginx: healthy
✓ postgres: healthy
✓ redis: healthy

All smoke tests passed!
```

Smart cleanup пересоздаёт только сервисы с изменившимися образами:
- Только backend изменился → только `backend` recreate
- backend + nginx → оба recreate
- PostgreSQL никогда не перезапускается при фронтенд/бэкенд изменениях

---

## Full Example (typical release)

```bash
# 1. Проверить что PR влит
gh pr view 657 --json state,mergedAt

# 2. Обновить репозиторий на сервере
ssh budget-prod "cd ~/familyBudget && git pull 2>&1"

# 3. Задеплоить
ssh budget-prod "sudo bash -c 'cd /opt/budget && ./deploy.sh --use-registry --sync-mode mirror --cleanup-mode smart --repo-dir /home/ikeniborn/familyBudget' 2>&1"
```

Таймаут SSH: 600 секунд (deploy может занять 3–5 минут на pull образов).

---

## Troubleshooting

### `.env` not readable
```
[ERROR] .env file is not readable
```
→ Запускать с `sudo` (см. выше).

### `Unknown option: --profile`
Флаг `--profile` устарел. Использовать `--sync-mode` / `--cleanup-mode`.

### `save_html_templates_checksum: command not found`
Устаревший вызов в старой версии `services.sh`. После синхронизации кода (`--sync-mode mirror`) ошибка исчезает в следующем деплое — функция удалена в коммите `9d00dbcf`.

### Образ не найден в registry
CI/CD не завершил сборку. Дождаться коммита `chore(ci): auto-update IMAGE_VERSIONS.json` в `prod`.

### Версия не обновилась
Проверить, что `git pull` на сервере получил новые коммиты. Если нет — CI ещё не завершил или PR не влит.

---

## Architecture Notes

- **`~/familyBudget`** — git-репозиторий на сервере (source of truth для кода)
- **`/opt/budget`** — deployment dir (rsync target, не git repo)
- **`IMAGE_VERSIONS.json`** — per-service версии образов (обновляется CI автоматически)
- **Профиль `full`** — автоопределяется из `.env` (`DEPLOYMENT_PROFILE=full`) → postgres + backend + bot + nginx + certbot
- **Safety backup** — создаётся перед каждым деплоем: `safety_backup_pre_start_<timestamp>.sql.gz`
