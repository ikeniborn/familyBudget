# Architecture Corrections - Phase 1

**Дата:** 2025-10-25
**Причина:** Уточнение требований после Phase 1

---

## Изменения в архитектуре

### 1. ✅ Webapp перемещен в /bot/webapp/

**Было:** `/webapp/` на root level
**Стало:** `/bot/webapp/`

**Причина:** Webapp это часть бота, должен находиться в каталоге bot.

**Изменения:**
```bash
mv /webapp/ → /bot/webapp/
```

**Файлы изменены:**
- `backend/app/main.py` - WEBAPP_DIR = BASE_DIR / "bot" / "webapp"

**Serving остается прежним:**
- URL: `https://domain.com/webapp/index.html`
- Backend serve из `/bot/webapp/` через StaticFiles mount

---

### 2. ✅ Удалены дублирующие API endpoints

**Было:**
- `/api/v1/facts` - для Web UI
- `/api/v1/webapp/facts` - для Web Apps (дублирование)

**Стало:**
- `/api/v1/facts` - универсальный endpoint для Web UI + Web Apps

**Удалены файлы:**
- `backend/app/api/v1/webapp/facts.py` ❌
- `backend/app/api/v1/webapp/articles.py` ❌

**Оставлены (уникальные endpoints):**
- `backend/app/api/v1/webapp/validate.py` ✅ - initData validation (только для Web Apps)
- `backend/app/api/v1/webapp/stats.py` ✅ - statistics (Phase 2+)

**Изменения:**
- `backend/app/api/v1/webapp/__init__.py` - убраны импорты facts и articles
- `bot/webapp/static/js/api.js` - использует `/api/v1/*` вместо `/api/v1/webapp/*`

---

### 3. ✅ JWT middleware обновлен

**Добавлены публичные endpoints:**
```python
PUBLIC_PREFIXES = [
    "/api/v1/auth/",
    "/api/v1/webapp/validate",  # NEW - initData validation
    "/static/",
    "/webapp/",  # NEW - Web Apps static files
]
```

**Поддержка Bearer token:**
- ✅ Cookie (`access_token`) - для Web UI
- ✅ Authorization header (`Bearer <token>`) - для Web Apps

**Файлы изменены:**
- `backend/app/middleware/jwt_middleware.py`

---

## Текущая архитектура

### Directory Structure

```
familyBudget/
├── backend/               # FastAPI backend
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/  # REST API (facts, articles, users)
│   │   │   └── webapp/     # Web Apps specific (validate, stats)
│   │   └── middleware/     # JWT auth, CSP, logging
├── bot/                   # Telegram Bot + Web Apps
│   ├── webapp/            # Web Apps frontend (HTML, JS, CSS) ✅ NEW
│   │   ├── *.html
│   │   └── static/
│   │       ├── js/
│   │       ├── css/
│   │       └── img/
│   ├── handlers/          # Bot command handlers
│   └── utils/             # API client, validators
├── web/                   # Web UI (alternative browser access)
│   ├── static/
│   └── templates/
└── docker-compose.yml
```

### API Endpoints

#### Public (no auth required)
- `POST /api/v1/auth/telegram` - Telegram Login Widget auth
- `POST /api/v1/webapp/validate` - Web Apps initData validation

#### Protected (JWT required)
- `GET/POST/PUT/DELETE /api/v1/facts` - Transactions CRUD
- `GET /api/v1/articles` - Categories list
- `GET /api/v1/users/me` - Current user profile

### Authentication Flow

**Web UI:**
1. Telegram Login Widget → `/api/v1/auth/telegram`
2. Backend sets JWT in httpOnly cookie
3. Subsequent requests use cookie

**Web Apps:**
1. Telegram SDK provides `initData` → `/api/v1/webapp/validate`
2. Backend validates HMAC, returns JWT token
3. Frontend stores token, uses `Authorization: Bearer <token>` header

### Deployment

**No separate webapp container:**
- Backend container serve webapp static files
- URL: `/webapp/*` → serve from `/app/bot/webapp/`
- Bot container НЕ удаляется (webapp это часть бота)

---

## Преимущества новой архитектуры

1. **No Code Duplication:**
   - Один набор endpoints для Web UI и Web Apps
   - Общая бизнес-логика
   - Единая точка изменений

2. **Consistency:**
   - Одинаковые данные в Web UI и Web Apps
   - Общая база данных
   - Единая аутентификация

3. **Maintainability:**
   - Меньше кода для поддержки
   - Проще добавлять features
   - Единая документация API

4. **Logical Structure:**
   - Webapp внутри bot (логическая группировка)
   - API endpoints отдельно (shared resource)
   - Clear separation of concerns

---

## Migration Notes

### Для Phase 2-4

При реализации новых страниц:
1. HTML файлы в `/bot/webapp/`
2. API использует существующие `/api/v1/*` endpoints
3. Новые endpoints только если требуется уникальная логика для Web Apps

### Testing

Тесты остаются актуальными:
- Unit tests для API endpoints (без изменений)
- Integration tests с Bearer token auth
- E2E tests с новыми путями к webapp файлам

---

## Проверка изменений

**Checklist:**
- [x] Webapp перемещен в /bot/webapp/
- [x] Backend serve из bot/webapp
- [x] Удалены дублирующие endpoints
- [x] API client использует /api/v1/*
- [x] JWT middleware поддерживает Bearer token
- [x] Validate endpoint публичный
- [x] Webapp static files публичные
- [x] Menu Button URL правильный

**Готово к тестированию!** ✅

---

**Последнее обновление:** 2025-10-25 02:45 UTC
