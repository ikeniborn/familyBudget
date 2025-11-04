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

#### deploy.sh (~80 lines)

```bash
#!/bin/bash
set -e

echo "=== FamilyBudget Deployment ==="

# Проверка .env
if [ ! -f .env ]; then
  echo "Error: .env file not found. Run setup.sh first"
  exit 1
fi

# Запуск Docker Compose
echo "Starting services..."
docker compose up -d

# Health checks
echo "Waiting for services to start..."
sleep 10

# Check PostgreSQL
docker compose exec postgres pg_isready -U familybudget || {
  echo "Error: PostgreSQL not ready"
  exit 1
}

# Check backend
curl -f http://localhost:8000/health || {
  echo "Error: Backend not responding"
  exit 1
}

echo "✅ Deployment successful!"

# Вывод информации
echo ""
echo "=== Access Information ==="
echo "Web Interface: https://$(hostname -I | awk '{print $1}')"
echo "API Docs: http://$(hostname -I | awk '{print $1}'):8000/docs"
echo ""
echo "=== Firewall Rules ==="
ufw status numbered

# Логи
echo ""
echo "View logs: docker compose logs -f"
```

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
    "s3://$S3_BUCKET_NAME/$(date +%Y/%m)/$BACKUP_FILE" \
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
| `backend/db/migrations/*.sql` | postgres-critical | Нет | Нет | Нет | Да |
| `backend/requirements.txt` | backend-deps | Да | Да | Нет | Нет |
| `backend/Dockerfile` | backend-deps | Да | Да | Нет | Нет |
| `backend/app/**/*.py` | backend-code | Нет* | Да | Нет | Нет |
| `web/templates/*.html` | backend-code | Нет* | Да | Нет | Нет |
| `web/static/*` | nginx-config | Нет | Нет | Да | Нет |
| `webapp/*.html` | webapp | Нет* | Нет | Нет | Нет |
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

**Сценарий 5: Добавлена новая миграция**
```bash
Changed files: backend/db/migrations/013_add_notifications.sql

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

