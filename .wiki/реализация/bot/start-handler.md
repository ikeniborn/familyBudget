---
wiki_sources:
  - "bot/handlers/start.py"
wiki_updated: 2026-05-06
wiki_status: developing
wiki_outgoing_links: []
tags:
  - family-budget
  - implementation
  - bot-component
  - telegram
aliases:
  - "start handler"
  - "/start"
  - "bot аутентификация"
---

# Bot /start Handler — аутентификация бота

`bot/handlers/start.py` — обработчик команды `/start`, выполняет Telegram OAuth аутентификацию.

## Поток аутентификации

```
1. /start от пользователя
2. Проверка is_user_allowed(user.id) → ALLOWED_TELEGRAM_IDS
3. Если уже аутентифицирован (SessionManager) → показать welcome
4. Отправить "⏳ Выполняется авторизация..."
5. prepare_telegram_auth_data(user) → HMAC-SHA256 данные
6. api_client.authenticate_telegram_user(auth_data) → {user, access_token}
7. SessionManager.set_session(access_token, user_info)
8. edit_text → welcome + WebApp button
```

## WebApp интеграция

```python
webapp_url = f"{protocol}://{settings.DOMAIN}/webapp/index.html"
InlineKeyboardButton(text="🚀 Открыть приложение", web_app=WebAppInfo(url=webapp_url))
```

Основной UI доступен через Telegram WebApp (не inline keyboard меню — оно deprecated).

## Обработка ошибок

- `403` от backend → "Вы не зарегистрированы" + Telegram ID
- Другие `ValueError` → "Ошибка авторизации"
- `Exception` → "Произошла ошибка"

## Роли

```python
role_text = "👑 Администратор" if is_admin else "👤 Пользователь"
```
`is_admin` берётся из ответа backend API.

## Legacy callback

`menu_callback_handler` — устаревший обработчик inline keyboard меню. Оставлен для backward compatibility, но инициировать не должен. Показывает предупреждение "Этот интерфейс устарел".
