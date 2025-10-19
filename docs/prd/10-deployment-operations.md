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

---

