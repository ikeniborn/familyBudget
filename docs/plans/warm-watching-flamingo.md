# Plan: Fix CI Security Scan Failure (CVE-2025-69534)

## Context

GitHub Actions run #22839387212 (Build → Push → Deploy → Test #418) завершился с ошибкой в job `security-scan` шаг "Check HIGH/CRITICAL vulnerabilities (backend)".

**Причина:** Trivy обнаружил 3 HIGH-уязвимости в backend образе `11.6.17`, которые отсутствуют в `.trivyignore`. Все 3 записи — одна CVE, применённая к 3 Python 3.11 Debian-пакетам.

**Когда появилась:** CVE-2025-69534 опубликована **2026-03-05**, Trivy DB обновился **2026-03-09** во время запуска (кеш был от 2026-03-05, но CVE в нём отсутствовала).

---

## Детали CVE-2025-69534

| Поле | Значение |
|------|----------|
| ID | CVE-2025-69534 |
| Severity | **HIGH** |
| CVSS RedHat | 8.2 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:H) |
| CVSS GHSA | 5.5 (VA:L) |
| Опубликована | 2026-03-05 |
| Затронутые пакеты | `libpython3.11-minimal`, `libpython3.11-stdlib`, `python3.11-minimal` v3.11.2-6+deb12u6 |
| Статус Debian 12 | **affected** — Debian security team ещё не выпустила DSA |
| Исправлена в | python-markdown 3.8.1 (но не в Debian 12 libpython3.11) |
| Описание | Python-Markdown 3.8: malformed HTML-like sequences вызывают `AssertionError` в `html.parser.HTMLParser`, что приводит к краху приложения (DoS) |

**Важно:** CVE относится к библиотеке **python-markdown** (PyPI), но Debian Security Tracker отслеживает её в контексте libpython3.11 пакетов. Trivy корректно подхватывает эту привязку.

---

## Анализ риска

**Ключевой факт:** библиотека `python-markdown` (Markdown) **НЕ установлена** в Docker образе:
- Не в `backend/requirements.txt`
- Не используется в коде бэкенда (проверено grep)
- python-telegram-bot использует собственный MarkdownV2, не зависящий от python-markdown

| Критерий | Оценка |
|----------|--------|
| python-markdown в requirements.txt | ❌ Отсутствует |
| python-markdown импортируется в коде | ❌ Нет |
| Фактическая уязвимая библиотека в образе | ❌ Не установлена |
| Реальный риск | **NEGLIGIBLE** — уязвимый код недоступен |
| Возможность патча | ❌ Нет (Debian 12 не выпустил DSA) |

---

## Исправление

### Файл: `.trivyignore`

Добавить запись CVE-2025-69534 строго по существующему стилю.

**Место вставки:** Новая секция после последней записи (`CVE-2026-26007`), перед `# ============================================================================ # Review Schedule`.

**Запись:**
```
# CVE-2025-69534: python-markdown DoS via malformed HTML-like sequences (HIGH)
# Status: affected in Debian 12 (bookworm) - CVE published 2026-03-05, no DSA yet
# Impact: AssertionError in html.parser.HTMLParser when parsing malformed Markdown → application crash (DoS)
# CVSS: 8.2 (RedHat) / 5.5 (GHSA)
# Package: libpython3.11-minimal, libpython3.11-stdlib, python3.11-minimal v3.11.2-6+deb12u6
# Fixed in: python-markdown 3.8.1 (not yet available in Debian 12 bookworm)
# Mitigation: Accept risk - python-markdown library is NOT installed in this image
#   - Package absent from backend/requirements.txt
#   - No import of markdown module in application code
#   - Note: if markdown is added to requirements.txt in future, pin python-markdown>=3.8.1
# Risk assessment: NEGLIGIBLE (vulnerable library not installed)
# Next review: 2026-06-09 (quarterly)
CVE-2025-69534
```

**Также обновить Review Schedule:** добавить `CVE-2025-69534` в Quarterly reviews.

---

## Критические файлы

- `.trivyignore` — **единственный файл для изменения**

---

## Git workflow

```
git checkout -b dev/fix-trivy-cve-2025-69534
# внести изменения в .trivyignore
git add .trivyignore
git commit -m "fix(security): add CVE-2025-69534 to trivyignore (python-markdown DoS, not installed)"
# создать PR: dev/fix-trivy-cve-2025-69534 → test
```

Согласно CLAUDE.md: PR создаётся только из `dev/*` веток в `test`.

---

## Верификация

**Локально:**
```bash
docker run --rm \
  -v $(pwd)/.trivyignore:/root/.trivyignore:ro \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image \
  --severity HIGH,CRITICAL --format table \
  --ignorefile /root/.trivyignore \
  ghcr.io/ikeniborn/familybudget-backend:11.6.17
```
Ожидаемый результат: `Total: 0 (HIGH: 0, CRITICAL: 0)`

**В CI после merge PR:**
- Job `security-scan` → шаг "Check HIGH/CRITICAL vulnerabilities (backend)" должен показать:
  `✅ No HIGH/CRITICAL vulnerabilities found in backend image (after .trivyignore)`
- Job `deploy-test` должен запуститься (ранее был заблокирован)
