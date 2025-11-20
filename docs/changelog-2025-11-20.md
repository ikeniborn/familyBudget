# Changelog - 2025-11-20

## Bug Fixes

### 🐛 Исправлен overflow календаря на мобильных устройствах

**Изменения:**
- Добавлены ограничения max-width/min-width для селекторов месяца и года
- Добавлен min-width для кнопок дат (обеспечивает квадратные кнопки 40x40px)
- Уменьшен gap между элементами header на мобильных устройствах (8px → 4px)
- Улучшена адаптивность на экранах < 768px

**Влияние на пользователей:**
Календарь в фильтре "Произвольный период" (страница аналитики) теперь корректно отображается на мобильных устройствах. Header с выбором месяца/года и навигационными стрелками больше не выходит за границы контейнера. Кнопки дат имеют квадратную форму, не узкие прямоугольники.

**Технические детали:**
- Файлы: `frontend/web/static/css/calendar-widget.css`
- Задача: Calendar widget mobile display issue (screenshot analysis)
- Commits: [первый коммит feature/calendar-responsive-security-fixes]
- Версия: v5.1.4

**Breaking Changes:** Нет

---

## Infrastructure

### 🔒 SEC-004: Включен HSTS header для production

**Изменения:**
- Раскомментирован заголовок Strict-Transport-Security в Nginx конфигурации
- Установлен max-age=31536000 (1 год) + includeSubDomains
- Соответствует индустриальному стандарту для production HTTPS

**Влияние на пользователей:**
Браузеры будут автоматически перенаправлять все HTTP запросы на HTTPS в течение 1 года после первого посещения. Повышенная безопасность от MITM атак и случайных HTTP подключений.

**Технические детали:**
- Файлы: `nginx/conf.d/app.conf` (line 62)
- Аудит: docs/security-audit-report.md SEC-004 (CVSS 4.3 Medium)
- PRD: NFR-004 (Security Requirements)
- Commits: [security коммит feature/calendar-responsive-security-fixes]
- Версия: v5.1.4

**Breaking Changes:** Нет (SSL уже работает, HSTS только усиливает)

---

### 🔒 SEC-005: Исправлена ошибка PostgreSQL logical replication

**Изменения:**
- Добавлен явный параметр `wal_level=replica` в docker-compose.yml
- Устраняет ошибку "ERROR: could not access file "pg_logical/snapshots/..."" в логах
- PostgreSQL теперь корректно инициализирует директорию snapshots

**Влияние на пользователей:**
Устранены ошибки в логах PostgreSQL. Улучшена стабильность БД при запуске и работе.

**Технические детали:**
- Файлы: `docker-compose.yml` (lines 77-78)
- Аудит: docs/security-audit-report.md SEC-005 (CVSS 3.1 Low)
- Commits: [security коммит feature/calendar-responsive-security-fixes]
- Версия: v5.1.4

**Breaking Changes:** Нет (изменение только внутренней конфигурации PostgreSQL)

---

### 🔧 Добавлена функция validate_ufw_rules() для проверки firewall

**Изменения:**
- Новая функция validate_ufw_rules() в scripts/lib/firewall.sh
- Автоматическая проверка UFW конфигурации при deploy
- Проверяет: default policies, required ports (22, 443), PostgreSQL access, backend port protection

**Влияние на пользователей:**
Отсутствие прямого влияния. Повышенная уверенность в корректности firewall правил при каждом деплое.

**Технические детали:**
- Файлы: `scripts/lib/firewall.sh` (lines 62-153)
- Аудит: docs/security-audit-report.md (UFW validation improvement)
- PRD: NFR-004 (UFW firewall requirements)
- Commits: [security коммит feature/calendar-responsive-security-fixes]
- Версия: v5.1.4

**Проверки:**
- ✓ UFW активен (Status: active)
- ✓ Default incoming: DENY
- ✓ Default outgoing: ALLOW
- ✓ SSH port 22: ALLOWED
- ✓ HTTPS port 443: ALLOWED
- ✓ HTTP port 80: опционально (для Let's Encrypt)
- ✓ PostgreSQL 5432: consistency check (POSTGRES_EXTERNAL_ACCESS env vs UFW rules)
- ✓ Backend 8000: защищён UFW (не должен быть ALLOW IN)

**Breaking Changes:** Нет

---

## Documentation

### 📝 Обновлена документация CLAUDE.md

**Изменения:**
- Добавлен раздел "CalendarWidget Mobile Display Issues" в Troubleshooting
- Добавлен раздел "UFW Firewall Validation" в Troubleshooting
- Описаны симптомы, причины, решения и процедуры тестирования

**Влияние на пользователей:**
Нет прямого влияния. Упрощена диагностика проблем для разработчиков и деплоя.

**Технические детали:**
- Файлы: `CLAUDE.md` (раздел "🔧 Troubleshooting")
- Commits: [docs коммит feature/calendar-responsive-security-fixes]
- Версия: v5.1.4

**Breaking Changes:** Нет

---

## Security (CRITICAL)

### 🚨 SEC-006: Docker bypassing UFW firewall - порты 5432 и 8000 открыты для всех

**Изменения:**
- Добавлена функция `configure_docker_firewall()` в scripts/lib/firewall.sh
- Использует DOCKER-USER iptables chain (выполняется ДО Docker DOCKER chain)
- Блокирует порт 8000 (backend) от внешнего доступа - только через Nginx
- Блокирует порт 5432 (PostgreSQL) по умолчанию
- Разрешает PostgreSQL только с IP указанного в POSTGRES_ALLOWED_IP

**Влияние на пользователей:**
**КРИТИЧЕСКОЕ ОБНОВЛЕНИЕ БЕЗОПАСНОСТИ!** До применения fix: PostgreSQL и Backend были доступны с любого IP в интернете несмотря на UFW правила. Docker обходит UFW добавляя iptables правила напрямую.

После применения: Порты 5432 и 8000 блокируются на уровне iptables DOCKER-USER chain. Доступ к PostgreSQL только с разрешённого IP (если POSTGRES_EXTERNAL_ACCESS=true).

**Применение на production:**
```bash
# 1. Настроить .env
nano /opt/budget/.env
# Добавить: POSTGRES_ALLOWED_IP=your_ip (если нужен внешний доступ)

# 2. Применить правила
cd ~/familyBudget && git pull
source scripts/lib/firewall.sh
configure_docker_firewall

# 3. Проверить
sudo iptables -L DOCKER-USER -n -v
```

**Технические детали:**
- Файлы: `scripts/lib/firewall.sh` (lines 155-226)
- Аудит: SEC-006 (CRITICAL - Docker firewall bypass)
- CVSS: 9.8 Critical (Network exposure without access control)
- OWASP: A01:2021 Broken Access Control
- Commits: [security commit feature/calendar-responsive-security-fixes]
- Версия: v5.1.4

**Важно:**
- ⚠️ Правила НЕ persistent - сбрасываются при перезапуске Docker
- Решение: Добавить в deploy.sh или создать systemd service (TODO)
- Альтернатива: Изменить docker-compose.yml port mapping на 127.0.0.1:port

**Переменные окружения:**
- `POSTGRES_EXTERNAL_ACCESS=true/false` (существующая)
- `POSTGRES_ALLOWED_IP=<IP>` (НОВАЯ - обязательна если external access enabled)

**Breaking Changes:** Нет (функция вызывается вручную, не автоматически)

---

## Bug Fixes (дополнение)

### 🐛 Исправлен min-width календаря (дополнение к основному fix)

**Изменения:**
- Добавлен `min-width: 320px` к `.calendar-widget` контейнеру
- Добавлен `min-width: 300px` для mobile (≤480px)

**Влияние на пользователей:**
Календарь больше не сжимается до 192px ширины (как было на скриншоте). Минимальная ширина 320px (desktop) и 300px (mobile).

**Технические детали:**
- Файлы: `frontend/web/static/css/calendar-widget.css` (lines 16, 112, 152)
- Дополнение к основному calendar fix
- Commits: [fix commit после основного feat commit]
- Версия: v5.1.4

**Breaking Changes:** Нет

---

## Итого

**Категории:**
- 🐛 Bug Fixes: 2 (calendar overflow + min-width)
- 🚨 Security (CRITICAL): 3 (SEC-004, SEC-005, SEC-006)
- 🔧 Infrastructure: 1 (UFW validation)
- 📝 Documentation: 2 (CLAUDE.md troubleshooting + Docker firewall)

**Всего изменений:** 8

**Файлы изменены:**
1. frontend/web/static/css/calendar-widget.css
2. nginx/conf.d/app.conf
3. docker-compose.yml
4. scripts/lib/firewall.sh
5. CLAUDE.md

**Branch:** feature/calendar-responsive-security-fixes

**Статус:** Готово к merge в dev после тестирования
