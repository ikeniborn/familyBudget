---
wiki_sources:
  - "scripts/ssl_certificate_manager.sh"
  - "scripts/check_certificates.sh"
  - "scripts/clean_old_certificates.sh"
wiki_updated: 2026-05-06
wiki_status: developing
tags:
  - bash
  - ssl
  - certbot
  - nginx
aliases:
  - "ssl_certificate_manager.sh"
  - "Let's Encrypt"
  - "SSL сертификаты"
---

# Управление SSL-сертификатами

Набор bash-скриптов для управления Let's Encrypt сертификатами через certbot, установленный на хосте (не в Docker-контейнере). Подход без контейнеризации certbot выбран для большей надёжности и простоты.

## Основные характеристики

### ssl_certificate_manager.sh — основной менеджер

**Возможности:**
- DNS-валидация перед получением сертификата
- Автоматическое управление UFW (открытие порта 80 для HTTP-01)
- Standalone-режим certbot (HTTP-01 challenge)
- Проверка срока действия сертификата
- Настройка авто-продления через cron
- Deploy hook для перезагрузки nginx

**Рабочий процесс SSL:**
1. Очистка nginx-маркеров
2. Проверка наличия существующего сертификата
3. Запуск certbot (standalone mode, требует порт 80)
4. Верификация файлов сертификата
5. Обновление конфигурации nginx
6. Перезагрузка nginx
7. Проверка работы HTTPS

**Пороги продления (renewal thresholds):**
- `AUTO_RENEW_THRESHOLD=30` дней — автоматическое продление
- `WARNING_THRESHOLD=14` дней — предупреждение

**Ключевые пути:**
- Сертификаты: `/etc/letsencrypt/live/<domain>/`
- Log certbot: `/var/log/letsencrypt/letsencrypt.log`
- Deploy hook: `/usr/local/bin/familybudget-cert-renew`

### check_certificates.sh — проверка сертификатов

Вспомогательный скрипт (подключается через `source`):
- Определяет существующие SSL-сертификаты
- Сравнивает с новым доменом
- Предлагает очистку при необходимости
- **Никогда не удаляет автоматически**

```bash
source scripts/check_certificates.sh
check_and_offer_certificate_cleanup "new-domain.com" "/path/to/certbot/conf"
```

### clean_old_certificates.sh — удаление старых сертификатов

Удаляет сертификаты от предыдущих проектов, которые могут мешать новой установке:
- Интерактивный режим (по умолчанию) — требует подтверждения
- `--auto` — автоматический режим без подтверждений

## Связанные концепции

- [[deploy-lib-модули]]
- [[аутентификация]]
