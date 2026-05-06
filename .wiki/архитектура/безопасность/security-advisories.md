---
wiki_sources: ["docs/architecture/operations/security-advisories.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["security", "CVE", "Docker", "Python", "Trivy"]
aliases: ["CVE Tracking", "Security Advisories", "trivyignore", "Vulnerability Management"]
---

# Security Advisories

Управление известными CVE-уязвимостями в зависимостях Family Budget. Все исключения отслеживаются в `.trivyignore` с обоснованием.

## Основные характеристики

### Активные CVE (по состоянию на 2026-02-03)

#### CRITICAL — требуют еженедельного мониторинга

| CVE | Пакет | Статус | Risk | Митигация |
|-----|-------|--------|------|-----------|
| CVE-2026-24515 | libexpat1 v2.5.0 | Нет фикса | MEDIUM | XML минимально используется, input validation |
| CVE-2025-13836 | Python 3.11 http.client | Нет фикса | HIGH | Rate limiting (100/min), nginx timeouts, 2GB memory limit |

#### HIGH — ежеквартальный мониторинг

| CVE | Пакет | Risk | Примечание |
|-----|-------|------|-----------|
| CVE-2025-15366 | Python 3.11 imaplib | LOW | imaplib не используется |
| CVE-2025-15367 | Python 3.11 poplib | LOW | poplib не используется |
| CVE-2025-8194 | Python 3.11 tarfile | LOW | Только xlsx/csv/json принимаются |
| CVE-2026-1299 | Python 3.11 email | MEDIUM | Email via Telegram Bot API, не stdlib email |

### Стратегия митигации CVE-2025-13836 (HTTP DoS)

Наиболее критичная уязвимость для DoS-атак через crafted HTTP requests:

```nginx
# nginx ограничения
client_body_timeout 30s;
client_max_body_size 50M;
keepalive_timeout 65s;
```

```python
# SlowAPI rate limiting
/auth/login: 5/minute
/auth/verify-2fa: 5/minute
/auth/register: 3/hour
default: 200/minute (100/minute для неаутентифицированных)
```

Docker container memory limit: 2 GB.

### Разрешённые загрузки файлов (митигация tarfile CVE)

```python
# backend/app/api/v1/endpoints/import_endpoints.py
ALLOWED_EXTENSIONS = {".xlsx", ".csv", ".json"}
```

MIME type validation обязательна. Tar файлы не принимаются никогда.

### График ревью

| Частота | Фокус | CVE |
|---------|-------|-----|
| Еженедельно (понедельник) | HIGH/CRITICAL с активной эксплуатацией | CVE-2025-13836, CVE-2026-24515, CVE-2026-1299 |
| Ежемесячно | CVE ожидающие патча | SQLite, glibc, GnuPG |
| Ежеквартально | Низкий риск | ecdsa, zlib, openldap, IMAP, POP3, tarfile |

### Upgrade Strategy

**Краткосрочная (2-4 нед):** Мониторить Debian security tracker → тестировать патч в dev → 48h soak в test → production.

**Среднесрочная (1-3 мес):**
- Python 3.12 migration (более быстрые security patches)
- Base image аудит: `gcr.io/distroless/python3-debian12`

**Долгосрочная (3-6 мес):**
- Read-only root filesystem для контейнеров
- Capability dropping
- mTLS между сервисами

### Incident Response

При эксплуатации CRITICAL уязвимости:
1. Включить aggressive rate limiting (10 req/min)
2. Заблокировать атакующие IP через Cloudflare WAF
3. Масштабировать ресурсы при DoS
4. Уведомить через Telegram alerts
5. Проанализировать: `/opt/budget/logs/app.log` + nginx access logs

## Связанные концепции

- [[аутентификация]]
- [[logging-security]]
- [[ci-cd-pipeline]]
