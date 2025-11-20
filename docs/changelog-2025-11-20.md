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

## Итого

**Категории:**
- 🐛 Bug Fixes: 1
- 🔒 Security: 2
- 🔧 Infrastructure: 1
- 📝 Documentation: 1

**Всего изменений:** 5

**Файлы изменены:**
1. frontend/web/static/css/calendar-widget.css
2. nginx/conf.d/app.conf
3. docker-compose.yml
4. scripts/lib/firewall.sh
5. CLAUDE.md

**Branch:** feature/calendar-responsive-security-fixes

**Статус:** Готово к merge в dev после тестирования
