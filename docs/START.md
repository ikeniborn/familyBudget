# Family Budget - Quick Start Guide

Краткое руководство по развёртыванию приложения Family Budget на чистом сервере Ubuntu/Debian.

## Требования

- Ubuntu 20.04+ или Debian 11+
- Root/sudo доступ
- Интернет-соединение

## Быстрый старт (3 шага)

### 1. Установка системных зависимостей

Устанавливает Docker, Docker Compose, UFW firewall и создаёт структуру директорий.

**ВАЖНО:** Запускайте install.sh из директории репозитория!

```bash
# Клонируйте репозиторий
git clone https://github.com/yourusername/familyBudget.git ~/familyBudget
cd ~/familyBudget

# Запустите install.sh
sudo ./install.sh
```

**Что делает:**
- Устанавливает Docker Engine и Docker Compose
- Устанавливает базовые утилиты (curl, git, jq, certbot)
- Настраивает UFW firewall (SSH, HTTP, HTTPS)
- Создаёт директорию `/opt/budget` с поддиректориями
- **Копирует template файлы** (nginx, .env.example) в `/opt/budget`
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
cd ~/familyBudget
./setup.sh
```

**Что делает:**
- Проверяет наличие deployment директории и template файлов
- Создаёт `.env` файл в `/opt/budget` с настройками
- Генерирует безопасные пароли и секреты
- Настраивает PostgreSQL (порты, внешний доступ)
- Настраивает домен и SSL (опционально)
- Проверяет Telegram Bot токен

**Примечание:** Этот скрипт НЕ копирует код. Синхронизация кода происходит в deploy.sh

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

## Обновление приложения

### Workflow для обновления кода из Git

Когда в репозитории появились изменения (после git push):

```bash
# 1. Перейти в директорию репозитория (НЕ /opt/budget!)
cd ~/familyBudget   # ваша директория с git clone

# 2. Получить изменения
git pull origin main  # или другая ветка

# 3. Пересинхронизировать код в /opt/budget
./setup.sh

# 4. Применить изменения (автоматически пересоберет образы)
./deploy.sh --profile full
```

### Важно понимать

**Три директории:**
1. **Репозиторий** (например `~/familyBudget`) - исходный код, git clone
2. **Deployment** (`/opt/budget`) - рабочая копия, откуда запускаются контейнеры
3. **Docker volumes** - данные БД, логи, бэкапы (сохраняются при обновлении)

**Роль каждого скрипта:**
- `install.sh` - установка зависимостей (один раз)
- `setup.sh` - синхронизация репозиторий → /opt/budget + конфигурация .env
- `deploy.sh` - запуск/обновление контейнеров из /opt/budget

### Частые ошибки

❌ **Неправильно:**
```bash
cd /opt/budget
./setup.sh  # Копирует сам в себя - НЕ обновит код!
```

✅ **Правильно:**
```bash
cd ~/familyBudget  # Репозиторий
git pull
./setup.sh         # Скопирует в /opt/budget
./deploy.sh        # Применит изменения
```

### Изменение только конфигурации (.env)

Если нужно изменить только настройки без обновления кода:

```bash
# Вариант 1: Ручное редактирование
cd /opt/budget
nano .env
./deploy.sh --profile full

# Вариант 2: Интерактивная настройка
cd ~/familyBudget  # Репозиторий
./setup.sh         # Интерактивные вопросы
./deploy.sh
```

---

## Опции деплоя

### Базовые опции

```bash
# Базовый деплой (PostgreSQL + Backend)
sudo bash deploy.sh

# Полный деплой (+ Bot + Nginx + Certbot)
sudo bash deploy.sh --profile full

# Пересборка образов
sudo bash deploy.sh --build

# Просмотр логов в реальном времени
sudo bash deploy.sh --foreground

# Без миграций БД
sudo bash deploy.sh --no-migrate

# Показать справку
sudo bash deploy.sh --help
```

### 🔄 Режимы синхронизации (--sync-mode)

Управление синхронизацией кода из репозитория в `/opt/budget`:

| Режим | Описание | Когда использовать |
|-------|----------|-------------------|
| `mirror` | Полная зеркальная копия, удаляет лишние файлы | Первый деплой, чистая установка |
| `update` | Обновляет только изменённые файлы | Регулярные обновления (по умолчанию) |
| `clean` | Полная очистка `/opt/budget` + копирование | После крупных рефакторингов |
| `skip` | Пропускает синхронизацию | Тестирование локальных изменений |

```bash
# Примеры
sudo bash deploy.sh --sync-mode mirror    # Первый деплой
sudo bash deploy.sh --sync-mode update    # Обычное обновление
sudo bash deploy.sh --sync-mode clean     # После рефакторинга
sudo bash deploy.sh --sync-mode skip      # Без синхронизации
```

### 🧹 Режимы очистки (--cleanup-mode)

Управление очисткой Docker ресурсов:

| Режим | Описание | Данные БД |
|-------|----------|-----------|
| `skip` | Пропускает очистку | ✅ Сохраняются |
| `smart` | Удаляет контейнеры + сети, сохраняет volumes | ✅ Сохраняются |
| `full` | Удаляет ВСЁ включая volumes | ❌ **УДАЛЯЮТСЯ!** |

```bash
# Примеры
sudo bash deploy.sh --cleanup-mode skip   # Пропустить очистку
sudo bash deploy.sh --cleanup-mode smart  # Безопасная очистка
sudo bash deploy.sh --cleanup-mode full   # Полная очистка (УДАЛИТ ДАННЫЕ!)
```

⚠️ **ВНИМАНИЕ:** `--cleanup-mode full` безвозвратно удаляет все данные БД!

### 📦 Управление версиями

Автоматическое обновление версии приложения:

```bash
# Автоинкремент версии
sudo bash deploy.sh --major              # 5.3.0 → 6.0.0
sudo bash deploy.sh --minor              # 5.3.0 → 5.4.0
sudo bash deploy.sh --patch              # 5.3.0 → 5.3.1

# Установить конкретную версию
sudo bash deploy.sh --version 5.4.0

# Пропустить изменение версии
sudo bash deploy.sh --no-version
```

### 🛠 Дополнительные опции

```bash
# Повторно применить конкретную миграцию
sudo bash deploy.sh --reapply-migration abc123def

# Указать директорию репозитория
sudo bash deploy.sh --repo-dir /path/to/repo

# Чистый деплой (УДАЛЯЕТ ВСЕ ДАННЫЕ!)
sudo bash deploy.sh --clean
```

### 💡 Типичные сценарии обновления

**Обычное обновление кода:**
```bash
cd ~/familyBudget
git pull origin main
sudo bash deploy.sh --sync-mode update --profile full
```

**Обновление с пересборкой образов:**
```bash
cd ~/familyBudget
git pull origin main
sudo bash deploy.sh --build --profile full
```

**Устранение проблем с сетями Docker:**
```bash
sudo bash deploy.sh --cleanup-mode smart --profile full
```

**Полный сброс (новая установка):**
```bash
sudo bash deploy.sh --cleanup-mode full --sync-mode clean --profile full
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
- Health check: `http://localhost:8000/health`

**Full профиль:**
- Web UI: `http://your-domain` (через nginx)
- HTTPS: `https://your-domain` (если настроен SSL)
- Backend API: проксируется через nginx

**Telegram Bot:**
- Text commands: Отправьте `/start` в bot для регистрации
- Web Apps (Menu Button): Click Menu Button (≡) в чате бота → 8 interactive forms
  - Main Menu с Quick Stats
  - Add Transaction форма
  - Transaction history и filters
  - Statistics и Plan vs Fact
  - Advanced Search с CSV export

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

# Проверка Menu Button (Telegram Web Apps)
# 1. Откройте бота в Telegram
# 2. Найдите Menu Button (три горизонтальные линии возле поля ввода)
# 3. Click → откроется Web Apps интерфейс с формами
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

## Сети Docker

Приложение использует единую внутреннюю сеть:

- **familybudget** (172.28.0.0/16) - bridge network
  - Postgres (изолирован через Docker network)
  - Backend (доступ к БД через внутренний DNS)
  - Bot (доступ к Backend API)
  - Nginx (доступ к Backend для проксирования)

**Безопасность:**
- Все сервисы работают в изолированной Docker сети
- Внешний доступ только через Nginx на портах 80/443
- PostgreSQL не доступен извне (только через Docker network)
- Firewall (UFW) контролирует доступ к портам хоста

**Изменение подсети:**
Если подсеть `172.28.0.0/16` конфликтует с существующими сетями, измените в `docker-compose.yml`:
```yaml
networks:
  familybudget:
    driver: bridge
    ipam:
      config:
        - subnet: 172.XX.0.0/16  # Измените на свободную подсеть
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

### Проблемы при установке (install.sh)

**Версия 1.0.0+** включает автоматические механизмы восстановления:
- Автоматические повторные попытки с экспоненциальной задержкой
- Проверка сети перед установкой
- Подробные сообщения об ошибках с решениями

#### Ошибка: "apt-get update failed or timed out"

**Причина:** Медленная сеть, проблемы с DNS или заблокированные репозитории

**Решение 1:** Увеличить таймауты
```bash
TIMEOUT_APT_UPDATE=600 TIMEOUT_APT_INSTALL=1200 sudo -E ./install.sh
```

**Решение 2:** Проверить сеть вручную
```bash
# Проверка интернета
ping -c 3 8.8.8.8

# Проверка DNS
ping -c 3 google.com

# Проверка репозиториев
curl -I http://archive.ubuntu.com/ubuntu
```

**Решение 3:** Очистить кэш APT
```bash
sudo apt-get clean
sudo rm -rf /var/lib/apt/lists/*
sudo apt-get update
```

#### Ошибка: "npm ci failed after retries"

**Причина:** Медленная сеть, нехватка места на диске, проблемы с npm registry

**Решение 1:** Увеличить таймаут npm
```bash
TIMEOUT_NPM_INSTALL=1800 sudo -E ./install.sh
```

**Решение 2:** Проверить место на диске
```bash
df -h
# Нужно минимум 1GB свободного места для /opt/budget
```

**Решение 3:** Очистить кэш npm
```bash
npm cache clean --force
rm -rf /opt/budget/node_modules
```

#### Ошибка: "Network issues detected" при pre-flight проверке

**Причина:** Нет доступа к интернету, проблемы с DNS, заблокированы порты

**Решение 1:** Проверить настройки DNS
```bash
cat /etc/resolv.conf
# Должно быть: nameserver 8.8.8.8 или другой DNS
```

**Решение 2:** Проверить фаервол
```bash
sudo ufw status
sudo iptables -L -n | grep -E "80|443"
```

**Решение 3:** Проверить прокси (если используется)
```bash
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

#### Ошибка: "Failed to download Docker GPG key"

**Причина:** Проблемы с сертификатами, заблокирован download.docker.com

**Решение 1:** Проверить доступ к Docker репозиторию
```bash
curl -I https://download.docker.com
```

**Решение 2:** Удалить старый GPG ключ и повторить
```bash
sudo rm -f /etc/apt/keyrings/docker.gpg
sudo ./install.sh
```

#### Полный лог установки

Все ошибки записываются в лог:
```bash
tail -f /var/log/familybudget_install.log
```

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

### Ошибка: "Port 80/443 is already in use" - Certbot блокирует порт

**Симптомы:**
- При деплое ошибка "address already in use" на порту 80 или 443
- `lsof -i :80` показывает процесс `certbot`
- `systemctl status certbot.service` показывает failed или running

**Причина:** На хосте установлен standalone certbot, который конфликтует с контейнеризованным certbot в деплое.

**Автоматическое решение:**

Скрипт `deploy.sh` автоматически обнаруживает certbot и предлагает интерактивные опции:

```bash
./deploy.sh

# При обнаружении certbot на порту 80/443 вы увидите:
# [1] Остановить host certbot (временно) - рекомендуется
# [2] Отключить host certbot навсегда
# [3] Отменить деплой
```

**Умная обработка certbot:**
- Скрипт сначала пытается остановить через `systemctl stop`
- Если certbot запущен вне systemd (вручную), скрипт автоматически:
  1. Обнаруживает PID процесса
  2. Пытается graceful shutdown (SIGTERM)
  3. Ждет 3 секунды
  4. При необходимости использует принудительное завершение (SIGKILL)
- Полностью автоматически - никаких дополнительных действий не требуется

**Рекомендация:** Выберите опцию [1] для первого деплоя, чтобы проверить работу контейнеризованного certbot.

**Ручное решение (редко требуется):**

```bash
# 1. Проверить что блокирует порт
sudo lsof -i :80
sudo lsof -i :443

# 2. Проверить статус certbot
systemctl status certbot.service
systemctl status certbot.timer

# 3. Остановить host certbot (временно)
sudo systemctl stop certbot.service
sudo systemctl stop certbot.timer

# 4. Если certbot всё ещё держит порт (запущен вручную):
# Получить PID
sudo lsof -i :80 | grep certbot
# Остановить процесс
sudo kill -TERM <PID>
# Если не помогло - принудительно
sudo kill -9 <PID>

# 5. Отключить host certbot навсегда (если нужно)
sudo systemctl disable certbot.service
sudo systemctl disable certbot.timer

# 6. Продолжить деплой
./deploy.sh
```

**Примечание:** deploy.sh автоматически выполняет все эти шаги, ручное решение требуется крайне редко.

**Важные замечания:**

- **Host certbot vs Контейнерный certbot:** Этот деплой использует certbot внутри Docker контейнера. Host certbot больше не нужен.
- **Автозапуск после перезагрузки:** Если вы выбрали опцию [1] (временная остановка), `certbot.timer` может автоматически запуститься при перезагрузке. Для постоянного отключения используйте опцию [2].
- **SSL сертификаты:** Контейнеризованный certbot будет автоматически получать и обновлять SSL сертификаты через порт 80 (HTTP-01 challenge).
- **Сохранение существующих сертификатов:** Если у вас уже есть SSL сертификаты от host certbot в `/etc/letsencrypt/`, вы можете скопировать их в `/opt/budget/certbot/conf/` перед деплоем.

**Проверка после деплоя:**

```bash
# Проверить что nginx слушает на портах 80/443
docker compose ps nginx
sudo lsof -i :80
sudo lsof -i :443

# Проверить логи nginx
docker compose logs nginx

# Проверить что certbot контейнер работает
docker compose ps certbot
docker compose logs certbot
```

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
# Проверить PostgreSQL Docker volume
docker volume inspect budget_postgres_data

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

- **Архитектурная вики:** [../lat.md/](../lat.md/) — API, auth, БД, frontend, realtime, bot
- **Резервное копирование:** [BACKUP_RESTORE.md](BACKUP_RESTORE.md)

---

## Версия

- **Приложение:** см. файл `VERSION` в корне репозитория
- **Дата обновления:** 2026-06-05
