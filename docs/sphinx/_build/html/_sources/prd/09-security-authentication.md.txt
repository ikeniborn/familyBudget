## 9. Security & Authentication

### 9.1 Authentication Flow

**Telegram Login Widget Integration:**

1. Пользователь кликает на Telegram Login Widget на странице `/login`
2. JavaScript получает данные от Telegram: `{id, first_name, hash, ...}`
3. POST `/api/v1/auth/telegram` с данными
4. Backend валидирует hash: `HMAC-SHA256(data, SHA256(bot_token))`
5. **Автосоздание/обновление user в БД:**
   - Если пользователя нет → создать:
     - Если `telegram_id == ADMIN_TELEGRAM_ID` → **is_admin=True, is_active=True** (автоактивация админа)
     - Иначе → is_admin=False, is_active=False (неактивный, требует активации)
   - Если пользователь есть → обновить профиль (SCD Type 2)
   - Проверить `is_active`: если `False` → 403 Forbidden с сообщением "Ожидает активации"
   - Обновить `last_login_at = NOW()`
6. Генерация JWT токена (python-jose)
7. Set-Cookie с `httpOnly`, `secure`, `sameSite=strict`

**NEW: User Activation Flow:**
- Новые пользователи создаются автоматически с `is_active=False`
- Админ видит неактивных пользователей в `/admin/users`
- Админ активирует пользователя через кнопку "Активировать"
- После активации пользователь может войти в систему

**Hash Validation Example (Python):**

```python
import hashlib
import hmac

def validate_telegram_hash(data: dict, bot_token: str) -> bool:
    received_hash = data.pop('hash', None)
    if not received_hash:
        return False
    
    # Создаем строку для проверки
    data_check_string = '\n'.join(
        f"{k}={v}" for k, v in sorted(data.items())
    )
    
    # Вычисляем ожидаемый hash
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    expected_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return expected_hash == received_hash
```

**JWT Generation Example (Python):**

```python
from jose import jwt
from datetime import datetime, timedelta

def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=7)
    payload = {
        "user_id": user_id,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return token
```

### Примечание: Автоматическая активация админа

Первый администратор (определяемый через переменную окружения `ADMIN_TELEGRAM_ID`)
автоматически активируется при первом входе. Это необходимо для корректной работы
системы после первоначальной установки, так как активировать пользователей может
только уже активный администратор.

**Реализация:** `backend/app/api/v1/endpoints/auth.py:205-223`

### 9.2 Authorization (RBAC)

**Роли:**
- **admin** - полный доступ
- **user** - доступ только к своим данным

**Permissions Matrix:**

| Действие | Admin | User |
|----------|-------|------|
| Добавление факта | ✓ | ✓ (только свой) |
| Просмотр фактов | ✓ (все) | ✓ (только свои) |
| Редактирование факта | ✓ (все) | ✓ (только свой) |
| Удаление факта | ✓ (все) | ✓ (только свой) |
| CRUD справочников | ✓ | ✗ |
| Просмотр аналитики | ✓ (все данные) | ✓ (только свои) |

**FastAPI Dependency для current_user:**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def get_current_user(
    token: str = Depends(security)
) -> User:
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await get_user_by_id(user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        
        return user
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
```

### 9.3 Data Isolation

**App-level изоляция через middleware:**

```python
async def user_data_filter(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    # Автоматически добавляет фильтр user_id к запросам
    if not current_user.is_admin:
        # Для обычных пользователей - только их данные
        request.state.user_filter = {"user_id": current_user.id}
    else:
        # Админ видит все
        request.state.user_filter = {}
```

**Почему не Row-Level Security:**
Упрощение архитектуры для домашнего проекта. App-level фильтрация проще в управлении и отладке.

### 9.4 Network Security

**HTTPS (Nginx + SSL certificates):**

```nginx
server {
    listen 80;
    server_name familybudget.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name familybudget.example.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**UFW Firewall Rules:**

```bash
#!/bin/bash

# Основные правила
ufw allow 22   # SSH
ufw allow 80   # HTTP
ufw allow 443  # HTTPS

# PostgreSQL доступ (порт 5432 exposed в docker-compose.yml, но контролируется UFW)
# По умолчанию UFW блокирует все внешние подключения к порту 5432
if [ "$POSTGRES_EXTERNAL_ACCESS" = "true" ]; then
  # Разрешаем доступ ТОЛЬКО с конкретного IP
  ufw allow from $POSTGRES_ALLOWED_IP to any port 5432 comment "PostgreSQL external access"
  echo "PostgreSQL external access enabled for $POSTGRES_ALLOWED_IP"
else
  echo "PostgreSQL blocked by UFW (port exposed but not accessible)"
fi

ufw enable
```

### 9.5 Input Validation

**Pydantic models для API:**

```python
from pydantic import BaseModel, Field, validator

class FactCreate(BaseModel):
    article_id: int = Field(..., gt=0)
    financial_center_id: int = Field(..., gt=0)
    cost_center_id: int = Field(..., gt=0)
    period_id: int = Field(..., gt=0)
    record_type: str = Field(..., regex='^(plan|fact)$')
    amount: float = Field(..., ge=0, le=1000000)
    transaction_date: date
    comment: str = Field(None, max_length=500)
    
    @validator('amount')
    def validate_amount(cls, v):
        # Максимум 2 знака после запятой
        if round(v, 2) != v:
            raise ValueError('Amount must have at most 2 decimal places')
        return v
```

**SQLAlchemy constraints:**
Уже добавлены в DDL (CHECK constraints, NOT NULL, UNIQUE)

### 9.6 Secrets Management

**Environment Variables (.env file):**

```bash
# Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# JWT
JWT_SECRET_KEY=randomly_generated_secret_key_min_32_chars
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=7

# PostgreSQL
POSTGRES_USER=familybudget
POSTGRES_PASSWORD=strong_password_here
POSTGRES_DB=familybudget
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Admin
ADMIN_TELEGRAM_ID=123456789

# S3 (Yandex Object Storage)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=familybudget-backups
S3_ENDPOINT_URL=https://storage.yandexcloud.net

# PostgreSQL External Access
POSTGRES_EXTERNAL_ACCESS=false
POSTGRES_ALLOWED_IP=
```

**Docker Secrets (production):**
Для production рекомендуется использовать Docker secrets или Vault.

### 9.7 Rate Limiting

**API rate limits (FastAPI middleware):**

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/api/v1/auth/telegram")
@limiter.limit("5/minute")
async def telegram_auth(request: Request, data: TelegramAuthData):
    ...
```

**Telegram bot flood protection:**
python-telegram-bot имеет встроенную защиту от флуда.

### 9.8 Graceful Degradation для неавторизованных пользователей

**Проблема:**
При доступе к защищенным ресурсам (справочники, API endpoints) неавторизованный пользователь получает HTTP 401 ошибки, которые могут генерировать шумные error messages в UI.

**Решение (реализовано в v5.0.0-beta):**

#### 9.8.1 Frontend: Условный рендеринг (index.html)

**Jinja2 Template Guards:**
```html
{% if user %}
    <!-- Модальные формы добавления транзакций/планов -->
    {{ transaction_modal('modal_add_transaction') }}
    {{ plan_modal('modal_add_plan') }}

    <!-- JavaScript инициализация справочников -->
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            loadCategories();
            loadFinancialCenters();
            loadCostCenters();
        });
    </script>
{% endif %}
```

**Защита:**
- Модальные формы НЕ рендерятся в DOM для неавторизованных пользователей
- JavaScript код инициализации НЕ выполняется
- Библиотеки (Choices.js, ChoicesCategoryTree) НЕ загружаются

#### 9.8.2 Frontend: DOM Element Checks (defense in depth)

**Проверка существования select элементов перед инициализацией:**
```javascript
async function loadTransactionCategories() {
    try {
        // Check if select element exists (defense in depth)
        const selectElement = document.querySelector('#form_modal_add_transaction select[name="article_id"]');
        if (!selectElement) {
            console.log('[loadTransactionCategories] Select element not found - skipping initialization');
            return;
        }

        // ... инициализация ChoicesCategoryTree
    } catch (error) {
        console.error('Failed to load transaction categories:', error);
        showToast('Ошибка при загрузке категорий транзакций', 'error');
    }
}
```

#### 9.8.3 Frontend: Silent Fail для 401 ошибок

**Graceful degradation в loadFinancialCenters():**
```javascript
async function loadFinancialCenters() {
    try {
        const response = await fetch('/api/v1/financial-centers?limit=1000');
        if (!response.ok) {
            // Graceful degradation for 401 Unauthorized
            if (response.status === 401) {
                console.log('[loadFinancialCenters] User not authenticated - not loaded');
                return;  // Silent fail - don't show error toast
            }

            // For other errors, show error toast
            console.warn('Failed to fetch: HTTP', response.status);
            showToast('Не удалось загрузить список Счетов', 'error');
            return;
        }
        // ... обработка данных
    } catch (error) {
        console.error('Failed to load financial centers:', error);
        showToast('Ошибка при загрузке Счетов', 'error');
    }
}
```

#### 9.8.4 Shared Component: ChoicesCategoryTree graceful degradation

**ChoicesCategoryTree.loadCategories() с 401 handling:**
```javascript
async loadCategories() {
    const url = `${this.options.apiBaseUrl}/articles?type=${this.options.type}`;

    const response = await fetch(url, {
        headers: headers,
        credentials: 'same-origin',
    });

    if (!response.ok) {
        // Graceful degradation for 401 Unauthorized
        if (response.status === 401) {
            console.log('[ChoicesCategoryTree] User not authenticated - categories not loaded');
            this.categories = [];  // Empty categories array
            return;  // Silent fail - don't throw error
        }

        // For other errors, throw with detailed status
        throw new Error(`Failed to load categories: HTTP ${response.status}`);
    }

    const data = await response.json();
    this.categories = data.articles || [];
}
```

**Преимущества:**
- Компонент используется в Telegram WebApps (Bearer token auth) и web interface (cookie auth)
- Graceful degradation работает для обоих случаев
- Не показывает error alerts для ожидаемых 401 статусов

#### 9.8.5 Backend: Public vs Protected Endpoints

**Public endpoints (не требуют авторизацию):**
- `/` - главная страница (использует `CurrentUserOptional`)
- `/analytics` - страница аналитики (использует `CurrentUserOptional`)
- `/api/v1/auth/*` - authentication endpoints
- `/static/*`, `/webapp/*` - статические файлы

**Protected endpoints (требуют CurrentUser dependency):**
- `/api/v1/articles` - список категорий бюджета
- `/api/v1/financial-centers` - список Счетов
- `/api/v1/cost-centers` - список Мест затрат
- `/api/v1/facts/*` - CRUD транзакций

**ВАЖНО:** Справочники намеренно защищены авторизацией, так как содержат бизнес-логику и категории семейного бюджета (не public data).

#### 9.8.6 UX Benefits

**Для неавторизованных пользователей:**
- ✅ Чистая консоль браузера (нет 401 ошибок)
- ✅ Нет лишних error toast уведомлений
- ✅ Нет попыток загрузки защищенных ресурсов
- ✅ Меньший DOM (модальные формы не рендерятся)
- ✅ Меньше загруженных JS библиотек

**Для авторизованных пользователей:**
- ✅ Все функции доступны как обычно
- ✅ Никаких изменений в UX

### 9.9 Logout функционал

**Реализовано в:** v5.0.0-beta

#### 9.9.1 Backend: Logout Endpoint

**Endpoint:** `POST /api/v1/auth/logout`

**Функционал:**
1. Отзыв refresh token в БД (`t_f_refresh_token.is_revoked = True`)
2. Удаление httpOnly cookies: `access_token` и `refresh_token`
3. Graceful degradation: успех даже если токен не найден

**Код (backend/app/api/v1/endpoints/auth.py:644-718):**
```python
@router.post("/logout")
async def logout(
    response: Response,
    session: AsyncSession = Depends(get_session),
    refresh_token: str | None = Cookie(None, alias="refresh_token"),
) -> dict:
    """Logout user by revoking refresh token."""

    # 1. Revoke refresh token in database
    if refresh_token:
        token_hash = hash_token(refresh_token)
        db_token = await session.exec(
            select(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .where(RefreshToken.is_revoked == False)
        ).first()

        if db_token:
            db_token.revoke()  # Sets is_revoked=True, revoked_at=now()
            await session.commit()

    # 2. Clear both cookies (access_token and refresh_token)
    response.delete_cookie(key="access_token")
    response.delete_cookie(key="refresh_token")

    return {"message": "Logout successful"}
```

**Security features:**
- ✅ Token revocation в БД (предотвращает reuse)
- ✅ Удаление httpOnly cookies (XSS protection)
- ✅ Идемпотентность (можно вызывать многократно)
- ✅ Graceful degradation (работает даже без валидного токена)

#### 9.9.2 Frontend: User Dropdown Menu

**Компонент:** DaisyUI Dropdown в navbar (desktop)

**Файл:** `frontend/web/templates/base.html:93-123`

**Структура:**
```html
{% if user %}
    <div class="dropdown dropdown-end">
        <label tabindex="0" class="btn btn-ghost btn-sm gap-2">
            <span>{{ user.first_name or user.username }}</span>
            {% if user.is_admin %}
                <span class="badge badge-warning badge-xs">Admin</span>
            {% endif %}
            <svg class="w-4 h-4">...</svg> <!-- Chevron down icon -->
        </label>
        <ul class="menu dropdown-content">
            <li class="menu-title"><span>Профиль</span></li>
            <li>
                <div>Telegram ID: {{ user.telegram_id }}</div>
            </li>
            <div class="divider my-1"></div>
            <li>
                <button onclick="handleLogout()" class="text-error">
                    <svg>...</svg> <!-- Logout icon -->
                    Выйти
                </button>
            </li>
        </ul>
    </div>
{% endif %}
```

**UI элементы:**
- Имя пользователя + admin badge (если админ)
- Telegram ID (для идентификации)
- Кнопка "Выйти" (красная, с иконкой)

#### 9.9.3 Frontend: Mobile Menu Logout

**Компонент:** Logout кнопка в mobile dropdown menu

**Файл:** `frontend/web/templates/base.html:149-156`

**Структура:**
```html
{% if user %}
    <div class="divider my-1"></div>
    <li>
        <button onclick="handleLogout()" class="text-error">
            🚪 Выйти
        </button>
    </li>
{% endif %}
```

**Расположение:** После навигационных ссылок и admin меню

#### 9.9.4 Frontend: Toast Notification System

**Назначение:** Визуальный feedback при logout

**Файл:** `frontend/web/templates/base.html:167-235`

**Toast Container:**
```html
<div id="toast-container" class="toast toast-top toast-end z-50"></div>
```

**showToast() функция:**
```javascript
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const alertClass = type === 'success' ? 'alert-success' :
                      type === 'error' ? 'alert-error' :
                      type === 'warning' ? 'alert-warning' : 'alert-info';

    toast.className = `alert ${alertClass} shadow-lg`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity = '0';
        setTimeout(() => container.removeChild(toast), 300);
    }, 3000);
}
```

**Типы toast:**
- `info` - синий (loading, информация)
- `success` - зеленый (успешные операции)
- `error` - красный (ошибки)
- `warning` - желтый (предупреждения)

#### 9.9.5 Frontend: Logout Handler

**handleLogout() функция:**
```javascript
async function handleLogout() {
    try {
        // 1. Show loading toast
        showToast('Выход из системы...', 'info');

        // 2. Call logout endpoint
        const response = await fetch('/api/v1/auth/logout', {
            method: 'POST',
            credentials: 'same-origin', // Include cookies
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        // 3. Success - show toast and redirect
        showToast('Вы успешно вышли из системы', 'success');

        // 4. Redirect to home page (will show login button)
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);

    } catch (error) {
        console.error('Logout error:', error);
        showToast('Ошибка при выходе из системы', 'error');
    }
}
```

**Flow:**
1. Показать info toast "Выход из системы..."
2. POST `/api/v1/auth/logout` с credentials
3. При успехе: success toast "Вы успешно вышли"
4. Redirect на `/` через 1 секунду
5. При ошибке: error toast с сообщением

#### 9.9.6 UX Flow

**Logout Flow (Desktop):**
```
Пользователь → Клик на имя пользователя → Dropdown открывается →
→ Клик "Выйти" → Toast "Выход из системы..." →
→ Backend logout → Toast "Вы успешно вышли" →
→ Redirect на главную → Показ login кнопки
```

**Logout Flow (Mobile):**
```
Пользователь → Клик на hamburger меню → Mobile menu открывается →
→ Scroll вниз → Клик "🚪 Выйти" → (тот же flow)
```

**После logout:**
- Cookies удалены (access_token, refresh_token)
- Refresh token отозван в БД
- Пользователь перенаправлен на `/` (public page)
- Показана login кнопка вместо user dropdown

#### 9.9.7 Testing

**Integration тесты:** `tests/integration/backend/test_auth_endpoints.py`

**Тесты:**
1. `test_logout_success` - успешный logout очищает cookies
2. `test_logout_idempotent` - logout можно вызывать многократно
3. `test_logout_without_cookies` - graceful degradation без cookies
4. `test_logout_returns_json` - корректный JSON response

**Запуск:**
```bash
pytest tests/integration/backend/test_auth_endpoints.py -m integration
```

#### 9.9.8 Security Considerations

**Защита от CSRF:**
- ✅ Logout делает POST (не GET)
- ✅ SameSite=lax cookies
- ✅ CORS настроен корректно

**Защита от XSS:**
- ✅ httpOnly cookies (JavaScript не может прочитать токены)
- ✅ Secure flag для HTTPS
- ✅ Toast content escaped (innerHTML с простым текстом)

**Token Revocation:**
- ✅ Refresh token отзывается в БД
- ✅ Нельзя повторно использовать отозванный токен
- ✅ `is_revoked` и `revoked_at` для audit trail

**Graceful Degradation:**
- ✅ Logout работает даже если токен невалидный
- ✅ Logout работает даже если токена нет
- ✅ Пользователь всегда может "очистить сессию"

---

