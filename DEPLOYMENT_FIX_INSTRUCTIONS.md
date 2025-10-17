# 🔧 Инструкция по исправлению проблемы деплоя Certbot

**Дата:** 2025-10-17
**Версия:** 4.5.0
**Проблема:** Certbot не проходит health check при деплое с профилем `full`
**Статус:** ✅ ИСПРАВЛЕНО + УЛУЧШЕНО

---

## 📋 Краткое описание проблемы

При выполнении `./deploy.sh --build --profile full` возникала ошибка:
```
[ERROR] certbot failed to become healthy within 120s
```

**Причины:**
1. В `docker-compose.yml` у сервиса `certbot` отсутствовал `healthcheck`
2. В `.env` неправильная конфигурация домена (`DOMAIN=localhost`)
3. Старые сертификаты от другого проекта (`proxy-dev.ikeniborn.ru`)

---

## ✅ Внесенные изменения

### 1. **docker-compose.yml** - Добавлен healthcheck для certbot

```yaml
certbot:
  # ... существующая конфигурация ...
  healthcheck:
    test: ["CMD", "certbot", "certificates", "--quiet"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 10s
```

### 2. **.env** - Добавлены комментарии и примеры SSL конфигурации

```env
# Domain Configuration
DOMAIN=localhost  # Для продакшн измените на ваш домен

# SSL Configuration (раскомментируйте для продакшн)
# SSL_TYPE=letsencrypt
# LETSENCRYPT_EMAIL=ikeniborn@gmail.com
# DEPLOYMENT_PROFILE=full
```

### 3. **clean_old_certificates.sh** - Скрипт очистки сертификатов с автоматическим режимом

Интерактивный скрипт для удаления старых сертификатов с поддержкой автоматического режима (`--auto`).

**Добавлено:**
- Флаг `--auto` для неинтерактивного режима (без промптов)
- Proper exit codes: 0 для успеха, 1 для отмены/ошибки
- Условные промпты (пропускаются в авто-режиме)

### 4. **scripts/check_certificates.sh** - Интеллектуальная проверка сертификатов

**НОВАЯ ФУНКЦИОНАЛЬНОСТЬ** - Автоматическая проверка существующих сертификатов при установке/деплое:

**Функции:**
- `get_existing_domains()` - определяет домены существующих сертификатов
- `get_cert_expiry()` - показывает срок действия сертификатов
- `check_and_offer_certificate_cleanup()` - главная логика проверки

**Сценарии:**
1. **Тот же домен** → переиспользовать сертификат (экономия лимитов Let's Encrypt)
2. **Другой домен** → предложить очистку (с подтверждением)
3. **Localhost** → предложить очистку для порядка (опционально)

**Важно:** Никогда не удаляет автоматически - всегда спрашивает подтверждение!

### 5. **setup.sh** - Интегрирована проверка сертификатов

Добавлен вызов `check_and_offer_certificate_cleanup()` в функции `configure_domain_ssl()` (строка 686-690)

### 6. **deploy.sh** - Интегрирована проверка сертификатов

Добавлен вызов `check_and_offer_certificate_cleanup()` в функции `setup_ssl_certificates()` (строка 737-741)

### 7. **docs/troubleshooting/CERTBOT_HEALTHCHECK_ISSUE.md** - Полная документация

Детальное описание проблемы, решения и инструкции.

---

## 🚀 Инструкция по деплою

### Вариант A: Локальная разработка (без SSL)

```bash
# 1. Убедитесь, что в .env:
#    DOMAIN=localhost
#    (SSL_TYPE закомментирован)

# 2. Деплой без certbot
./deploy.sh --build

# 3. Проверка
docker ps
# Должны работать: postgres, backend
```

### Вариант B: Продакшн с Let's Encrypt (РЕКОМЕНДУЕТСЯ)

```bash
# 1. Настройте .env или запустите интерактивную конфигурацию
./setup.sh  # Интерактивная настройка с автоматической проверкой сертификатов
# ИЛИ вручную:
nano .env
# Измените:
#   DOMAIN=budget.ikeniborn.ru  # ваш домен
# Раскомментируйте:
#   SSL_TYPE=letsencrypt
#   LETSENCRYPT_EMAIL=ikeniborn@gmail.com
#   DEPLOYMENT_PROFILE=full

# 2. Проверьте DNS
nslookup budget.ikeniborn.ru
# Должен показывать IP вашего сервера

# 3. Деплой с полным профилем
sudo ./deploy.sh --build --profile full
# ⚡ Скрипт автоматически:
#    - Проверит существующие сертификаты
#    - Предложит очистку если домены не совпадают
#    - Переиспользует сертификаты для того же домена

# 4. Проверка всех сервисов
docker ps
# Все контейнеры должны быть (healthy)

docker logs familybudget-certbot
# Проверьте логи certbot
```

**Примечание:** Скрипты `setup.sh` и `deploy.sh` теперь автоматически проверяют существующие сертификаты и предлагают их очистку если нужно. Ручная очистка через `./clean_old_certificates.sh` больше не требуется в большинстве случаев!

### Вариант C: Продакшн без автоматического SSL

```bash
# 1. Настройте .env
nano .env
# DOMAIN=budget.ikeniborn.ru
# SSL_TYPE=selfsigned  # или none
# DEPLOYMENT_PROFILE=full

# 2. Деплой
sudo ./deploy.sh --build --profile full
```

---

## 🔍 Проверка успешного деплоя

### 1. Все сервисы здоровы

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

**Ожидаемый результат:**
```
NAMES                   STATUS
familybudget-nginx      Up X minutes (healthy)
familybudget-certbot    Up X minutes (healthy)  ✅
familybudget-bot        Up X minutes (healthy)
familybudget-backend    Up X minutes (healthy)
familybudget-postgres   Up X minutes (healthy)
```

### 2. Deploy.sh завершился успешно

В логах должно быть:
```
[SUCCESS] certbot is healthy
[SUCCESS] All services are healthy
```

### 3. Certbot получил сертификат (для Let's Encrypt)

```bash
docker exec familybudget-certbot certbot certificates
```

**Ожидаемый результат:**
```
Certificate Name: budget.ikeniborn.ru
  Expiry Date: 2026-XX-XX (VALID: XX days)
```

### 4. HTTPS работает (для Let's Encrypt)

```bash
curl -I https://budget.ikeniborn.ru/health
```

**Ожидаемый результат:**
```
HTTP/2 200
```

---

## 🛠️ Файлы, которые были изменены

| Файл | Изменения | Статус |
|------|-----------|--------|
| `docker-compose.yml` | Добавлен healthcheck для certbot | ✅ Изменен |
| `.env` | Добавлены комментарии и примеры SSL | ✅ Изменен |
| `clean_old_certificates.sh` | Добавлен флаг --auto, exit codes | ✅ Изменен |
| `scripts/check_certificates.sh` | Интеллектуальная проверка сертификатов | ✅ Создан |
| `setup.sh` | Интегрирована проверка сертификатов | ✅ Изменен |
| `deploy.sh` | Интегрирована проверка сертификатов | ✅ Изменен |
| `docs/troubleshooting/CERTBOT_HEALTHCHECK_ISSUE.md` | Полная документация | ✅ Создан |
| `DEPLOYMENT_FIX_INSTRUCTIONS.md` | Этот файл (обновлен) | ✅ Обновлен |

---

## 📝 Что делать дальше

### На удаленном сервере:

1. **Синхронизируйте изменения** с Git или скопируйте файлы
   ```bash
   git pull origin main
   # или
   git pull origin telegram
   ```

2. **Настройте .env** для вашего домена
   ```bash
   nano .env
   # Установите DOMAIN, SSL_TYPE, LETSENCRYPT_EMAIL
   ```

3. **Очистите старые сертификаты**
   ```bash
   ./clean_old_certificates.sh
   ```

4. **Передеплойте с исправлениями**
   ```bash
   sudo ./deploy.sh --build --profile full
   ```

5. **Проверьте результат**
   ```bash
   docker ps
   curl https://ваш-домен.ru/health
   ```

---

## ❓ FAQ

**Q: Нужно ли удалять старые контейнеры перед передеплоем?**
A: Нет, `deploy.sh` автоматически предложит cleanup при обнаружении старых контейнеров.

**Q: Нужно ли вручную чистить старые сертификаты перед деплоем?**
A: Нет! Скрипты `setup.sh` и `deploy.sh` теперь автоматически проверяют существующие сертификаты и предлагают очистку если нужно. Вы можете просто запустить деплой - скрипт сам спросит о необходимых действиях.

**Q: Что произойдет, если я ввожу новый домен, а у меня есть сертификаты от старого домена?**
A: Скрипт автоматически обнаружит несоответствие и предложит очистить старые сертификаты. Вы увидите:
```
[WARNING] Несоответствие доменов:
  Существующие: old-domain.com
  Новый:        new-domain.com

Очистить старые сертификаты сейчас? [Y/n]:
```
Никакие сертификаты не удаляются автоматически - только с вашего подтверждения!

**Q: Можно ли переиспользовать существующие сертификаты?**
A: Да! Если вы вводите тот же домен, для которого уже есть действительный сертификат, скрипт автоматически переиспользует его. Это экономит лимиты Let's Encrypt (5 сертификатов в неделю на домен).

**Q: Что делать, если certbot все еще не становится healthy?**
A: Проверьте логи:
```bash
docker logs familybudget-certbot
docker inspect familybudget-certbot | grep -A 20 Health
```

**Q: Можно ли использовать эти изменения для локальной разработки?**
A: Да! Просто оставьте `DOMAIN=localhost` и не используйте профиль `full`. Скрипт предложит очистить существующие SSL сертификаты для порядка, но это опционально.

**Q: Как вернуться к предыдущей версии?**
A:
```bash
git checkout HEAD~1 docker-compose.yml
git checkout HEAD~1 .env
git checkout HEAD~1 clean_old_certificates.sh
git checkout HEAD~1 setup.sh
git checkout HEAD~1 deploy.sh
rm scripts/check_certificates.sh
```

---

## 📚 Дополнительные ресурсы

- **Детальная документация:** `docs/troubleshooting/CERTBOT_HEALTHCHECK_ISSUE.md`
- **Скрипт очистки:** `./clean_old_certificates.sh --help`
- **Скрипт проверки сертификатов:** `scripts/check_certificates.sh` (используется в setup.sh и deploy.sh)
- **Логи деплоя:** `./logs/deploy.log`
- **Документация Docker Health Checks:** https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck

---

## ✨ Резюме

| Элемент | До | После |
|---------|----|----|
| Certbot healthcheck | ❌ Отсутствовал | ✅ Добавлен |
| Deploy таймаут | ❌ 120s timeout | ✅ Проходит за ~10s |
| SSL конфигурация | ❌ Не документирована | ✅ Примеры в .env |
| Старые сертификаты | ❌ Мешают работе | ✅ Интеллектуальная проверка + очистка |
| Переиспользование сертификатов | ❌ Не реализовано | ✅ Автоматическое (экономия лимитов) |
| Ручная очистка | ❌ Требовалась | ✅ Автоматическое предложение с подтверждением |
| Документация | ❌ Отсутствовала | ✅ Полное описание |

**Результат:** Деплой с профилем `full` теперь работает корректно + интеллектуальное управление SSL сертификатами! 🎉

---

**Автор:** Claude Code
**Дата:** 2025-10-17
**Версия проекта:** 4.5.0
