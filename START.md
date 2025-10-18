# Family Budget - Quick Start Guide

Краткое руководство по развёртыванию приложения Family Budget на чистом сервере Ubuntu/Debian.

## Требования

- Ubuntu 20.04+ или Debian 11+
- Root/sudo доступ
- Интернет-соединение

## Быстрый старт (3 шага)

### 1. Установка системных зависимостей

Устанавливает Docker, Docker Compose, UFW firewall и создаёт структуру директорий.

```bash
sudo ./install.sh
```

**Что делает:**
- Устанавливает Docker Engine и Docker Compose
- Устанавливает базовые утилиты (curl, git, jq, certbot)
- Настраивает UFW firewall (SSH, HTTP, HTTPS)
- Создаёт директорию `/opt/budget` с поддиректориями
- Добавляет пользователя в группу docker

**После установки:**
```bash
# Обновите группы для текущего пользователя
newgrp docker
# Или выйдите и войдите заново
```

---

### 2. Настройка окружения

Интерактивная настройка конфигурации приложения.

```bash
./setup.sh
```

**Что делает:**
- Копирует код из репозитория в `/opt/budget` (кроме deploy.sh)
- Создаёт `.env` файл с настройками
- Генерирует безопасные пароли и секреты
- Настраивает PostgreSQL (порты, внешний доступ)
- Настраивает домен и SSL (опционально)
- Проверяет Telegram Bot токен

**Примечание:** deploy.sh остаётся в репозитории и запускается оттуда

**Интерактивные вопросы:**
- Telegram Bot Token (получить у @BotFather)
- Telegram Admin ID (получить у @userinfobot)
- Профиль деплоя (basic / full)
- Домен (для production с nginx)
- SSL (none / letsencrypt / custom)
- PostgreSQL внешний доступ (опционально)

---

### 3. Деплой приложения

Запускает приложение в Docker контейнерах из репозитория.

```bash
./deploy.sh
```

**Важно:** Запускайте deploy.sh от того же пользователя, что и setup.sh (без sudo).

**Что делает:**
- Проверяет предустановки (Docker, .env)
- **НОВОЕ:** Обнаруживает старые деплои и предлагает очистку
- **НОВОЕ:** Автоматически находит свободные подсети для Docker сетей
- Собирает Docker образы (если нужно)
- Запускает сервисы (PostgreSQL + Backend + Bot + Nginx + Certbot)
- Применяет миграции БД
- Настраивает SSL сертификаты (если выбран letsencrypt)
- Выводит статус и URLs

**Интерактивные опции при обнаружении старых деплоев:**
- [1] Пропустить (может вызвать конфликты подсетей)
- [2] Безопасная очистка (удаляет контейнеры + сети, СОХРАНЯЕТ данные)
- [3] Полная очистка (удаляет всё включая volumes, **УДАЛЯЕТ ВСЕ ДАННЫЕ**)

**Интерактивные опции для подсетей:**
- Автоматически находит свободные подсети в диапазоне 172.20-172.30
- Показывает занятые подсети
- Запрашивает подтверждение
- Опция ввода подсетей вручную

---

## Опции деплоя

```bash
# Базовый деплой (PostgreSQL + Backend)
./deploy.sh

# Полный деплой (+ Bot + Nginx + Certbot)
./deploy.sh --profile full

# Пересборка образов
./deploy.sh --build

# Просмотр логов в реальном времени
./deploy.sh --foreground

# Чистый деплой (УДАЛЯЕТ ВСЕ ДАННЫЕ!)
./deploy.sh --clean

# Без миграций БД
./deploy.sh --no-migrate
```

---

## После деплоя

### Проверка статуса

```bash
# Статус всех сервисов
docker compose ps

# Логи всех сервисов
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f bot
```

### Доступ к приложению

**Basic профиль:**
- Backend API: `http://localhost:8000` или `http://your-domain:8000`
- Swagger docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

**Full профиль:**
- Web UI: `http://your-domain` (через nginx)
- HTTPS: `https://your-domain` (если настроен SSL)
- Backend API: проксируется через nginx

### Полезные команды

```bash
# Перезапуск сервиса
docker compose restart backend

# Остановка всех сервисов
docker compose down

# Остановка с удалением volumes (УДАЛЯЕТ ДАННЫЕ!)
docker compose down -v

# Просмотр используемых ресурсов
docker stats

# Выполнить команду в контейнере
docker compose exec backend bash

# Просмотр логов PostgreSQL
docker compose logs postgres
```

---

## Обновление приложения

```bash
# В репозитории (~/Documents/Project/familyBudget)
cd ~/Documents/Project/familyBudget
git pull

# Обновить код в /opt/budget
./setup.sh  # Выберет опцию обновления

# Деплой с пересборкой (из репозитория)
./deploy.sh --build
```

---

## Структура директорий

### Репозиторий (исходный код)
```
~/Documents/Project/familyBudget/
├── backend/          # Исходный код backend
├── bot/              # Исходный код Telegram bot
├── web/              # Статические файлы frontend
├── docs/             # Документация
├── install.sh        # Установка системы
├── setup.sh          # Настройка окружения
└── docker-compose.yml
```

### Деплой директория (production)
```
/opt/budget/
├── backend/          # Код backend (копия из репозитория)
├── bot/              # Код bot (копия из репозитория)
├── web/              # Статические файлы (копия из репозитория)
├── data/             # Данные приложения
│   └── postgres/     # База данных PostgreSQL
├── backups/          # Бэкапы БД
├── logs/             # Логи приложения
├── uploads/          # Загруженные файлы
├── certbot/          # SSL сертификаты
├── nginx/            # Конфигурация Nginx
├── .env              # Конфигурация (создаётся setup.sh)
└── docker-compose.*.yml  # Docker Compose конфигурация
```

**Примечание:** deploy.sh находится в репозитории и запускается оттуда

---

## Сети и подсети Docker

### Автоматическое управление подсетями

При деплое автоматически:
1. Сканируются все Docker сети
2. Определяются занятые подсети в диапазоне 172.X.0.0/16
3. Находятся 2 свободные подсети в диапазоне 172.20-172.30
4. Создаётся `docker-compose.networks.yml` с конфигурацией

### Сети приложения

- **familybudget_internal** (172.XX.0.0/16) - изолированная внутренняя сеть
  - PostgreSQL (недоступна снаружи)
  - Backend (внутренний доступ)
  - Bot (внутренний доступ)

- **familybudget_external** (172.YY.0.0/16) - внешняя сеть
  - Nginx (публичный доступ)
  - Backend (публичный API)
  - Bot (webhook от Telegram)

### Ручная настройка подсетей

Если нужно изменить подсети вручную:

```bash
# При деплое выберите "n" когда спросят про автоматические подсети
./deploy.sh

# Или отредактируйте docker-compose.networks.yml вручную:
nano /opt/budget/docker-compose.networks.yml
```

---

## Безопасность

### Firewall (UFW)

**При установке (install.sh):**
- SSH (порт 22) - ✅ разрешён
- HTTP (80) и HTTPS (443) - ❌ **НЕ открыты по умолчанию**
- PostgreSQL (5432) - ❌ НЕ открыт (можно настроить в setup.sh)

**При деплое с SSL (deploy.sh --profile full):**

Если в `.env` указано `SSL_TYPE=letsencrypt`, скрипт предложит интерактивный выбор:

1. **[1] Открыть порты 80 и 443** - для получения нового SSL сертификата
   - Требуется при первом деплое
   - Certbot получает сертификат через HTTP-01 challenge (порт 80)
   - После получения оба порта остаются открытыми

2. **[2] Открыть только порт 443** - если сертификат уже существует
   - Используйте если сертификат уже получен ранее
   - Порт 80 останется закрыт (продление может не работать!)

3. **[3] Пропустить** - ручная настройка UFW
   - Для опытных администраторов
   - Требует ручного открытия портов

**После получения SSL сертификата:**

Скрипт предложит **опционально закрыть порт 80** для максимальной безопасности:

**Если закрыть порт 80:**
- ✅ Максимальная безопасность (только HTTPS доступ из интернета)
- ✅ Nginx продолжит слушать порт 80 внутри Docker (для редиректа)
- ✅ Certbot продление работает через Docker network
- ❌ HTTP→HTTPS редирект не работает из внешних источников (браузер покажет "connection refused")
- Рекомендуется для: high-security production окружений

**Если оставить порт 80 открытым:**
- ✅ HTTP→HTTPS редирект работает из интернета
- ✅ Пользователи могут ввести http:// и будут перенаправлены на https://
- ✅ Certbot продление гарантированно работает
- ⚠️ Порт 80 доступен из интернета (минимальный риск)
- Рекомендуется для: обычных production сайтов

### Доступ к PostgreSQL

**Внутри Docker сети:** Доступен для backend и bot

**Внешний доступ:** Отключён по умолчанию. Для включения:
```bash
./setup.sh  # Выберите опцию настройки PostgreSQL
# Укажите разрешённый IP адрес (не 0.0.0.0!)
```

### Секреты

Все пароли и токены хранятся в `.env` файле:
```bash
# Проверить права доступа
ls -la /opt/budget/.env
# Должно быть: -rw-r----- (640)
# Владелец: read/write, Группа: read, Остальные: нет доступа

# При необходимости исправить права:
chmod 640 /opt/budget/.env
```

**ВАЖНО:**
- Никогда не коммитьте `.env` в git!
- Права 640 позволяют владельцу писать, группе (docker) читать
- Это необходимо для работы deploy.sh

---

## Troubleshooting

### Ошибка: "Pool overlaps with other one on this address space"

**Решение:** Используйте новую функцию очистки и автоматического подбора подсетей:
```bash
./deploy.sh
# Выберите опцию [2] для безопасной очистки старых сетей
# Автоматически будут выбраны свободные подсети
```

### Ошибка: "Docker daemon is not running"

**Решение:**
```bash
# Запустить Docker
sudo systemctl start docker

# Проверить статус
sudo systemctl status docker
```

### Ошибка: "permission denied" при docker команде

**Решение:**
```bash
# Обновить группы
newgrp docker

# Или выйти и войти заново
exit
ssh user@server
```

### Ошибка: "Permission denied" при чтении .env в deploy.sh

**Причина:** deploy.sh запущен от другого пользователя чем setup.sh, либо неправильные права на .env файл.

**Решение:**
```bash
# 1. Проверить текущего пользователя
whoami

# 2. Проверить владельца .env
ls -la /opt/budget/.env

# 3. Исправить права (если нужно)
chmod 640 /opt/budget/.env

# 4. Убедиться что вы в группе docker
groups | grep docker

# 5. Запустить deploy.sh от того же пользователя что и setup.sh
./deploy.sh
```

**Важно:** НЕ используйте sudo для deploy.sh - запускайте от обычного пользователя!

### Контейнер постоянно перезапускается

**Диагностика:**
```bash
# Проверить логи
docker compose logs -f <service-name>

# Проверить статус
docker compose ps

# Проверить health check
docker inspect <container-name> | grep Health -A 10
```

### База данных не инициализируется

**Решение:**
```bash
# Проверить права на директорию
ls -la /opt/budget/data/postgres

# Проверить логи PostgreSQL
docker compose logs postgres

# Если нужно пересоздать (УДАЛИТ ДАННЫЕ!):
./deploy.sh --clean
```

### SSL сертификат не получается

**Проверки:**
1. Домен доступен из интернета (DNS настроен)
2. Порт 80 открыт (UFW и роутер)
3. Nginx запущен
4. `.env` содержит `LETSENCRYPT_EMAIL`

**Ручное получение:**
```bash
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your@email.com \
  --agree-tos \
  -d your-domain.com
```

---

## Бэкапы

### Ручной бэкап БД

```bash
# Создать бэкап
docker compose exec postgres pg_dump -U familybudget familybudget > /opt/budget/backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Или использовать pg_dumpall для всех БД
docker compose exec postgres pg_dumpall -U familybudget > /opt/budget/backups/full_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Восстановление из бэкапа

```bash
# Остановить backend
docker compose stop backend bot

# Восстановить бэкап
cat /opt/budget/backups/backup_20251016.sql | docker compose exec -T postgres psql -U familybudget familybudget

# Запустить backend
docker compose start backend bot
```

### Автоматические бэкапы

TODO: Настроить cron для автоматических бэкапов

---

## Дополнительная информация

- **Полная документация:** [docs/README.md](docs/README.md)
- **API документация:** [docs/api/API_DOCUMENTATION.md](docs/api/API_DOCUMENTATION.md)
- **PRD (требования):** [docs/prd/README.md](docs/prd/README.md)
- **Архитектура:** [docs/prd/03-system-architecture.md](docs/prd/03-system-architecture.md)

---

## Версия

- **Приложение:** v5.1.0
- **Документация:** v1.0.0
- **Дата обновления:** 2025-10-16
