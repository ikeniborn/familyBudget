---
wiki_sources: ["docs/architecture/features/notifications.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["PWA", "Push", "VAPID", "Telegram", "FastAPI", "backend"]
aliases: ["Push Notifications", "Web Push", "VAPID", "Telegram Notifications", "User Preferences"]
---

# Notification Service

Двухканальная система уведомлений: Web Push (VAPID) и Telegram Bot. Пользователи управляют предпочтениями через настройки.

## Основные характеристики

### Каналы уведомлений

| Канал | Технология | Применение |
|-------|-----------|-----------|
| Web Push | VAPID + Service Worker | Browser/PWA уведомления |
| Telegram Bot | python-telegram-bot API | Уведомления в Telegram |

### User Preferences (v6.4.0)

Пользовательские настройки хранятся в `t_d_user`:

```python
enable_push_notifications: bool = True   # default TRUE
enable_telegram_notifications: bool = True  # default TRUE
```

**Частичный индекс для производительности:**
```sql
CREATE INDEX idx_user_notifications
ON t_d_user (id)
WHERE enable_push_notifications = TRUE OR enable_telegram_notifications = TRUE;
```

Запросы к подписчикам используют этот индекс — не сканируют неактивных пользователей.

### Web Push (VAPID)

**Генерация ключей:**
```bash
./scripts/generate_vapid_keys.sh  # Создаёт VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY
```

**Регистрация подписки:**
```javascript
// Service Worker
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: VAPID_PUBLIC_KEY
});
```

**Endpoint подписки:** `POST /api/v1/push/subscribe`

### Telegram Notifications

- Отправляются через Telegram Bot API при событиях (recurring plan напоминания, аварии)
- Требует: пользователь авторизован через Telegram OAuth (`telegram_id` не null)
- Управляется флагом `enable_telegram_notifications`

### События для уведомлений

| Событие | Web Push | Telegram |
|---------|----------|---------|
| Recurring plan reminder | ✅ | ✅ |
| Scheduled backup status | ❌ | ✅ |
| Budget limit exceeded | ✅ | ✅ |
| Welcome (first login) | ✅ | ❌ |

### Welcome Toast (v6.5.1)

Первый визит пользователя показывает toast-уведомление (5 секунд) вместо полноэкранной Welcome Section:
- Хранится в `localStorage['welcomeNotificationShown']`
- Работает без подключения к интернету
- Graceful fallback если localStorage недоступен

## Связанные концепции

- [[аутентификация]]
- [[pwa-service-worker]]
- [[recurring-plans-service]]
