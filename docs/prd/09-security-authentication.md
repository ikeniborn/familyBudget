## 9. Security & Authentication

### 9.1 Authentication Flow

**Telegram Login Widget Integration:**

1. Пользователь кликает на Telegram Login Widget на странице `/login`
2. JavaScript получает данные от Telegram: `{id, first_name, hash, ...}`
3. POST `/api/v1/auth/telegram` с данными
4. Backend валидирует hash: `HMAC-SHA256(data, SHA256(bot_token))`
5. Создание/обновление user в БД
6. Генерация JWT токена (python-jose)
7. Set-Cookie с `httpOnly`, `secure`, `sameSite=strict`

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
            showToast('Не удалось загрузить список ЦФО', 'error');
            return;
        }
        // ... обработка данных
    } catch (error) {
        console.error('Failed to load financial centers:', error);
        showToast('Ошибка при загрузке ЦФО', 'error');
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
- `/api/v1/financial-centers` - список ЦФО
- `/api/v1/cost-centers` - список МВЗ
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

---

