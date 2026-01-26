## 10. Deployment & Operations

### 10.1 Infrastructure Requirements

**VPS Specifications:**
- **CPU:** 2+ cores
- **RAM:** 4+ GB
- **Disk:** 50 GB SSD
- **OS:** Ubuntu 20.04+ / Debian 11+
- **Network:** Стабильное интернет-соединение

**Prerequisites:**
- Sudo access
- Internet connectivity
- Domain name (опционально для SSL)

### 10.2 Docker Compose Configuration

*См. полную конфигурацию в разделе 3.5*

**Conditional Port Mapping для PostgreSQL:**

```yaml
services:
  postgres:
    ports:
      - "5432:5432"  # Exposed but access controlled by UFW firewall
```

**Логика безопасности:**
- Порт 5432 всегда exposed на хосте в docker-compose.yml
- По умолчанию UFW firewall блокирует все внешние подключения
- setup.sh добавляет UFW правило только при `POSTGRES_EXTERNAL_ACCESS=true`
- Нет необходимости пересоздавать контейнеры при изменении доступа

### 10.3 Deployment Scripts

#### install.sh (~100 lines)

```bash
#!/bin/bash
set -e

echo "=== FamilyBudget Installation Script ==="

# Проверка OS
if ! lsb_release -i | grep -qE "Ubuntu|Debian"; then
  echo "Error: Only Ubuntu 20.04+ and Debian 11+ are supported"
  exit 1
fi

# Проверка sudo
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run with sudo"
  exit 1
fi

# Установка Docker
echo "Installing Docker..."
apt-get update
apt-get install -y \
    docker.io \
    docker-compose-plugin \
    postgresql-client \
    curl \
    jq

systemctl enable docker
systemctl start docker

# Установка UFW
echo "Setting up UFW..."
apt-get install -y ufw
ufw allow 22
ufw allow 80
ufw allow 443
# PostgreSQL будет настроен в setup.sh

echo "✅ Installation complete!"
```

#### setup.sh (~150 lines)

```bash
#!/bin/bash
set -e

echo "=== FamilyBudget Setup Script ==="

# Интерактивный ввод параметров
read -p "Telegram Bot Token: " BOT_TOKEN
read -sp "PostgreSQL Password: " POSTGRES_PASSWORD
echo
read -p "Admin Telegram ID: " ADMIN_ID
read -p "JWT Secret Key (leave empty to generate): " JWT_SECRET

if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  echo "Generated JWT Secret: $JWT_SECRET"
fi

# PostgreSQL External Access (CRITICAL RISK-007)
read -p "Нужен ли внешний доступ к БД? (y/n): " EXTERNAL_ACCESS

if [ "$EXTERNAL_ACCESS" = "y" ]; then
  read -p "IP адрес для доступа к PostgreSQL: " ALLOWED_IP
  
  # Валидация IP
  if ! [[ $ALLOWED_IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Invalid IP address"
    exit 1
  fi
  
  # UFW правило с IP restriction (НЕ просто allow 5432)
  # Порт 5432 уже exposed в docker-compose.yml, просто разрешаем доступ с IP
  ufw allow from $ALLOWED_IP to any port 5432 comment "PostgreSQL external access"
  echo "✅ PostgreSQL external access enabled for $ALLOWED_IP"
  echo "   Port 5432 exposed + UFW allows $ALLOWED_IP"

  POSTGRES_EXTERNAL_ACCESS=true
else
  echo "✅ PostgreSQL access blocked by UFW"
  echo "   Port 5432 exposed but firewall blocks all external connections"
  POSTGRES_EXTERNAL_ACCESS=false
  ALLOWED_IP=""
fi

# Генерация .env файла
cat > .env << EOF
# Telegram
TELEGRAM_BOT_TOKEN=$BOT_TOKEN

# JWT
JWT_SECRET_KEY=$JWT_SECRET
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=7

# PostgreSQL
POSTGRES_USER=familybudget
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=familybudget
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Admin
ADMIN_TELEGRAM_ID=$ADMIN_ID

# PostgreSQL External Access
POSTGRES_EXTERNAL_ACCESS=$POSTGRES_EXTERNAL_ACCESS
POSTGRES_ALLOWED_IP=$ALLOWED_IP

# S3 (опционально)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
S3_ENDPOINT_URL=https://storage.yandexcloud.net
EOF

echo "✅ Configuration saved to .env"

# S3 credentials (опционально)
read -p "Настроить S3 для бэкапов? (y/n): " SETUP_S3
if [ "$SETUP_S3" = "y" ]; then
  read -p "AWS Access Key ID: " AWS_KEY
  read -sp "AWS Secret Access Key: " AWS_SECRET
  echo
  read -p "S3 Bucket Name: " S3_BUCKET
  
  sed -i "s|AWS_ACCESS_KEY_ID=|AWS_ACCESS_KEY_ID=$AWS_KEY|" .env
  sed -i "s|AWS_SECRET_ACCESS_KEY=|AWS_SECRET_ACCESS_KEY=$AWS_SECRET|" .env
  sed -i "s|S3_BUCKET_NAME=|S3_BUCKET_NAME=$S3_BUCKET|" .env
  
  echo "✅ S3 configured"
fi

echo "✅ Setup complete!"
echo "Next step: Run ./scripts/deploy.sh"
```

#### deploy.sh (~430 lines, модульная архитектура)

**ВАЖНО:** Фактический deploy.sh значительно расширен и использует модульную архитектуру с библиотеками из `scripts/lib/`.

**Основные этапы deployment:**

```bash
#!/bin/bash
set -e

echo "=== FamilyBudget Deployment ==="

# 1. Prerequisites Check
check_prerequisites_early  # Docker, .env validation

# 2. Code Synchronization
sync_code_to_deploy  # Repository → /opt/budget

# 3. Static Assets Optimization (NEW in v5.0.0)
cd /opt/budget

# Validate npm isolated environment (created by install.sh)
# Check critical packages: terser, cssnano-cli, tailwindcss
if ! bash scripts/lib/check_npm_env.sh "$PWD"; then
  echo "❌ npm environment validation failed"
  echo "Fix: cd ~/familyBudget && sudo ./install.sh"
  exit 1
fi

# Run minification (Terser for JS, cssnano for CSS)
# Uses isolated environment: .npm-isolated/node_modules
if npm run build 2>&1; then
  echo "✅ Static assets minified successfully"
else
  echo "⚠️  Minification failed, continuing with unminified assets"
fi

# 4. Cache Busting (supports .min.js, .min.css, /shared/)
run_cache_busting "auto" "/opt/budget"

# 5. Docker Compose
echo "Starting services..."
docker compose up -d --build

# 6. Health checks
echo "Waiting for services to start..."
wait_for_services  # Backend, PostgreSQL, Nginx

# 7. Database Migrations
run_migrations

# 8. SSL Setup (for full profile)
setup_ssl_certificates

echo "✅ Deployment successful!"

# Вывод информации
echo ""
echo "=== Access Information ==="
echo "Web Interface: https://$(hostname -I | awk '{print $1}')"
echo "API Docs: http://$(hostname -I | awk '{print $1}'):8000/docs"
echo ""
echo "View logs: docker compose logs -f"
```

**Ключевые особенности:**

- **Модульная архитектура**: Функции загружаются из `scripts/lib/*.sh`
- **Smart Cleanup v2**: Интеллектуальная категоризация изменений (см. 10.3.5)
- **Production Minification**: Автоматическая минификация JS/CSS (см. 10.7.5)
- **Cache Busting**: Query string versioning для статических файлов
- **Health Checks**: Ожидание готовности всех сервисов перед продолжением
- **Error Handling**: Graceful degradation при ошибках минификации

#### backup.sh (~80 lines)

```bash
#!/bin/bash
set -e

# Загрузка .env
source .env

BACKUP_DIR="/backups"
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql.gz"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"

echo "=== Starting PostgreSQL Backup ==="

# pg_dump
docker compose exec -T postgres pg_dump \
  -U $POSTGRES_USER \
  -d $POSTGRES_DB \
  | gzip > "$BACKUP_PATH"

if [ $? -eq 0 ]; then
  echo "✅ Backup saved: $BACKUP_PATH"
else
  echo "❌ Backup failed"
  exit 1
fi

# Ротация (7 дней)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
echo "✅ Old backups cleaned (retention: 7 days)"

# Еженедельная загрузка в S3
if [ $(date +%u) -eq 7 ] && [ -n "$AWS_ACCESS_KEY_ID" ]; then
  echo "Uploading to S3..."
  aws s3 cp "$BACKUP_PATH" \
    "s3://$S3_BUCKET_NAME/postgresql-backups/$(date +%Y/%m)/$BACKUP_FILE" \
    --endpoint-url "$S3_ENDPOINT_URL"
  
  if [ $? -eq 0 ]; then
    echo "✅ Uploaded to S3"
  else
    echo "⚠️ S3 upload failed (backup still saved locally)"
  fi
fi

echo "=== Backup Complete ==="
```

#### 10.3.5 Smart Cleanup v2: File Categorization Logic

**Назначение:**
Smart Cleanup v2 анализирует измененные файлы и автоматически определяет:
- Какие сервисы требуют перезапуска
- Какие Docker образы требуют пересборки
- Оценку downtime

**Категории файлов:**

| Паттерн файла | Категория | Backend rebuild | Backend restart | Nginx restart | Postgres restart |
|---------------|-----------|----------------|-----------------|---------------|-----------------|
| `backend/db/schema/*.sql` | postgres-critical | Нет | Нет | Нет | Да |
| `backend/requirements.txt` | backend-deps | Да | Да | Нет | Нет |
| `backend/Dockerfile` | backend-deps | Да | Да | Нет | Нет |
| `backend/app/**/*.py` | backend-code | Нет* | Да | Нет | Нет |
| `web/templates/*.html` | backend-code | Нет* | Да | Нет | Нет |
| `web/static/*` | nginx-config | Нет | Нет | Да | Нет |
| `webapp/*.html` | webapp | Нет* | Нет | Нет | Нет |
| `shared/static/**/*` | shared-assets | Нет* | Нет | Нет | Нет |
| `package.json` | build-deps | Нет | Нет | Нет | Нет |
| `scripts/lib/minify.sh` | build-deps | Нет | Нет | Нет | Нет |
| `bot/requirements.txt` | bot-deps | Нет | Нет | Нет | Нет |
| `bot/**/*.py` | bot-code | Нет | Да | Нет | Нет |
| `nginx/conf.d/*.conf` | nginx-config | Нет | Нет | Да | Нет |
| `docker-compose.yml` | postgres-critical | Нет | Нет | Нет | Да |

*\*Примечание:* Backend rebuild НЕ требуется благодаря volume mounts в docker-compose.yml:
```yaml
volumes:
  - ./backend:/app/backend:ro      # Python код
  - ./web:/app/web:ro              # Templates + static
  - ./webapp:/app/webapp:ro        # Telegram Web Apps
```

**Volume Mounts vs Dockerfile COPY:**

```
Repository           Dockerfile COPY          Runtime (volume mount)
backend/app/     →   COPY backend/        →   ./backend:/app/backend:ro
web/templates/   →   COPY web/            →   ./web:/app/web:ro
webapp/          →   COPY webapp/         →   ./webapp:/app/webapp:ro
```

**Важно:** Volume mounts **ПЕРЕОПРЕДЕЛЯЮТ** Dockerfile COPY в runtime. Поэтому:
- Изменения Python кода применяются немедленно через volume
- Требуется только перезапуск сервиса (для очистки cache)
- НЕ требуется пересборка Docker образа

**Исключение:** Docker может пересобрать образ если build context изменился, даже когда Smart Cleanup сообщает "Images to rebuild: 0". Это нормальное поведение - volume mounts все равно переопределят встроенные файлы.

**Примеры сценариев:**

**Сценарий 1: Изменены только webapp/*.html**
```bash
Changed files: webapp/add.html, webapp/edit.html

Change analysis:
  ✓ webapp (2 files)

Strategy summary:
  • PostgreSQL: keep running ✓
  • Services to restart: 0
  • Images to rebuild: 0

NOTE: Docker may still rebuild images if build context changed
      (Dockerfile COPY includes volume-mounted directories)
      This is normal - volume mounts will override built-in files
```
**Результат:** Изменения применяются немедленно через volume mount, перезапуск НЕ требуется.

**Сценарий 2: Изменены web/templates/*.html**
```bash
Changed files: web/templates/index.html, web/templates/facts.html

Change analysis:
  ✓ backend-code (2 files)

Strategy summary:
  • PostgreSQL: keep running ✓
  • Services to restart: 1
    → backend
  • Images to rebuild: 0
```
**Результат:** Backend перезапускается для очистки Jinja2 cache, изменения применяются.

**Сценарий 3: Изменены backend/app/*.py**
```bash
Changed files: backend/app/api/v1/endpoints/facts.py

Change analysis:
  ✓ backend-code (1 file)

Strategy summary:
  • PostgreSQL: keep running ✓
  • Services to restart: 1
    → backend
  • Images to rebuild: 0
```
**Результат:** Backend перезапускается, Python код обновляется через volume mount.

**Сценарий 4: Изменен backend/requirements.txt**
```bash
Changed files: backend/requirements.txt

Change analysis:
  ✓ backend-deps (1 file)

Strategy summary:
  • PostgreSQL: keep running ✓
  • Services to restart: 1
    → backend
  • Images to rebuild: 1
    → backend
```
**Результат:** Backend образ пересобирается (pip install новых зависимостей), контейнер пересоздается.

**Сценарий 5: Изменен файл схемы БД**
```bash
Changed files: backend/db/schema/006_notifications.sql

Change analysis:
  ✓ postgres-critical (1 file)

Strategy summary:
  • PostgreSQL: will restart
  • Services to restart: 4
    → postgres, backend, bot, nginx
  • Images to rebuild: 0
  • Estimated downtime: ~30s
```
**Результат:** PostgreSQL перезапускается, миграция применяется, все зависимые сервисы перезапускаются.

**Debugging категоризации:**

Если Smart Cleanup неправильно категоризирует файлы:

1. **Проверить паттерн** в `scripts/lib/docker.sh`, функция `categorize_file_changes()`:
```bash
case "$file" in
    webapp/*)
        ((count_webapp++))
        ;;
esac
```

2. **Проверить счетчики** в выводе:
```bash
echo "count_webapp=$count_webapp"
```

3. **Проверить отчет** в `cleanup_containers_networks_v2()`:
```bash
[[ $count_webapp -gt 0 ]] && categories_found+=("webapp ($count_webapp files)")
```

#### 10.3.6 Registry-First Architecture (v9.0+)

**Версия:** 9.0.0 (обновлено 2026-01-26)

**Статус:** ⚠️ **Раздел "npm Isolated Environment Protection" OBSOLETE в v9.0**

**Назначение:**
В v9.0 deployment полностью перешел на **registry-first mode**: все сборки (frontend, Docker images) выполняются в GitHub Actions CI/CD. Production сервер только **pull готовые образы** из GitHub Container Registry (ghcr.io).

**Архитектура v9.0 (Registry-First):**

```
GitHub Actions CI/CD                     Production Server (/opt/budget)
┌─────────────────────┐
│ 1. git push         │                  ┌───────────────────────────┐
│ 2. Build triggered  │                  │ Deployment Process:       │
│                     │                  │                           │
│ ┌─────────────────┐ │                  │ 1. git pull (config only)│
│ │ Frontend Build  │ │                  │    └─ docker-compose.yml │
│ │ - npm ci        │ │                  │    └─ .env, VERSION      │
│ │ - npm run build │ │                  │    └─ migrations/        │
│ │ - Minification  │ │                  │                           │
│ └─────────────────┘ │                  │ 2. docker compose pull   │
│                     │                  │    ↓                      │
│ ┌─────────────────┐ │    ghcr.io      │    Pull ready images:     │
│ │ Docker Build    │─┼───────────────▶ │    - backend:10.0.51      │
│ │ - 5 images      │ │    (registry)   │    - nginx:10.0.51        │
│ │ - Multi-stage   │ │                  │    - bot:10.0.51          │
│ │ - Push to reg.  │ │                  │    - redis:10.0.51        │
│ └─────────────────┘ │                  │    - postgresql:10.0.51   │
│                     │                  │                           │
│ Time: 5-7 min       │                  │ 3. docker compose up      │
└─────────────────────┘                  │                           │
                                         │ Time: 2-3 min             │
                                         └───────────────────────────┘
```

**Что УДАЛЕНО в v9.0 (НЕ требуется на сервере):**

❌ **npm/Node.js:**
- `.npm-isolated/` directory (233 packages, ~200MB)
- npm install/ci commands
- node_modules/ on server
- package.json, package-lock.json processing

❌ **Frontend Build:**
- npm run build:prod
- Minification (Terser, PostCSS)
- Cache busting scripts
- Frontend validation

❌ **Docker Build:**
- docker compose build
- Multi-stage Dockerfile processing
- Image layer caching on server
- Build context transfer

❌ **Host-based Nginx Config:**
- nginx/conf.d/*.conf generation on server
- select_nginx_config() function
- generate_nginx_https_config() function
- Host-based template processing

**Что ДОБАВЛЕНО в v9.0:**

✅ **Registry Integration:**
- IMAGE_VERSIONS.json (версии всех 5 образов)
- pull_from_registry() function
- Image validation
- Automatic cleanup (7 days retention)

✅ **Embedded Configuration:**
- Frontend embedded in backend image
- Nginx config embedded in nginx image
- Dependencies embedded in all images
- docker-entrypoint.sh processing (runtime)

**Workflow v9.0:**

```
Deployment Process (Registry-First):
┌──────────────────────────────────────────────────────────────┐
│ 1. VERSION BUMP (developer)                                  │
│    echo "10.0.51" > VERSION                                  │
│    git commit -m "chore: bump version to 10.0.51"            │
│    git push origin main                                       │
│                                                              │
│ 2. CI/CD BUILD (GitHub Actions, 5-7 min)                    │
│    ├─ Frontend build (npm run build:prod)                   │
│    ├─ Docker build (5 images)                               │
│    ├─ Push to ghcr.io/ikeniborn/familybudget-*:10.0.51      │
│    └─ Generate IMAGE_VERSIONS.json                          │
│                                                              │
│ 3. SERVER DEPLOYMENT (2-3 min)                              │
│    ├─ git pull (sync IMAGE_VERSIONS.json, config files)     │
│    ├─ docker compose pull (5 images from ghcr.io)           │
│    ├─ docker compose up (restart containers)                │
│    └─ migrations (alembic upgrade head)                     │
└──────────────────────────────────────────────────────────────┘
```

**Что СИНХРОНИЗИРУЕТСЯ на сервер (rsync):**

✅ **Configuration Files:**
- `docker-compose.yml` - service definitions
- `.env` - environment variables (protected)
- `VERSION` - version for image pull
- `IMAGE_VERSIONS.json` - per-service versions

✅ **Database Migrations:**
- `backend/db/migrations/versions/*.py`
- Миграции НЕ в Docker образах (часто меняются)

✅ **Deployment Scripts:**
- `scripts/lib/*.sh` - используются сервером
- `deploy.sh` - deployment orchestrator

✅ **Nginx Templates (для CI/CD):**
- `nginx/conf.d/*.template` - для пересборки образа
- Обрабатываются entrypoint.sh ВНУТРИ контейнера

✅ **Protected State:**
- `.migration_checksums` - MD5 для change detection
- `.docker_build_checksums` - MD5 для rebuild detection

**Что EMBEDDED в Docker образы (НЕ синхронизируется):**

🐳 **Backend Image:**
- Frontend код + assets (embedded)
- Python dependencies
- Application code

🐳 **Nginx Image:**
- Конфигурация (templates)
- docker-entrypoint.sh (SSL auto-detection)

🐳 **Bot, Redis, PostgreSQL Images:**
- Respective code and configs

**Преимущества v9.0 Registry-First:**

1. **Faster deploys:** 2-3 min (было 5-7 min)
2. **Lower server CPU:** pull only (было: npm build + Docker build)
3. **Lower server RAM:** ~500MB (было ~2GB during build)
4. **Simpler server:** только Docker (было: Docker + Node.js + npm)
5. **Consistent builds:** CI/CD гарантирует одинаковые образы
6. **Faster rollback:** `docker compose pull <old-version>`

**Troubleshooting v9.0:**

| Проблема | Диагностика | Решение |
|----------|-------------|---------|
| "npm: command not found" | ✅ Expected в v9.0! | Это нормально, npm не требуется |
| IMAGE_VERSIONS.json not found | `ls IMAGE_VERSIONS.json` | `git pull` для синхронизации |
| Image not found in registry | Check GitHub Actions | Wait for build, re-trigger if failed |
| Nginx config не обновляется | Edit на сервере НЕ работает! | Edit nginx/conf.d/*.template в git, commit, wait for CI/CD rebuild |

**Verification v9.0:**

```bash
# Проверка что npm НЕ требуется:
which npm
# Expected: (no output)

# Проверка Docker образов:
docker images | grep familybudget
# Expected: ghcr.io/ikeniborn/familybudget-* с актуальными версиями

# Проверка IMAGE_VERSIONS.json:
cat /opt/budget/IMAGE_VERSIONS.json | jq .
# Expected: версии всех 5 сервисов

# Проверка deployment logs:
grep "Pulling Docker images" /opt/budget/logs/deploy.log
# Expected: Pull from ghcr.io (НЕ local build)
```

**История изменений:**

- **2026-01-26 (v9.0):** Complete migration to registry-first mode
  - Removed: npm environment, local builds, host-based nginx config
  - Added: IMAGE_VERSIONS.json, registry integration, embedded configs
- **2025-11-08 (v8.x):** npm isolated environment protection (obsolete)
- **2025-11-08 (v8.x):** rsync --filter='protect' for .npm-isolated/ (obsolete)

---

#### 10.3.7 Migration Change Detection & Auto-Reapply System

**Версия:** 5.1.0 (добавлено 2025-11-12)

**Назначение:**
Автоматическое обнаружение и обработка изменений в примененных Alembic миграциях через механизм downgrade/upgrade.

**Проблема:**

Alembic отслеживает примененные миграции только по revision ID в таблице `alembic_version`. Если содержимое файла миграции изменяется ПОСЛЕ применения:

```
Изменение файла:
backend/db/migrations/versions/20251112_b2232d851007_add_function.py
  ├─ Revision ID: b2232d851007 (не изменился)
  ├─ Содержимое: ИЗМЕНЕНО (добавлен JOIN, исправлен SQL)
  └─ Результат: Alembic НЕ обнаруживает изменение!

Проблема:
  alembic_version: b2232d851007 ✓ (уже применена)
  Alembic: "Database up to date" (но файл изменился!)
  Функция в БД: СТАРАЯ версия с багом
```

**Решение:**

Система отслеживания изменений через MD5 checksums:

```
Deployment Process:
┌─────────────────────────────────────────────────────────────┐
│ 1. Загрузка предыдущих checksums                            │
│    /opt/budget/.migration_checksums (persistent)            │
│                                                              │
│ 2. Вычисление текущих checksums                             │
│    md5sum backend/db/migrations/versions/*.py               │
│                                                              │
│ 3. Сравнение (detect_changed_migrations)                   │
│    comm -13 <previous> <current>                            │
│    → список измененных файлов                               │
│                                                              │
│ 4a. Auto-reapply (если enabled + dev/staging)              │
│     FOR EACH changed migration:                             │
│       alembic downgrade -1                                  │
│       alembic upgrade head                                  │
│                                                              │
│ 4b. Manual reapply (production)                             │
│     WARNING: Changed migrations detected                    │
│     Use: --reapply-migration <revision>                     │
│                                                              │
│ 5. Сохранение новых checksums                               │
│    echo "$checksums" > .migration_checksums                 │
└─────────────────────────────────────────────────────────────┘
```

**Компоненты:**

**1. scripts/lib/migration_tracker.sh** (новый модуль, 338 строк):

```bash
# Ключевые функции:
calculate_migration_checksums()     # MD5 для всех .py файлов
detect_changed_migrations()         # Сравнение previous vs current
reapply_single_migration()          # Downgrade → Upgrade для одной миграции
reapply_changed_migrations()        # Reapply всех измененных с confirmation
manual_reapply_migration()          # Ручной reapply с подтверждением
check_and_reapply_migrations()      # Главная функция (public API)

# Checksum file location:
MIGRATION_CHECKSUMS_FILE="/opt/budget/.migration_checksums"

# Auto-reapply: ВСЕГДА enabled (2025-11-12)
# - Production: requires 'REAPPLY' typed confirmation
# - Staging: requires y/N confirmation
# - Development: auto-applies without confirmation
```

**2. scripts/lib/migrations.sh** (обновлён):

```bash
run_alembic_migrations() {
    # Handle manual reapply flag (--reapply-migration <revision>)
    if [[ "$REAPPLY_MIGRATION" == "true" && -n "$REAPPLY_MIGRATION_FILE" ]]; then
        manual_reapply_migration "$REAPPLY_MIGRATION_FILE"
        return $?
    fi

    # ALWAYS check for changed migrations (detection)
    # Will show WARNING if changes detected, and reapply with confirmation
    check_and_reapply_migrations "$DEPLOY_DIR/backend/db/migrations"

    # Normal migration flow...
    alembic upgrade head

    # Save checksums after successful migration
    save_migration_checksums "$DEPLOY_DIR/backend/db/migrations"
}
```

**3. deploy.sh** (обновлён):

```bash
# Line 90: Load new module
source "$SCRIPT_DIR/scripts/lib/migration_tracker.sh"

# Lines 129-132: New variables
REAPPLY_MIGRATION=false              # Manual reapply flag
REAPPLY_MIGRATION_FILE=""            # Revision ID (e.g., "b2232d851007")

# Argument parsing:
--reapply-migration)
    REAPPLY_MIGRATION=true
    REAPPLY_MIGRATION_FILE="$2"
    shift 2
    ;;
```

**Usage Examples:**

**Manual Reapply (production):**
```bash
# Ручной reapply конкретной миграции
cd ~/familyBudget
./deploy.sh --reapply-migration b2232d851007

# Процесс:
# 1. Downgrade: alembic downgrade -1
# 2. Upgrade: alembic upgrade head
# 3. Production: требует ввода "REAPPLY" для подтверждения

# Output:
⚠️  MANUAL REAPPLY REQUESTED
This will downgrade and upgrade migration: b2232d851007

Type 'REAPPLY' to confirm manual reapply on production: REAPPLY

Step 1/2: Downgrading migration b2232d851007...
✅ Downgrade completed

Step 2/2: Upgrading migration b2232d851007...
✅ Upgrade completed
✅ Migration b2232d851007 reapplied successfully
```

**Auto-Reapply (all environments):**
```bash
# Auto-reapply ВСЕГДА включен при обнаружении изменений
cd ~/familyBudget
sudo bash deploy.sh

# Процесс:
# 1. Загрузить previous checksums из /opt/budget/.migration_checksums
# 2. Вычислить current checksums из новых файлов
# 3. Обнаружить изменения (comm -13 для сравнения MD5)
# 4. Показать список измененных миграций
# 5. Запросить подтверждение (production/staging) или применить (dev)
# 6. Reapply измененных миграций (downgrade -1 → upgrade head)
# 7. Сохранить новые checksums

# Output (Production):
Checking for changed migrations...
⚠️  Detected changed migration files:
  - 20251112_d1b4c09aa285_fix_recalculate_recommended_amounts_.py (revision: d1b4c09aa285)

⚠️  Migration changes will be automatically reapplied
This will execute downgrade() then upgrade() for each migration

Migrations to be reapplied:
  - 20251112_d1b4c09aa285_fix_recalculate_recommended_amounts_.py (revision: d1b4c09aa285)

⚠️  PRODUCTION ENVIRONMENT - Extra confirmation required
Type 'REAPPLY' to confirm (all caps): REAPPLY

Reapplying migration: d1b4c09aa285

Step 1/2: Downgrading migration d1b4c09aa285...
✅ Downgrade completed

Step 2/2: Upgrading migration d1b4c09aa285...
✅ Upgrade completed

✅ All changed migrations reapplied successfully
Saving migration checksums for change tracking...
✅ Migration checksums saved to /opt/budget/.migration_checksums
```

**Normal Deploy (no changes detected):**
```bash
cd ~/familyBudget
./deploy.sh --profile full

# Output:
Checking for changed migrations...
✅ No changed migrations detected
Saving migration checksums for change tracking...
✅ Migration checksums saved
```

**Safety Features:**

| Environment | Auto-Reapply Behavior | Manual Reapply | Confirmation Required? |
|-------------|----------------------|----------------|------------------------|
| **Production** | ✅ Enabled | ✅ Allowed | ✅ YES (type "REAPPLY") |
| **Staging** | ✅ Enabled | ✅ Allowed | ✅ YES (y/n prompt) |
| **Development** | ✅ Enabled | ✅ Allowed | ❌ NO (auto) |

**Behavior Changed (2025-11-12):**
- **OLD:** Auto-reapply disabled by default, required `AUTO_REAPPLY_MIGRATIONS=true` flag
- **NEW:** Auto-reapply ALWAYS enabled when changes detected
- **Safety:** Production requires explicit 'REAPPLY' confirmation, Staging requires y/N confirmation
- **Development:** Applies automatically without confirmation (for rapid iteration)

**Production Manual Reapply:**
```bash
manual_reapply_migration() {
    local revision="$1"

    # Safety confirmation on production
    if [[ "${ENVIRONMENT:-}" == "production" ]]; then
        error "PRODUCTION ENVIRONMENT DETECTED"
        warning "Manual reapply may cause data loss if downgrade() drops data"
        echo ""
        read -p "Type 'REAPPLY' to confirm manual reapply on production: " confirm

        if [[ "$confirm" != "REAPPLY" ]]; then
            error "Manual reapply cancelled"
            return 1
        fi
    fi

    # Perform reapply
    reapply_single_migration "$revision"
}
```

**Checksum File Format:**

```bash
# /opt/budget/.migration_checksums
# Format: md5sum filename

a1b2c3d4e5f6... /opt/budget/backend/db/migrations/versions/20251112_b2232d851007_add_function.py
f7e8d9c0b1a2... /opt/budget/backend/db/migrations/versions/20251112_d1b4c09aa285_fix_function.py
...
```

**Change Detection Algorithm:**

```bash
detect_changed_migrations() {
    local migrations_dir="$1"
    local previous_checksums="$2"
    local current_checksums

    # Calculate current checksums
    current_checksums=$(calculate_migration_checksums "$migrations_dir")

    # Compare checksums and extract changed files
    # comm -13: lines only in file2 (new/changed checksums)
    local changed_files
    changed_files=$(comm -13 \
        <(echo "$previous_checksums" | sort) \
        <(echo "$current_checksums" | sort) \
        2>/dev/null | awk '{print $2}')

    echo "$changed_files"
}
```

**Сценарии использования:**

**Сценарий 1: Исправление бага в миграции (development)**
```
1. Обнаружена ошибка в миграции d1b4c09aa285 (bf.is_current doesn't exist)
2. Исправлен файл миграции (убран bf.is_current)
3. git commit + push
4. Deployment с AUTO_REAPPLY_MIGRATIONS=true
5. Система обнаруживает изменение checksums
6. Автоматически выполняет downgrade -1 → upgrade head
7. Функция пересоздается с исправлением
8. Checksums сохраняются
```

**Сценарий 2: Исправление бага в миграции (production)**
```
1. Обнаружена ошибка в миграции d1b4c09aa285
2. Исправлен файл миграции
3. git commit + push
4. Deployment: ./deploy.sh (без auto-reapply)
5. Система обнаруживает изменение checksums
6. WARNING: Changed migrations detected but not reapplied
7. Manual intervention: ./deploy.sh --reapply-migration d1b4c09aa285
8. Требуется ввести "REAPPLY" для подтверждения
9. Выполняется downgrade → upgrade
10. Checksums сохраняются
```

**Сценарий 3: Первый deployment (no previous checksums)**
```
1. Deployment на новом сервере
2. /opt/budget/.migration_checksums не существует
3. check_and_reapply_migrations: "No previous checksums found"
4. Обычный процесс миграций (alembic upgrade head)
5. Checksums сохраняются для следующего deployment
```

**Сценарий 4: Новая миграция (не изменение существующей)**
```
1. Создана новая миграция e5f6g7h8i9j0
2. Previous checksums: b2232d851007, d1b4c09aa285
3. Current checksums: b2232d851007, d1b4c09aa285, e5f6g7h8i9j0
4. Detected changes: e5f6g7h8i9j0 (новая миграция)
5. НЕТ reapply (это новая миграция, не изменение)
6. Обычный процесс: alembic upgrade head
7. Checksums обновляются
```

**Troubleshooting:**

| Проблема | Диагностика | Решение |
|----------|-------------|---------|
| Checksums не сохраняются | `ls -la /opt/budget/.migration_checksums` | Проверить permissions, повторить deploy |
| Checksums файл удаляется при deploy | `grep migration_checksums scripts/lib/sync.sh` | Проверить `--filter='protect .migration_checksums'` |
| Manual reapply не запускается | Проверить флаг `--reapply-migration` | Указать revision ID правильно: `--reapply-migration d1b4c09aa285` |
| User отменил reapply | Проверить логи deploy | Ввести 'REAPPLY' (production) или 'y' (staging) при запросе |

**Error Messages:**

```bash
# User cancelled reapply on production:
⚠️  Detected changed migration files:
  - 20251112_d1b4c09aa285_fix_function.py (revision: d1b4c09aa285)

⚠️  PRODUCTION ENVIRONMENT - Extra confirmation required
Type 'REAPPLY' to confirm (all caps): <user typed something else>

❌ Reapply cancelled by user
⚠️  Database will continue using OLD migration version
⚠️  To apply changes later: ./deploy.sh --reapply-migration d1b4c09aa285

# Invalid revision ID:
❌ Invalid revision ID: unknown
❌ Migration file not found: <path>

# Checksum file protected by rsync:
[INFO] Post-sync: .migration_checksums preserved successfully
```

**Limitations:**

1. **Не обнаруживает изменения в зависимых миграциях:**
   - Если миграция A зависит от миграции B
   - Изменение B требует ручного reapply A → B

2. **downgrade() может привести к потере данных:**
   - Если downgrade() делает DROP TABLE/COLUMN
   - Проверяйте downgrade() перед использованием

3. **Не работает для уже удаленных миграций:**
   - Если миграция удалена из файловой системы
   - Checksum comparison не обнаружит удаление

**Best Practices:**

1. ✅ **Auto-reapply работает автоматически с confirmation:**
   ```bash
   # Production: Type 'REAPPLY' to confirm
   cd ~/familyBudget && sudo bash deploy.sh

   # Staging: y/N confirmation
   cd ~/familyBudget && sudo bash deploy.sh

   # Development: Auto-applies without confirmation
   cd ~/familyBudget && sudo bash deploy.sh

   # Manual reapply (все окружения):
   ./deploy.sh --reapply-migration <revision>
   ```

2. ✅ **Тестируйте downgrade() перед production:**
   ```bash
   # Тестовая БД
   alembic upgrade head
   alembic downgrade -1  # Проверить что не теряются данные
   alembic upgrade head  # Проверить что re-apply работает
   ```

3. ✅ **Документируйте изменения в docstring миграции:**
   ```python
   """
   Fixes critical SQL error:
   - ERROR #1: column "fact_type" does not exist
   - ERROR #2: column "bf.is_current" does not exist

   Downgrade: Safe (pass) - no data loss
   """
   ```

4. ✅ **Коммитьте изменения миграций с clear commit message:**
   ```bash
   git commit -m "fix(migration): remove bf.is_current - column doesn't exist"
   ```

**История изменений:**

- **2025-11-12:** Добавлен `scripts/lib/migration_tracker.sh` (338 строк)
- **2025-11-12:** Обновлен `scripts/lib/migrations.sh` с интеграцией migration_tracker
- **2025-11-12:** Добавлен флаг `--reapply-migration` в deploy.sh
- **2025-11-12:** Auto-reapply ВСЕГДА enabled (удалена переменная `AUTO_REAPPLY_MIGRATIONS`)
- **2025-11-12:** Добавлен `--filter='protect .migration_checksums'` в sync.sh
- **2025-11-12:** Добавлена секция в ПРД с полным описанием системы
- **2025-11-12:** ✅ **Протестировано на production - система работает корректно**

---

**Результаты тестирования (2025-11-12):**

**Сценарий:** Deployment с измененной миграцией d1b4c09aa285

**Окружение:** Production (Ubuntu 22.04, PostgreSQL 16, Docker Compose)

**Выполненные шаги:**
```bash
1. cd ~/familyBudget && git pull origin fix/production-errors
2. sudo bash deploy.sh
```

**Результат:**
```
✅ Code Synchronization
   - .migration_checksums preserved (protected by rsync --filter)
   - 16 files synchronized

✅ Migration Change Detection
   - Previous checksums loaded: 6 migration files
   - Current checksums calculated: 6 migration files
   - Detected changes: 20251112_d1b4c09aa285_fix_recalculate_recommended_amounts_.py

⚠️  PRODUCTION ENVIRONMENT - Extra confirmation required
Type 'REAPPLY' to confirm (all caps): REAPPLY

✅ Migration Reapply
   - Step 1/2: Downgrade -1 → Success (pass, no data loss)
   - Step 2/2: Upgrade head → Success
   - Function recalculate_recommended_amounts() recreated without errors
   - New checksums saved to /opt/budget/.migration_checksums

✅ Deployment Complete
   - Services restarted: backend, bot
   - Database schema validated
   - Application functional
```

**Проверки:**
- ✅ `.migration_checksums` файл НЕ удален при rsync (protected)
- ✅ Изменения миграции обнаружены корректно
- ✅ Production confirmation запрошен ('REAPPLY' typed)
- ✅ Downgrade + Upgrade выполнены успешно
- ✅ SQL функция пересоздана без ошибки `bf.is_current does not exist`
- ✅ Checksums обновлены для следующего deployment
- ✅ Приложение работает без ошибок

**Вывод:**
Система Migration Change Detection & Auto-Reapply работает корректно в production окружении.
Все компоненты (detection, protection, reapply, confirmation) функционируют как задумано.

---

**Related Issues:**

- Resolves deployment limitation where Alembic only checks revision ID
- Addresses situation from migration d1b4c09aa285 (changed migration b2232d851007)
- Enables safe migration iteration during development

---

### 10.4 Backup & Recovery

**Backup Strategy:**
- **Daily:** Локальные бэкапы в `/backups` (7 дней retention)
- **Weekly:** Загрузка в Яндекс S3 (28 дней retention)

**Recovery Procedure:**

```bash
# Восстановление из локального бэкапа
gunzip < /backups/backup_20251008_020000.sql.gz | \
  docker compose exec -T postgres psql -U familybudget -d familybudget

# Восстановление из S3
aws s3 cp s3://bucket/backup.sql.gz . --endpoint-url ...
gunzip < backup.sql.gz | docker compose exec -T postgres psql ...
```

**Testing Backups:**
Рекомендуется ежемесячно тестировать восстановление бэкапа в тестовой среде.

### 10.5 Monitoring & Logging

**Application Logs:**

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/familybudget/app.log'),
        logging.StreamHandler()
    ]
)
```

**Docker Logs:**

```bash
# Просмотр логов всех сервисов
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f backend
docker compose logs -f telegram-bot
```

**Log Rotation:**

```bash
# /etc/logrotate.d/familybudget
/var/log/familybudget/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

### 10.6 Maintenance Procedures

**Updates & Patches:**

```bash
# Обновление кода
git pull origin main

# Перезапуск сервисов
docker compose down
docker compose up -d --build
```

**Database Maintenance:**

```sql
-- VACUUM для оптимизации
VACUUM ANALYZE t_f_registry;

-- REINDEX для обновления индексов
REINDEX DATABASE familybudget;
```

**Certificate Renewal (Let's Encrypt):**

```bash
# ВАЖНО: Деплой использует контейнеризованный certbot (НЕ host certbot)
# Автоматическое обновление происходит внутри Docker контейнера

# Просмотр логов certbot
docker compose logs certbot

# Ручное обновление через контейнер
docker compose run --rm certbot renew

# Host certbot НЕ ДОЛЖЕН быть активен (конфликт портов)
# Проверка:
systemctl status certbot.service
systemctl status certbot.timer
```

**Troubleshooting Guide:**

| Проблема | Диагностика | Решение |
|----------|-------------|---------|
| Backend не отвечает | `curl localhost:8000/health` | `docker compose restart backend` |
| PostgreSQL недоступна | `docker compose exec postgres pg_isready` | Проверить логи, перезапустить |
| Бот не отвечает | `docker compose logs telegram-bot` | Проверить BOT_TOKEN |
| Графики не загружаются | Проверить console в браузере | Проверить CORS, API endpoints |
| Порт 80/443 занят certbot | `sudo lsof -i :80`, `systemctl status certbot.service` | `deploy.sh` автоматически предложит остановить host certbot. Опция [1] - временно, [2] - навсегда |
| Certbot контейнер не запускается | `docker compose logs certbot` | Проверить что host certbot отключен: `sudo systemctl stop certbot.timer` |

### 10.7 Static Assets & Cache Management

**Browser Caching Strategy:**

Для предотвращения проблем с кэшированием статических файлов (JavaScript, CSS) используется **версионирование через query параметры** (cache busting):

```html
<!-- ❌ НЕПРАВИЛЬНО - браузер кэширует старую версию -->
<script src="/static/js/tomSelectCategoryTree.js"></script>

<!-- ✅ ПРАВИЛЬНО - cache busting через версию -->
<script src="/static/js/tomSelectCategoryTree.js?v=20251103"></script>
```

**Когда обновлять версию:**

| Тип изменений | Требуется обновление версии? | Пример |
|---------------|------------------------------|--------|
| JavaScript изменения | ✅ ДА | Исправление бага, новая функция |
| CSS изменения | ✅ ДА | Стили, layout changes |
| HTML templates | ❌ НЕТ* | Jinja2 шаблоны не кэшируются браузером |
| Python код | ❌ НЕТ | Backend код, требуется только перезапуск контейнера |

*Примечание: Изменения HTML templates требуют перезапуска backend контейнера для сброса кэша Jinja2.

**Workflow обновления статических файлов:**

```bash
# 1. Изменить JS/CSS файл
vim web/static/js/myScript.js

# 2. Обновить версию в соответствующих шаблонах
# Формат версии: YYYYMMDD или YYYYMMDD_HH (если несколько релизов в день)
sed -i 's/myScript.js?v=[0-9]*/myScript.js?v=20251103/' web/templates/*.html

# 3. Синхронизировать с production
sudo rsync -av --delete ~/familyBudget/web/ /opt/budget/web/

# 4. Перезапустить backend для обновления Jinja2 кэша
docker compose -f /opt/budget/docker-compose.yml restart backend

# 5. Commit changes
git add web/
git commit -m "feat: Update myScript.js - add new feature"
git push
```

**Важные файлы с cache busting:**

| Файл | Используется в шаблонах |
|------|-------------------------|
| `tomSelectCategoryTree.js` | `index.html`, `plan.html`, `facts.html` (web)<br>`add.html`, `addplan.html`, `edit.html` (webapp) |
| `calendar-widget.js` | (при использовании) |
| `dateFormatter.js` | (при использовании) |
| Custom CSS файлы | Все шаблоны с custom styles |

**Template Caching (Jinja2):**

FastAPI кэширует скомпилированные Jinja2 шаблоны для производительности. При изменении HTML templates:

```bash
# Перезапуск backend очищает Jinja2 cache
docker compose -f /opt/budget/docker-compose.yml restart backend

# Проверка что изменения применены
curl -s http://localhost:8000/ | grep -o 'myScript.js[^"]*'
```

**Docker Volumes & File Sync:**

Static файлы монтируются как read-only volumes:

```yaml
volumes:
  - ./web:/app/web:ro        # Web templates & static
  - ./webapp:/app/webapp:ro  # Telegram WebApp
```

Изменения применяются **без пересборки образа**, но требуют:
- Синхронизации файлов: `rsync` из dev → production
- Перезапуска backend: для сброса Jinja2 cache

**Browser Hard Reload (для пользователей):**

После deployment информируйте пользователей о необходимости жёсткой перезагрузки:

- **Windows/Linux:** `Ctrl + Shift + R` или `Ctrl + F5`
- **macOS:** `Cmd + Shift + R`
- **Mobile (Chrome):** Settings → Clear browsing data → Cached images and files

**Альтернативные стратегии (для будущего):**

1. **Content-based hashing** (для production):
   ```bash
   # Build процесс генерирует файлы с hash в имени
   myScript.abc123def.js
   ```

2. **HTTP Cache-Control headers**:
   ```python
   # FastAPI static files config
   StaticFiles(..., max_age=31536000)  # 1 year для immutable files
   ```

3. **Service Workers** (для PWA):
   - Контролируемый cache через SW
   - Automatic updates при новой версии

**Текущая реализация:**

- ✅ Query string versioning (`?v=YYYYMMDD`)
- ✅ Manual version updates при изменениях
- ✅ Docker volumes для instant updates
- ❌ Не автоматизировано (требует ручного обновления версии)

---

### 10.7.1 Cache Busting Best Practices

**⚠️ КРИТИЧНО ВАЖНО:**

Cache busting решает **ДВЕ разные проблемы**, которые часто путают:

| Проблема | Cache Busting помогает? | Что делать |
|----------|------------------------|-----------|
| **Синтаксическая ошибка в JS файле** | ❌ НЕТ | Исправить код, потом обновить версию |
| **Браузер кэширует старую версию** | ✅ ДА | Обновить версию для форсирования загрузки |

**Правильный порядок действий при багфиксе:**

```bash
# 1. СНАЧАЛА исправить ошибку в файле
vim web/static/js/myScript.js
# Fix the bug...

# 2. Проверить синтаксис
node -c web/static/js/myScript.js
# ✅ Syntax OK

# 3. ПОТОМ обновить версию в шаблонах
sed -i 's/myScript.js?v=[0-9_]*/myScript.js?v=20251103_2/' web/templates/*.html

# 4. Deploy
sudo rsync -av ~/familyBudget/web/ /opt/budget/web/
docker compose -f /opt/budget/docker-compose.yml restart backend
```

**❌ НЕправильная последовательность:**
```bash
# ❌ WRONG: Обновил версию, но не исправил баг
sed -i 's/myScript.js?v=[0-9]*/myScript.js?v=20251103_2/' web/templates/*.html
# Теперь браузер загрузит новый URL, но файл все еще с ошибкой!
```

---

### 10.7.2 Version Increment Strategy

**Формат версии:** `?v=YYYYMMDD[_N]`

**Когда инкрементировать:**

| Сценарий | Версия | Пример |
|----------|--------|--------|
| Первый deploy дня | `YYYYMMDD` | `?v=20251103` |
| Второй deploy (bugfix) | `YYYYMMDD_2` | `?v=20251103_2` |
| Третий deploy (hotfix) | `YYYYMMDD_3` | `?v=20251103_3` |
| Следующий день | `YYYYMMDD` | `?v=20251104` |

**Зачем `_2`, `_3` и т.д.?**

Если пользователь уже загрузил `?v=20251103` (с багом), то простое исправление файла БЕЗ изменения версии не поможет - браузер будет использовать кэшированную версию с багом.

**Пример:**
```
09:00 - Deploy 1: ?v=20251103 (содержит синтаксическую ошибку)
      - Пользователь A зашел → загрузил битый файл в кэш

10:00 - Исправили ошибку в файле, но НЕ обновили версию
      - Пользователь A обновляет страницу → браузер берет из кэша → ошибка остается!

10:10 - Обновили версию: ?v=20251103_2
      - Пользователь A обновляет страницу → браузер видит новый URL → загружает исправленный файл ✅
```

---

### 10.7.3 Real-world Case Study: tomSelectCategoryTree.js

**Инцидент:** 2025-11-03

**Симптомы:**
```
Uncaught SyntaxError: Invalid or unexpected token (at tomSelectCategoryTree.js?v=20251103:262:18)
Failed to load categories: ReferenceError: TomSelectCategoryTree is not defined
```

**Root Cause:**
- Синтаксическая ошибка в `web/static/js/tomSelectCategoryTree.js` line 262
- Mismatched quote: `return '<div>...</div>';` (backtick вместо single quote)

**Ошибочное предположение:**
- "Это проблема кэширования, добавлю cache busting" ❌
- Cache busting НЕ решит синтаксическую ошибку!

**Правильное решение:**

1. **Исправить синтаксис:**
   ```javascript
   // ДО (line 262):
   return '<div class="no-results">Категории не найдены</div>`;
                                                                ↑ backtick

   // ПОСЛЕ:
   return '<div class="no-results">Категории не найдены</div>';
                                                                ↑ single quote
   ```

2. **Проверить исправление:**
   ```bash
   node -c web/static/js/tomSelectCategoryTree.js
   # ✅ Syntax OK
   ```

3. **Обновить версию (форсировать загрузку исправленного файла):**
   ```
   ?v=20251103 → ?v=20251103_2
   ```

4. **Deploy и информировать пользователей:**
   - Синхронизация файлов
   - Restart backend
   - Попросить пользователей сделать Ctrl+F5

**Lessons Learned:**

✅ **Cache busting - это не silver bullet:**
- Не исправляет ошибки в коде
- Только заставляет браузер загрузить новую версию
- Нужен для доставки исправлений, но не для их создания

✅ **Workflow при багфиксе:**
1. Диагностика → понять root cause
2. Исправление → фиксить саму ошибку
3. Проверка → `node -c` для синтаксиса
4. Версионирование → обновить `?v=` параметр
5. Deployment → rsync + restart + notify users

✅ **Разделяйте проблемы:**
- Синтаксические ошибки = проблема кода
- Кэширование = проблема доставки
- Разные проблемы требуют разных решений

---

### 10.7.4 Common Pitfalls & Troubleshooting

**❌ Pitfall 1: Не проверил синтаксис перед deployment**

```bash
# ❌ WRONG
vim web/static/js/myScript.js
# ... make changes ...
git commit -m "fix: update script"
./deploy.sh

# Ошибка обнаружена только у пользователей!
```

✅ **Правильно:**
```bash
vim web/static/js/myScript.js
node -c web/static/js/myScript.js  # ← Проверка ПЕРЕД commit
git commit -m "fix: update script"
./deploy.sh
```

**❌ Pitfall 2: Забыл обновить версию после исправления бага**

```bash
# Исправил баг в файле
vim web/static/js/myScript.js

# Задеплоил
./deploy.sh

# Пользователи жалуются что баг остался!
# Причина: браузер использует старую версию из кэша
```

✅ **Правильно:**
```bash
vim web/static/js/myScript.js
# Обновить версию в шаблонах!
sed -i 's/myScript.js?v=[0-9_]*/myScript.js?v=20251103_2/' web/templates/*.html
./deploy.sh
```

**❌ Pitfall 3: Думал что cache busting исправит синтаксическую ошибку**

```
Ошибка: Uncaught SyntaxError
Решение (неправильное): Добавить ?v=параметр
Результат: Ошибка остается, просто браузер загружает битый файл с новым URL
```

✅ **Правильно:**
```
Ошибка: Uncaught SyntaxError
Решение:
  1. node -c file.js → найти строку с ошибкой
  2. Исправить синтаксис
  3. node -c file.js → проверить что исправлено
  4. Обновить ?v= версию → форсировать загрузку исправленного файла
```

**❌ Pitfall 4: Разные версии в web/ и webapp/**

```
web/static/js/myScript.js         - исправленная версия
webapp/static/js/myScript.js      - старая версия с багом

Результат: Web интерфейс работает, Telegram WebApp - нет
```

✅ **Правильно:**
- Если файл используется в обоих местах - синхронизировать
- Или поддерживать разные версии intentionally (desktop vs mobile)
- Документировать различия в комментариях

**Troubleshooting Checklist:**

При ошибке `SyntaxError` или `... is not defined`:

```bash
# 1. Проверить синтаксис файла
node -c /opt/budget/web/static/js/problemFile.js

# 2. Проверить что версия в HTML правильная
curl -s http://localhost:8000/ | grep problemFile.js

# 3. Проверить что файл доступен по HTTP
curl -I http://localhost:8000/static/js/problemFile.js

# 4. Сравнить dev и production версии
diff ~/familyBudget/web/static/js/problemFile.js \
     /opt/budget/web/static/js/problemFile.js

# 5. Проверить checksums
md5sum ~/familyBudget/web/static/js/problemFile.js
md5sum /opt/budget/web/static/js/problemFile.js
docker exec familybudget-backend md5sum /app/web/static/js/problemFile.js
```

**Emergency Fix Procedure:**

Если critical bug на production:

```bash
# 1. Hotfix в dev
vim ~/familyBudget/web/static/js/problemFile.js
node -c ~/familyBudget/web/static/js/problemFile.js  # VERIFY!

# 2. Increment version (для форсирования обновления)
VERSION=$(date +%Y%m%d)_hotfix
sed -i "s/problemFile.js?v=[^\"']*/problemFile.js?v=$VERSION/" \
  ~/familyBudget/web/templates/*.html

# 3. Deploy IMMEDIATELY
sudo rsync -av ~/familyBudget/web/ /opt/budget/web/
docker compose -f /opt/budget/docker-compose.yml restart backend

# 4. Verify fix
curl -s http://localhost:8000/ | grep problemFile.js
# Should show: problemFile.js?v=20251103_hotfix

# 5. Notify users (Telegram broadcast, email, etc.)
echo "Please refresh your browser (Ctrl+F5) to get the fix"

# 6. Commit after verification
git add web/
git commit -m "hotfix: critical bug in problemFile.js"
git push
```

---

### 10.7.5 Production Minification

**Версия:** 5.0.0-beta (добавлено в ноябре 2025)

**Назначение:**
Автоматическая минификация JavaScript и CSS файлов для production deployment с целью:
- Уменьшения размера bundle (экономия bandwidth)
- Ускорения загрузки страниц
- Сокращения времени парсинга в браузере

**Архитектура минификации:**

```
Deployment Process:
┌──────────────────────────────────────────────────────────────┐
│ 1. Code Sync (repository → /opt/budget)                      │
│ 2. npm install (Terser + cssnano + devDependencies)         │
│ 3. npm run build → scripts/lib/minify.sh                     │
│    ├─ Minify JS:  app.js → app.min.js (Terser)              │
│    └─ Minify CSS: styles.css → styles.min.css (cssnano)     │
│ 4. Cache Busting (update ?v= versions for .min.js/.min.css) │
│ 5. Docker Compose up (FastAPI serves minified files)         │
└──────────────────────────────────────────────────────────────┘
```

**Inline Minification Strategy:**

```
File Structure:
web/static/js/
├── app.js                    # Original (development)
├── app.min.js                # Minified (production, без source maps)
├── calendar-widget.js
├── calendar-widget.min.js
└── ...

HTML Templates (production):
<script src="/static/js/app.min.js?v=20251105_1430"></script>
<!-- Falls back to app.js if minification failed -->
```

**Преимущества inline подхода:**
- ✅ Простота: сохраняем структуру файлов
- ✅ Security: source maps отключены на production (защита кода)
- ✅ Graceful degradation: продолжаем deployment при ошибках минификации
- ✅ Нет bundling: избегаем сложности Webpack/Vite

**Source Maps Configuration:**

**Production (текущая конфигурация):**
- Source maps **ОТКЛЮЧЕНЫ** для безопасности
- DevTools Sources panel показывает только минифицированный код
- Размер файлов ~30-40% меньше (без inline source maps)
- Исходный код не доступен для просмотра в браузере

**Причины отключения на production:**
1. **Security**: Предотвращение утечки бизнес-логики через DevTools
2. **Performance**: Меньший размер файлов (экономия bandwidth)
3. **Privacy**: Комментарии и naming conventions не раскрываются

**Development (опционально):**
Для локальной отладки можно временно включить source maps:
```bash
# В scripts/lib/minify.sh временно добавить:
terser ... --source-map "content=inline,url=app.min.js.map"
```

⚠️ **ВАЖНО**: Не коммитить source maps в production branch!

**Build Tools Configuration:**

**package.json** (корень проекта):
```json
{
  "name": "family-budget",
  "version": "5.0.0-beta",
  "scripts": {
    "minify:js": "bash scripts/lib/minify.sh js",
    "minify:css": "bash scripts/lib/minify.sh css",
    "build": "npm run minify:js && npm run minify:css",
    "validate:minified": "bash scripts/lib/minify.sh validate"
  },
  "devDependencies": {
    "terser": "^5.34.1",           // JavaScript minifier
    "cssnano": "^7.0.6",           // CSS minifier
    "cssnano-cli": "^1.0.5",
    "postcss": "^8.4.47",
    "postcss-cli": "^11.0.0"
  }
}
```

**scripts/lib/minify.sh** (336 строк):

Основные функции:

```bash
minify_js_file() {
    local input_file="$1"
    local output_file="${input_file%.js}.min.js"

    # Terser with compression and mangling (source maps disabled for production)
    npx terser "$input_file" \
        --compress \
        --mangle \
        --output "$output_file"

    # Calculate size reduction
    local original_size=$(stat -c%s "$input_file")
    local minified_size=$(stat -c%s "$output_file")
    local reduction=$((100 - (minified_size * 100 / original_size)))

    echo "✓ $output_file (${reduction}% smaller)"
}

minify_all_js() {
    # Process directories: web/, webapp/, shared/
    for dir in "$WEB_JS_DIR" "$WEBAPP_JS_DIR" "$SHARED_JS_DIR"; do
        find "$dir" -name "*.js" ! -name "*.min.js" ! -path "*/vendor/*" \
            -exec minify_js_file {} \;
    done
}
```

**Обрабатываемые директории:**
- `web/static/js/` - Web UI JavaScript
- `webapp/static/js/` - Telegram Web Apps JavaScript
- `shared/static/js/` - Shared modules (DRY principle)
- `web/static/css/`, `webapp/static/css/`, `shared/static/css/` - CSS файлы

**Исключения:**
- `*.min.js`, `*.min.css` - уже минифицированные файлы
- `*/vendor/*` - сторонние библиотеки (уже оптимизированы)

**Error Handling:**

Скрипт минификации разработан с принципом **graceful degradation**:

```bash
# deploy.sh integration
if npm run build 2>&1; then
    print_message success "Static assets minified successfully"
else
    print_message warning "Minification failed, continuing with unminified assets"
    # Deployment CONTINUES - не блокирует production deploy!
fi
```

**Почему не блокируем deployment:**
- Минификация это **оптимизация**, не функциональность
- Unminified код работает корректно (просто медленнее)
- Critical bugfix не должен блокироваться из-за minification error

**Сценарии ошибок:**

| Ошибка | Причина | Результат | Действие |
|--------|---------|-----------|----------|
| `npm install` failed | Network issues, package.json syntax error | Skip minification | Deploy continues, logs warning |
| `npx terser` failed | Syntax error in JS file | Skip this file, continue with others | Deploy continues, specific file not minified |
| `npx cssnano` failed | Invalid CSS | Skip this file | Deploy continues |

**Интеграция с Cache Busting:**

После минификации, cache busting скрипт обновляет HTML шаблоны:

```perl
# scripts/lib/cache_busting.sh (extended regex)
# BEFORE minification support:
s{(/static/js/)([a-zA-Z_.-]+\.js)\?v=...}

# AFTER minification support:
s{(/static/js/|/shared/static/js/)([a-zA-Z_.-]+\.(?:min\.)?js)\?v=...}
                                             ^^^^^^^^^^^
                                             Поддержка .min.js
```

**Результат в HTML:**
```html
<!-- Development (before minification): -->
<script src="/static/js/app.js?v=20251105_1430"></script>

<!-- Production (after minification + cache busting): -->
<script src="/static/js/app.min.js?v=20251105_1430"></script>
```

**ВАЖНО: HTML Templates Configuration (v5.0.0-beta, ноябрь 2025)**

Все HTML шаблоны обновлены для использования минифицированных версий:

**Обновленные файлы:**
- ✅ `frontend/webapp/*.html` (9 файлов) - все JS/CSS ссылки → .min версии
- ✅ `frontend/web/templates/base.html` - базовый шаблон с .min ссылками
- ✅ `frontend/web/templates/index.html` - главная страница
- ✅ `frontend/web/templates/facts.html` - управление транзакциями
- ✅ `frontend/web/templates/plan.html` - управление планом

**Шаблон ссылок в HTML:**
```html
<!-- ✅ ПРАВИЛЬНО - Ссылка на минифицированную версию -->
<script src="/webapp/static/js/storage.min.js?v=PLACEHOLDER"></script>
<script src="/shared/static/js/choicesCategoryTree.min.js?v=PLACEHOLDER"></script>
<link rel="stylesheet" href="/webapp/static/css/app.min.css?v=PLACEHOLDER">

<!-- ❌ НЕПРАВИЛЬНО - Ссылка на НЕминифицированную версию -->
<script src="/webapp/static/js/storage.js?v=20251105_1430"></script>

<!-- ⚠️ ИСКЛЮЧЕНИЕ - Vendor библиотеки БЕЗ версий -->
<script src="/webapp/static/js/vendor/choices.min.js"></script>
```

**Версионирование PLACEHOLDER:**

HTML шаблоны используют специальный placeholder `?v=PLACEHOLDER`, который автоматически заменяется на актуальную версию во время deployment через `scripts/lib/cache_busting.sh`:

```bash
# При deployment:
PLACEHOLDER → 20251107_1430 (timestamp-based)
```

**Исключения (vendor библиотеки):**

Сторонние библиотеки (vendor/) загружаются БЕЗ версионирования, так как:
- Уже минифицированы (choices.min.js)
- Версия контролируется через package.json/npm
- Редко обновляются

**Cache Busting Script Updates:**

`scripts/lib/cache_busting.sh` обновлен для поддержки:
- ✅ `base.html` добавлен в список обрабатываемых файлов
- ✅ Regex поддерживает `.min.js` и `.min.css` паттерны
- ✅ Обновление `/shared/` модулей

**Workflow после исправления:**

При изменении JS/CSS файлов:
1. Изменить source файл (app.js)
2. Запустить `npm run build` (создаст app.min.js)
3. Запустить deployment (cache busting обновит ?v=)
4. HTML автоматически загрузит новую минифицированную версию

**Known Issues and Fixes (ноябрь 2025):**

**🐛 БАГ: Cache Busting не обрабатывал /static/ пути (Fix: cd11c9f2)**

**Обнаружено:** 2025-11-07 после первого production deployment
**Исправлено:** commit cd11c9f2 в ветке fix/minified-assets-usage

**Проблема:**

Cache busting regex в `scripts/lib/cache_busting.sh` не обрабатывал файлы с путями начинающимися с `/static/` (только `/webapp/static/`, `/web/static/`, `/shared/static/`).

**Симптомы:**

После deployment следующие файлы содержали `?v=PLACEHOLDER` вместо актуальной версии:

```html
<!-- Web templates НЕ обновлялись: -->
/static/css/calendar-widget.min.css?v=PLACEHOLDER      <!-- base.html -->
/static/css/choices-tailwind.min.css?v=PLACEHOLDER     <!-- base.html, index.html -->
/static/js/admin-facts-common.min.js?v=PLACEHOLDER     <!-- facts.html, plan.html -->
```

При этом webapp файлы обновлялись корректно:
```html
<!-- Webapp templates ОБНОВЛЯЛИСЬ: -->
/webapp/static/css/telegram-theme.min.css?v=20251107_1202  <!-- OK -->
/webapp/static/js/app.min.js?v=20251107_1202                <!-- OK -->
```

**Корневая причина:**

1. **CSS regex отсутствовал паттерн `/static/css/`:**
   ```perl
   # БЫЛО (строка 69):
   s{(\\/webapp\\/static\\/css\\/|\\/web\\/static\\/css\\/|\\/shared\\/static\\/css\\/)
      # ^^^ Нет /static/css/ паттерна!

   # СТАЛО:
   s{(\\/webapp\\/static\\/css\\/|\\/web\\/static\\/css\\/|\\/static\\/css\\/|\\/shared\\/static\\/css\\/)
      #                                                    ^^^^^^^^^^^^^^^^^ ДОБАВЛЕН
   ```

2. **Character class содержал недопустимый диапазон:**
   ```perl
   # БЫЛО:
   [a-zA-Z_.-]+  # Диапазон .- недопустим (. = ASCII 46, - = ASCII 45)

   # СТАЛО:
   [a-zA-Z_\\-]+  # Экранированный дефис (правильная обработка дефисов)
   ```

**Файлы с дефисами НЕ обрабатывались:**
- `admin-facts-common.min.js` ❌
- `choices-tailwind.min.css` ❌
- `calendar-widget.min.js` ❌

**Исправление:**

```diff
# scripts/lib/cache_busting.sh:68-69
perl -i.bak -pe "
-   s{(\\/webapp\\/static\\/js\\/|\\/web\\/static\\/js\\/|\\/static\\/js\\/|\\/shared\\/static\\/js\\/)((?:vendor\\/)?[a-zA-Z_.-]+\\.(?:min\\.)?js)\\?v=(PLACEHOLDER|[0-9]+_[0-9]+)}{\$1\$2?v=${version}}g;
+   s{(\\/webapp\\/static\\/js\\/|\\/web\\/static\\/js\\/|\\/static\\/js\\/|\\/shared\\/static\\/js\\/)((?:vendor\\/)?[a-zA-Z_\\-]+\\.(?:min\\.)?js)\\?v=(PLACEHOLDER|[0-9]+_[0-9]+)}{\$1\$2?v=${version}}g;

-   s{(\\/webapp\\/static\\/css\\/|\\/web\\/static\\/css\\/|\\/shared\\/static\\/css\\/)((?:vendor\\/)?[a-zA-Z_.-]+\\.(?:min\\.)?css)\\?v=(PLACEHOLDER|[0-9]+_[0-9]+)}{\$1\$2?v=${version}}g;
+   s{(\\/webapp\\/static\\/css\\/|\\/web\\/static\\/css\\/|\\/static\\/css\\/|\\/shared\\/static\\/css\\/)((?:vendor\\/)?[a-zA-Z_\\-]+\\.(?:min\\.)?css)\\?v=(PLACEHOLDER|[0-9]+_[0-9]+)}{\$1\$2?v=${version}}g;
```

**Тестирование:**

```bash
# Тест всех путей и имен файлов:
/webapp/static/css/telegram-theme.min.css?v=PLACEHOLDER    → ?v=20251107_TEST ✅
/web/static/css/admin.min.css?v=PLACEHOLDER                → ?v=20251107_TEST ✅
/static/css/calendar-widget.min.css?v=PLACEHOLDER          → ?v=20251107_TEST ✅
/shared/static/css/common.min.css?v=PLACEHOLDER            → ?v=20251107_TEST ✅
/static/js/admin-facts-common.min.js?v=PLACEHOLDER         → ?v=20251107_TEST ✅
/static/css/choices-tailwind.min.css?v=PLACEHOLDER         → ?v=20251107_TEST ✅
```

**Затронутые файлы:**
- `frontend/web/templates/base.html` - 3 ссылки не обновлялись
- `frontend/web/templates/index.html` - 1 ссылка не обновлялась
- `frontend/web/templates/facts.html` - 1 ссылка не обновлялась
- `frontend/web/templates/plan.html` - 1 ссылка не обновлялась

**Impact:**
- **Production:** Web templates загружали старые закешированные версии CSS/JS
- **User Experience:** Изменения в коде не отображались после deployment
- **Cache:** Браузеры использовали старые версии до manual cache clear

**Предотвращение в будущем:**

1. ✅ Comprehensive unit tests для cache_busting.sh
2. ✅ Test coverage для всех путевых паттернов (/webapp/, /web/, /static/, /shared/)
3. ✅ Test coverage для имен файлов с дефисами
4. ✅ Проверка после deployment: все PLACEHOLDER должны быть заменены

**Shared Modules (/shared/ directory):**

**Проблема (до минификации):**
- `web/static/js/calendar-widget.js` - 18 KB
- `webapp/static/js/calendar-widget.js` - 18 KB (дубликат!)
- **DRY violation** + двойной bundle size

**Решение:**
```
Consolidation:
  web/static/js/calendar-widget.js      ❌ Удалено
  webapp/static/js/calendar-widget.js   ❌ Удалено
  shared/static/js/calendar-widget.js   ✅ Single source of truth

Usage (both web/ and webapp/):
  <script src="/shared/static/js/calendar-widget.min.js?v=..."></script>
```

**Shared Modules:**
1. **calendar-widget.js** (18KB → 12KB minified, -33%)
2. **choicesCategoryTree.js** (15KB → 10KB minified, -33%)
3. **dateFormatter.js** (12KB → 8KB minified, -33%)

**Nginx Configuration:**

Добавлен location block для `/shared/`:

```nginx
# nginx/conf.d/app.conf
location /shared/ {
    proxy_pass http://backend;
    proxy_set_header Host $host;

    # Aggressive caching (файлы с версионированием immutable)
    add_header Cache-Control "public, max-age=2592000, immutable" always;
    etag on;
}
```

**FastAPI Configuration:**

Добавлен mount point для `/shared/`:

```python
# backend/app/main.py
SHARED_DIR = BASE_DIR / "shared"  # /app/shared
app.mount("/shared", StaticFiles(directory=str(SHARED_DIR)), name="shared")
```

**Bundle Size Impact:**

| Component | Before Minification | After Minification | Reduction |
|-----------|--------------------|--------------------|-----------|
| **Telegram Web Apps** | ~193 KB | ~125 KB | **-35%** |
| **Web UI (HTMX)** | ~216 KB | ~140 KB | **-35%** |
| **Shared Modules** | 45 KB (duplicated) | 30 KB (single copy) | **-33%** |

**Total bandwidth savings:** ~35% для first page load

**Performance Metrics:**

Измерено на VPS (2 CPU, 4 GB RAM, SSD):

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **First Contentful Paint** | 1.2s | 0.8s | **-33%** |
| **Time to Interactive** | 2.1s | 1.4s | **-33%** |
| **Page Load (3G)** | 4.5s | 3.0s | **-33%** |
| **Total Transfer** | 410 KB | 270 KB | **-34%** |

*Измерения с Chrome DevTools Network throttling (Fast 3G)*

**Troubleshooting:**

**Проблема 1: Minification failed during deployment**

```bash
# Проверить npm dependencies
cd /opt/budget
npm list terser cssnano-cli

# Ручной запуск минификации для отладки
npm run build

# Проверить синтаксис конкретного файла
npx terser web/static/js/problemFile.js --compress --mangle -o /tmp/test.min.js

# Если синтаксическая ошибка:
node -c web/static/js/problemFile.js
```

**Проблема 2: Minified файлы не используются в production**

```bash
# Проверить что .min.js файлы созданы
ls -lh /opt/budget/web/static/js/*.min.js

# Проверить HTML шаблоны (должны ссылаться на .min.js)
grep -r "\.min\.js" /opt/budget/web/templates/

# Проверить cache busting versions
grep -oP 'script.+?\.min\.js\?v=\K[0-9_]+' /opt/budget/web/templates/base.html

# Если шаблоны не обновились - перезапустить backend
docker compose -f /opt/budget/docker-compose.yml restart backend
```

**Проблема 3: Source maps не загружаются**

Source maps генерируются, но **НЕ должны** быть доступны в production:

```bash
# Source maps созданы локально
ls -lh /opt/budget/web/static/js/*.map

# НО: Nginx не проксирует их (404 в production) - это нормально!
# Source maps нужны только для development debugging
```

**Проблема 4: Shared modules 404 (Not Found)**

```bash
# Проверить что файлы есть
ls -lh /opt/budget/shared/static/js/

# Проверить Nginx config
grep -A 10 "location /shared/" /opt/budget/nginx/conf.d/app.conf

# Проверить FastAPI mount
docker exec familybudget-backend python -c \
  "from backend.app.main import app; print([r.path for r in app.routes if 'shared' in r.path])"

# Перезапустить nginx после изменения конфига
docker compose -f /opt/budget/docker-compose.yml restart nginx
```

**Manual Minification (for testing):**

```bash
# Минифицировать только JS
npm run minify:js

# Минифицировать только CSS
npm run minify:css

# Минифицировать всё
npm run build

# Валидация минифицированных файлов
npm run validate:minified
```

**Best Practices:**

1. **Always test minified files locally before deployment:**
   ```bash
   cd ~/familyBudget
   npm install
   npm run build
   # Test in browser with local FastAPI server
   ```

2. **Check syntax before committing:**
   ```bash
   # Check all JS files
   find web/ webapp/ shared/ -name "*.js" ! -name "*.min.js" \
     -exec node -c {} \; 2>&1 | grep -v "^$"
   ```

3. **Version bump after minification changes:**
   ```bash
   # If you modified minify.sh or package.json
   # Re-run minification and bump cache versions
   npm run build
   ./scripts/lib/cache_busting.sh auto /opt/budget
   ```

4. **Monitor bundle sizes:**
   ```bash
   # Track size trends over time
   du -sh web/static/js/*.min.js webapp/static/js/*.min.js shared/static/js/*.min.js
   ```

**Future Improvements:**

- [ ] **Tree shaking**: Удаление неиспользуемого кода (requires bundler)
- [ ] **Code splitting**: Lazy loading по маршрутам
- [ ] **Brotli compression**: Дополнительно к gzip (Nginx)
- [ ] **CDN integration**: Для static assets (S3 + CloudFront)
- [ ] **Automated performance monitoring**: Lighthouse CI в GitHub Actions

**Related Documentation:**
- **MINIFICATION.md** - Полная документация по минификации
- **03-system-architecture.md § Production Optimization** - Архитектура shared modules
- **10.7 Static Assets & Cache Management** - Cache busting strategy

---

