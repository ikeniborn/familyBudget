# Troubleshooting: Certbot Health Check Timeout

**Проблема:** При деплое с профилем `full`, контейнер `certbot` не проходит health check и через 120 секунд выдается ошибка.

**Симптомы:**
```
[INFO] Waiting for certbot to be healthy (max 120s)...
........................[ERROR] certbot failed to become healthy within 120s
```

**Статус:** ✅ РЕШЕНО (версия 4.4.0+)

---

## Анализ проблемы

### Корневая причина

В `docker-compose.yml` для сервиса `certbot` **отсутствовала** секция `healthcheck`:

```yaml
certbot:
  image: certbot/certbot
  container_name: familybudget-certbot
  volumes:
    - ./certbot/conf:/etc/letsencrypt
    - ./certbot/www:/var/www/certbot
  entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
  networks:
    - familybudget_external
  profiles:
    - full
  # ❌ НЕТ healthcheck!
```

### Почему это проблема?

1. **Скрипт deploy.sh ожидает healthcheck:**
   - Функция `wait_for_service()` в `deploy.sh:616-660` проверяет статус контейнера
   - Для контейнеров без healthcheck возвращается статус `none`
   - Скрипт считает это нормальным и проверяет, запущен ли контейнер
   - НО: из-за особенностей entrypoint certbot, контейнер может быть в состоянии `starting` или `restarting`

2. **Certbot работает в режиме renewal:**
   - Entrypoint запускает бесконечный цикл: `certbot renew; sleep 12h`
   - Если сертификаты не требуют обновления, certbot просто выводит "No renewals were attempted"
   - Контейнер продолжает работать, но без healthcheck невозможно определить его готовность

3. **Дополнительные проблемы:**
   - В логах обнаружены старые сертификаты от другого проекта (`proxy-dev.ikeniborn.ru`)
   - В `.env` был установлен `DOMAIN=localhost`, что неправильно для продакшн
   - Отсутствовали переменные `SSL_TYPE`, `LETSENCRYPT_EMAIL`, `DEPLOYMENT_PROFILE`

---

## Решение

### 1. Добавлен healthcheck для certbot

**Изменения в `docker-compose.yml`:**

```yaml
certbot:
  image: certbot/certbot
  container_name: familybudget-certbot
  volumes:
    - ./certbot/conf:/etc/letsencrypt
    - ./certbot/www:/var/www/certbot
  entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
  networks:
    - familybudget_external
  profiles:
    - full
  healthcheck:                                        # ✅ ДОБАВЛЕНО
    test: ["CMD", "certbot", "certificates", "--quiet"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 10s
```

**Как работает healthcheck:**
- Команда `certbot certificates --quiet` проверяет конфигурацию certbot
- Exit code 0 = healthy (certbot работает корректно)
- Exit code 1 = unhealthy (проблемы с конфигурацией)

### 2. Обновлена конфигурация .env

**Добавлены комментарии и примеры для SSL:**

```env
# Domain Configuration
# For local development: use localhost
# For production: specify your domain (e.g., budget.ikeniborn.ru)
DOMAIN=localhost

# SSL Configuration (for production deployment with Let's Encrypt)
# Uncomment and configure for production with SSL:
# SSL_TYPE=letsencrypt
# LETSENCRYPT_EMAIL=ikeniborn@gmail.com
# DEPLOYMENT_PROFILE=full
#
# Options for SSL_TYPE:
#   - none: No SSL (localhost development)
#   - selfsigned: Self-signed certificates
#   - letsencrypt: Automatic SSL from Let's Encrypt (requires domain)
```

### 3. Создан скрипт очистки старых сертификатов

**Скрипт:** `scripts/clean_old_certificates.sh`

**Использование:**
```bash
./scripts/clean_old_certificates.sh
```

**Что делает:**
- Показывает текущие сертификаты в `certbot/conf/`
- Спрашивает подтверждение (требует ввести `DELETE`)
- Удаляет все старые сертификаты и конфигурации
- Опционально очищает сертификаты в host-системе (`/etc/letsencrypt/`)

---

## Пошаговая инструкция по исправлению

### Для локальной разработки (без SSL)

1. Убедитесь, что в `.env`:
   ```env
   DOMAIN=localhost
   # SSL_TYPE=none (или закомментировано)
   ```

2. Деплой без certbot:
   ```bash
   ./deploy.sh --build  # без профиля full
   ```

### Для продакшн с Let's Encrypt SSL

1. **Очистите старые сертификаты:**
   ```bash
   ./scripts/clean_old_certificates.sh
   # Введите DELETE для подтверждения
   ```

2. **Настройте `.env` для продакшн:**
   ```env
   DOMAIN=budget.ikeniborn.ru         # ваш домен
   SSL_TYPE=letsencrypt
   LETSENCRYPT_EMAIL=your@email.com
   DEPLOYMENT_PROFILE=full
   ```

3. **Убедитесь, что DNS настроен:**
   ```bash
   nslookup budget.ikeniborn.ru
   # Должен показать IP вашего сервера
   ```

4. **Деплой с полным профилем:**
   ```bash
   ./deploy.sh --build --profile full
   ```

5. **Проверьте статус сервисов:**
   ```bash
   docker ps
   # Все контейнеры должны быть healthy

   docker logs familybudget-certbot
   # Должны быть записи о получении/обновлении сертификата
   ```

---

## Проверка решения

### Тест 1: Health check работает

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

**Ожидаемый результат:**
```
NAMES                   STATUS
familybudget-nginx      Up 5 minutes (healthy)
familybudget-certbot    Up 5 minutes (healthy)    # ✅ healthy!
familybudget-bot        Up 5 minutes (healthy)
familybudget-backend    Up 5 minutes (healthy)
familybudget-postgres   Up 5 minutes (healthy)
```

### Тест 2: Deploy.sh завершается успешно

```bash
./deploy.sh --build --profile full
```

**Ожидаемый результат:**
```
[SUCCESS] backend is healthy
[SUCCESS] bot is healthy
[SUCCESS] certbot is healthy          # ✅ Нет таймаута!
[SUCCESS] nginx is healthy
[SUCCESS] postgres is healthy
[SUCCESS] All services are healthy
```

### Тест 3: Certbot получил сертификат

```bash
docker exec familybudget-certbot certbot certificates
```

**Ожидаемый результат:**
```
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Found the following certs:
  Certificate Name: budget.ikeniborn.ru
    Domains: budget.ikeniborn.ru
    Expiry Date: 2026-01-XX XX:XX:XX+00:00 (VALID: 89 days)
    Certificate Path: /etc/letsencrypt/live/budget.ikeniborn.ru/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/budget.ikeniborn.ru/privkey.pem
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
```

---

## Дополнительные ресурсы

- **Логи certbot:** `docker logs familybudget-certbot`
- **Логи deploy:** `./logs/deploy.log`
- **Docker compose документация:** [Health checks](https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck)
- **Certbot документация:** [Using Certbot](https://eff-certbot.readthedocs.io/)

---

## История изменений

| Дата       | Версия | Изменения                                    |
|------------|--------|----------------------------------------------|
| 2025-10-16 | 4.4.0  | ✅ Добавлен healthcheck для certbot          |
| 2025-10-16 | 4.4.0  | ✅ Создан скрипт scripts/clean_old_certificates.sh   |
| 2025-10-16 | 4.4.0  | ✅ Обновлена документация .env для SSL       |
| 2025-10-17 | 4.5.0  | ✅ Исправлено зависание при получении сертификата (--entrypoint fix) |
| 2025-10-17 | 5.0.0  | ✅ ПОЛНОЕ РЕШЕНИЕ: Переход на host-based certbot (scripts/ssl_certificate_manager.sh) |

---

## Известные проблемы и решения

### Проблема: Зависание при получении сертификата (140+ секунд)

**Дата обнаружения:** 2025-10-17
**Версия:** 4.5.0+
**Статус:** ✅ ИСПРАВЛЕНО

**Симптомы:**
- Команда `./deploy.sh --profile full` зависает на этапе получения SSL сертификата
- В логах появляется сообщение `No renewals were attempted.`
- Зависание длится 140+ секунд (до timeout или Ctrl+C)
- Сертификат не создается

**Причина:**

Docker Compose entrypoint контейнера certbot переопределяет команду `certbot certonly`.

**docker-compose.yml строка 238:**
```yaml
entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
```

**Что происходит:**
1. deploy.sh запускает: `docker compose run --rm certbot certonly --webroot ...`
2. Docker использует entrypoint из docker-compose.yml
3. Выполняется `certbot renew` (а не `certbot certonly`!)
4. `certbot renew` не находит сертификатов → "No renewals were attempted"
5. Запускается `sleep 12h` → зависание

**Решение:**

В deploy.sh (строка 782) добавлен флаг `--entrypoint ""` для переопределения entrypoint:

```bash
compose_cmd run --rm --entrypoint "" certbot certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$email" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d "$domain"
```

**Результат:**
- ✅ Получение сертификата работает корректно
- ✅ Время выполнения: ~10-30 секунд (вместо 140+)
- ✅ Правильная команда: `certbot certonly` (а не `certbot renew`)

---

## FAQ

**Q: Почему certbot без healthcheck работал в других проектах?**
A: Вероятно, в других проектах либо не использовался скрипт `deploy.sh` с проверкой health, либо certbot не был включен в профиль, который запускается автоматически.

**Q: Можно ли использовать другую команду для healthcheck?**
A: Да, альтернативы:
- `certbot renew --dry-run --quiet` (медленнее, но тестирует полную конфигурацию)
- `test -f /etc/letsencrypt/live/*/fullchain.pem` (просто проверяет наличие файла)

**Q: Что если я хочу деплоить без certbot?**
A: Просто не используйте профиль `full`:
```bash
./deploy.sh --build  # только postgres + backend
```

**Q: Certbot всё еще не становится healthy, что делать?**
A: Проверьте:
1. Логи: `docker logs familybudget-certbot`
2. Работает ли контейнер: `docker ps -a | grep certbot`
3. Ошибки healthcheck: `docker inspect familybudget-certbot | grep -A 10 Health`

---

## ПОЛНОЕ РЕШЕНИЕ (v5.0.0) - Host-Based Certbot

**Дата:** 2025-10-17
**Статус:** ✅ ОКОНЧАТЕЛЬНОЕ РЕШЕНИЕ
**Версия:** 5.0.0+

### Проблема

Все предыдущие попытки исправить Docker-based certbot (healthcheck, --entrypoint fix) решали симптомы, но не устраняли корневую причину:
- Сложность управления Docker entrypoint
- Зависание при получении сертификатов
- Проблемы с webroot mode и nginx взаимодействием
- Необходимость временных хаков и workarounds

### Окончательное решение: Certbot на хосте

**Архитектурное решение:**
1. **Удалён** сервис `certbot` из `docker-compose.yml`
2. **Установлен** certbot напрямую на хост-систему
3. **Создан** `scripts/ssl_certificate_manager.sh` для управления сертификатами
4. **Сертификаты** хранятся в `/etc/letsencrypt/` на хосте
5. **Nginx** монтирует `/etc/letsencrypt/` как read-only volume
6. **Автообновление** через cron (дважды в день)

### Преимущества нового подхода

✅ **Простота:**
- Нет Docker entrypoint конфликтов
- Стандартный certbot workflow
- Понятная отладка (логи в /var/log/letsencrypt/)

✅ **Надёжность:**
- Проверенный паттерн (из проекта VLESS v4.2)
- Standalone mode (HTTP-01 challenge)
- Автоматическое управление UFW firewall
- Graceful nginx stop/start

✅ **Поддерживаемость:**
- DNS валидация перед получением сертификата
- Deploy hook для автоматического перезапуска nginx
- Централизованное управление через один скрипт
- Стандартные команды certbot доступны

### Новая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│ HOST SYSTEM                                                  │
│                                                              │
│  /etc/letsencrypt/                                          │
│  ├── live/                                                  │
│  │   └── budget.example.com/                               │
│  │       ├── fullchain.pem                                  │
│  │       └── privkey.pem                                    │
│  └── renewal/                                               │
│      └── budget.example.com.conf                            │
│                                                              │
│  /usr/local/bin/familybudget-cert-renew  (deploy hook)     │
│  /etc/cron.d/familybudget-certbot-renew  (auto-renewal)    │
│                                                              │
│  scripts/ssl_certificate_manager.sh  (management script)    │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │ Docker Container: nginx                        │         │
│  │                                                │         │
│  │  Volume mount:                                 │         │
│  │  /etc/letsencrypt:/etc/letsencrypt:ro         │         │
│  │                                                │         │
│  │  → Reads certificates from host                │         │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Использование

#### Первоначальное получение сертификата

```bash
# Через deploy.sh (автоматически)
./deploy.sh --build --profile full

# Или вручную
sudo ./scripts/ssl_certificate_manager.sh obtain budget.example.com admin@example.com 1.2.3.4
```

#### Управление сертификатами

```bash
# Проверить статус
sudo ./scripts/ssl_certificate_manager.sh check budget.example.com

# Обновить сертификат
sudo ./scripts/ssl_certificate_manager.sh renew budget.example.com

# Настроить автообновление
sudo ./scripts/ssl_certificate_manager.sh setup-cron

# Удалить сертификат
sudo ./scripts/ssl_certificate_manager.sh cleanup budget.example.com
```

#### Автообновление

Cron job создаётся автоматически:

```bash
# /etc/cron.d/familybudget-certbot-renew
0 0,12 * * * root certbot renew --quiet --deploy-hook "/usr/local/bin/familybudget-cert-renew"
```

**Как работает:**
1. Дважды в день (00:00 и 12:00 UTC) запускается `certbot renew`
2. Certbot проверяет срок действия сертификата
3. Если < 30 дней до истечения → обновление
4. После успешного обновления вызывается deploy hook
5. Deploy hook перезагружает nginx в Docker контейнере

### Изменения в кодовой базе

**docker-compose.yml:**
- Удалён сервис `certbot`
- Обновлён volume для nginx: `/etc/letsencrypt:/etc/letsencrypt:ro`

**deploy.sh:**
- Функция `setup_ssl_certificates()` переписана для использования `ssl_certificate_manager.sh`
- Добавлена автодетекция SERVER_IP
- Улучшена обработка ошибок

**Новые файлы:**
- `scripts/ssl_certificate_manager.sh` - главный скрипт управления
- `/usr/local/bin/familybudget-cert-renew` - deploy hook (создаётся автоматически)
- `/etc/cron.d/familybudget-certbot-renew` - cron job (создаётся автоматически)

### Миграция с Docker-based certbot

Если у вас уже были сертификаты в Docker контейнере:

```bash
# 1. Скопировать существующие сертификаты на хост (если нужно)
sudo cp -r ./certbot/conf/* /etc/letsencrypt/

# 2. Удалить старые Docker volumes certbot
docker volume rm familybudget_certbot_conf 2>/dev/null || true
docker volume rm familybudget_certbot_www 2>/dev/null || true

# 3. Удалить старые директории (опционально)
rm -rf ./certbot/

# 4. Переdeploить с новой версией
./deploy.sh --build --profile full
```

### Проверка работоспособности

```bash
# 1. Проверить certbot на хосте
certbot certificates

# 2. Проверить nginx mount
docker exec familybudget-nginx ls -la /etc/letsencrypt/live/

# 3. Проверить cron job
sudo cat /etc/cron.d/familybudget-certbot-renew

# 4. Проверить deploy hook
sudo cat /usr/local/bin/familybudget-cert-renew

# 5. Тест обновления (dry-run)
sudo certbot renew --dry-run

# 6. Проверить HTTPS
curl -I https://budget.example.com/health
```

### Troubleshooting

**Проблема:** DNS не резолвится
```bash
# Проверка
dig +short budget.example.com

# Решение: Настроить DNS A-record
```

**Проблема:** Port 80 занят
```bash
# Проверка
sudo ss -tulnp | grep :80

# Решение: ssl_certificate_manager.sh автоматически останавливает nginx
```

**Проблема:** Firewall блокирует порт 80
```bash
# Проверка
sudo ufw status | grep 80

# Решение: ssl_certificate_manager.sh автоматически управляет UFW
```

**Проблема:** Certbot не установлен
```bash
# Решение
sudo ./scripts/ssl_certificate_manager.sh install
```

### FAQ

**Q: Почему переход на host-based решение?**
A: Docker-based подход имел фундаментальные проблемы с entrypoint конфликтами. Host-based - проверенный индустриальный стандарт.

**Q: Безопасно ли монтировать /etc/letsencrypt/ в контейнер?**
A: Да, монтирование в режиме read-only (`:ro`) безопасно и является стандартной практикой.

**Q: Что если у меня уже есть другие certbot сертификаты на хосте?**
A: Никаких конфликтов, certbot управляет несколькими доменами независимо.

**Q: Будет ли работать автообновление?**
A: Да, cron job создаётся автоматически при первом получении сертификата.

**Q: Что если nginx контейнер перезапустится?**
A: Сертификаты на хосте, nginx просто перечитает их при старте.

---

**ИТОГ:** Версия 5.0.0 полностью решает все проблемы с SSL сертификатами, используя простой и надёжный host-based подход. Все предыдущие workarounds (healthcheck, --entrypoint) больше не нужны.
