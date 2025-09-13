# API Endpoints Documentation

## Обзор API

Family Budget предоставляет RESTful API для управления бюджетными данными с поддержкой аутентификации и авторизации. Все endpoints требуют аутентификации, кроме группы `/auth/*`.

## Унифицированный формат ответов API ✅ **v3.2.0** (Обновлено 13.09.2025)

### Новый стандартный формат

Начиная с версии **v3.2.0** все API endpoints возвращают единый формат ответов для обеспечения консистентности и простоты обработки на frontend:

#### Успешные ответы

```typescript
// Одиночный объект
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Пример объекта",
    // ... другие поля
  }
}

// Список объектов
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Первый объект"
    },
    {
      "id": 2,
      "name": "Второй объект"
    }
  ],
  "total": 2
}

// Пустой список
{
  "success": true,
  "data": [],
  "total": 0
}
```

#### Ошибки

```typescript
// Стандартная ошибка
{
  "success": false,
  "error": "Описание ошибки"
}

// Ошибка валидации (422)
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "field_name": ["Поле обязательно для заполнения"]
  }
}

// Ошибка не найден (404)
{
  "success": false,
  "error": "Объект не найден"
}

// Конфликт данных (409)
{
  "success": false,
  "error": "Период на дату 2025-09-13 уже существует"
}
```

### Преимущества унифицированного формата

- ✅ **Консистентность**: Единый интерфейс для всех endpoints
- ✅ **Простота**: Упрощенная обработка на frontend
- ✅ **Типобезопасность**: Четкая типизация для TypeScript
- ✅ **Обратная совместимость**: Поддержка старых форматов
- ✅ **Расширяемость**: Легкое добавление метаданных

### Техническая реализация

Формат реализован через модуль `app.core.response`:

```python
# backend-fastapi/app/core/response.py

from typing import Any, Dict, List, Optional
from fastapi.responses import JSONResponse

def success_response(data: Any, total: Optional[int] = None) -> Dict[str, Any]:
    """Создать успешный ответ API"""
    response = {"success": True, "data": data}
    if total is not None:
        response["total"] = total
    return response

def error_response(message: str, status_code: int = 400) -> JSONResponse:
    """Создать ответ с ошибкой API"""
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": message}
    )
```

### Обновленные endpoints

Следующие endpoints обновлены для использования нового формата:

- ✅ **Периоды** (`/api/periods/`) - управление периодами бюджета
- ✅ **ЦФО** (`/api/financial_centers/`) - центры финансовой ответственности
- ✅ **МВЗ** (`/api/cost_centers/`) - места возникновения затрат
- ✅ **Номенклатуры** (`/api/nomenclatures/`) - категории бюджета

## Структура API

### Базовый URL

```
Development: http://localhost:4000/api
Production: https://your-domain.com/api
```

### Группы endpoints

```
/api/auth/*                    # Аутентификация (без user_id)
/api/users/*                   # Управление пользователями
/api/periods/*                 # CRUD периодов ✅ v3.2.0
/api/financial_centers/*       # Управление ЦФО ✅ v3.2.0
/api/cost_centers/*           # Управление МВЗ ✅ v3.2.0
/api/nomenclatures/*          # Управление категориями ✅ v3.2.0
/api/registry/*               # Операции с транзакциями
/api/products/*               # Каталог товаров
/api/reports/*                # Аналитические endpoints
/api/admin/*                  # Административные функции
```

## Аутентификация и авторизация

### Система сессий

API использует session-based аутентификацию:

- **Cookie**: `connect.sid` содержит session ID
- **Storage**: Redis хранит данные сессии
- **Format**: Express-session совместимый формат
- **User ID**: `session.user.id` (number)

### Заголовки запросов

```http
Cookie: connect.sid=s%3A1234567890abcdef
Content-Type: application/json
```

### Проверка аутентификации

```bash
# Проверить текущего пользователя
curl -b "connect.sid=session-id" http://localhost:4000/api/auth/me
```

## Основные endpoints

### Аутентификация `/api/auth/*`

#### POST `/api/auth/telegram`
Авторизация через Telegram

**Запрос:**
```json
{
  "auth_data": {
    "id": 123456789,
    "first_name": "John",
    "username": "john_doe",
    "auth_date": 1694678400,
    "hash": "abc123"
  }
}
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "john_doe",
      "first_name": "John",
      "is_admin": false
    }
  }
}
```

#### POST `/api/auth/password`
Авторизация по паролю

**Запрос:**
```json
{
  "username": "user@example.com",
  "password": "securepassword"
}
```

#### GET `/api/auth/me`
Получить информацию о текущем пользователе

**Ответ:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "john_doe",
      "first_name": "John",
      "is_admin": false
    }
  }
}
```

#### POST `/api/auth/logout`
Выйти из системы

### Периоды `/api/periods/` ✅ **v3.2.0**

#### GET `/api/periods/`
Получить список периодов

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "period_key": "2025.09",
      "month": 9,
      "year": 2025,
      "is_active": true,
      "user_id": 1,
      "created_at": "2025-09-13T12:00:00Z"
    }
  ],
  "total": 1
}
```

#### POST `/api/periods/`
Создать новый период

**Запрос:**
```json
{
  "period_key": "2025.10",
  "month": 10,
  "year": 2025,
  "is_active": true
}
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "period_key": "2025.10",
    "month": 10,
    "year": 2025,
    "is_active": true,
    "user_id": 1,
    "created_at": "2025-09-13T12:05:00Z"
  }
}
```

#### PUT `/api/periods/{id}`
Обновить период

#### DELETE `/api/periods/{id}`
Удалить период

### Центры финансовой ответственности `/api/financial_centers/` ✅ **v3.2.0**

#### GET `/api/financial_centers/`
Получить список ЦФО

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "СБ",
      "name": "Семейный бюджет",
      "description": "Общие семейные расходы",
      "is_active": true,
      "user_id": 1,
      "created_at": "2025-09-13T12:00:00Z"
    }
  ],
  "total": 1
}
```

#### POST `/api/financial_centers/`
Создать новый ЦФО

**Запрос:**
```json
{
  "code": "ДР",
  "name": "Детские расходы",
  "description": "Расходы на детей",
  "is_active": true
}
```

### Места возникновения затрат `/api/cost_centers/` ✅ **v3.2.0**

#### GET `/api/cost_centers/`
Получить список МВЗ

#### POST `/api/cost_centers/`
Создать новый МВЗ

**Запрос:**
```json
{
  "code": "МАГ01",
  "name": "Продуктовые магазины",
  "description": "Покупки продуктов питания",
  "is_active": true
}
```

### Номенклатуры `/api/nomenclatures/` ✅ **v3.2.0**

#### GET `/api/nomenclatures/`
Получить список категорий

#### POST `/api/nomenclatures/`
Создать новую категорию

**Запрос:**
```json
{
  "code": "FOOD",
  "name": "Продукты питания",
  "description": "Покупка продуктов питания",
  "is_active": true
}
```

### Управление пользователями `/api/users/*` (Только для администратора)

#### GET `/api/users/`
Получить список всех пользователей (только admin)

#### DELETE `/api/users/{id}`
Удалить пользователя (только admin, нельзя удалить себя)

## Коды ошибок HTTP

| Код | Описание | Пример |
|-----|----------|--------|
| 200 | OK | Успешная операция |
| 201 | Created | Объект создан |
| 400 | Bad Request | Неверные данные запроса |
| 401 | Unauthorized | Не авторизован |
| 403 | Forbidden | Доступ запрещен |
| 404 | Not Found | Объект не найден |
| 409 | Conflict | Конфликт данных (дубликат) |
| 422 | Unprocessable Entity | Ошибка валидации |
| 500 | Internal Server Error | Внутренняя ошибка сервера |

## Фильтрация и пагинация

### Query параметры

```http
GET /api/periods/?limit=10&offset=0&is_active=true
GET /api/nomenclatures/?search=продукты&limit=20
```

### Параметры фильтрации

- `limit` - количество записей (по умолчанию: 100)
- `offset` - смещение (по умолчанию: 0)
- `search` - поиск по тексту
- `is_active` - фильтр по активности
- `sort_by` - сортировка по полю
- `sort_order` - порядок сортировки (asc/desc)

## Изоляция данных

### Принципы безопасности

**КРИТИЧНО**: Все endpoints автоматически фильтруют данные по `user_id`:

- ✅ Пользователь видит только свои данные
- ✅ SQLAlchemy фильтры применяются автоматически
- ✅ Нет риска утечки данных между пользователями
- ✅ Административные права проверяются отдельно

### Примеры SQL фильтрации

```python
# Автоматическая фильтрация по user_id
periods = session.query(Period).filter(
    Period.user_id == current_user.id
).all()

# Административный доступ (только для admin)
if current_user.id == 1:  # admin
    all_users = session.query(User).all()
```

## Тестирование API

### Примеры тестовых запросов

```bash
# Проверка аутентификации
curl -b "connect.sid=session" http://localhost:4000/api/auth/me

# Получение списка периодов
curl -b "connect.sid=session" http://localhost:4000/api/periods/

# Создание нового периода
curl -X POST -b "connect.sid=session" \
  -H "Content-Type: application/json" \
  -d '{"period_key":"2025.11","month":11,"year":2025,"is_active":true}' \
  http://localhost:4000/api/periods/

# Проверка унифицированного формата ответа
curl -b "connect.sid=session" http://localhost:4000/api/financial_centers/ | jq
```

## Миграция на v3.2.0

### Изменения для разработчиков

#### Frontend (TypeScript)

**Старый формат (до v3.2.0):**
```typescript
// Различные форматы ответов
const periods: Period[] = await response.json();
const user: {user: User} = await response.json();
```

**Новый формат (v3.2.0+):**
```typescript
// Единый формат для всех endpoints
interface ApiResponse<T> {
  success: boolean;
  data: T;
  total?: number;
  error?: string;
}

const response: ApiResponse<Period[]> = await fetch('/api/periods/').then(r => r.json());
if (response.success) {
  const periods = response.data;
  const total = response.total;
}
```

#### Backend (Python)

**Использование утилит ответов:**
```python
from app.core.response import success_response, error_response

@router.get("/periods/")
def get_periods():
    periods = get_user_periods(current_user.id)
    return success_response(periods, total=len(periods))

@router.post("/periods/")
def create_period(period_data: PeriodCreate):
    try:
        period = create_new_period(period_data, current_user.id)
        return success_response(period)
    except DuplicateError as e:
        return error_response(str(e), status_code=409)
```

### Обратная совместимость

Endpoints, не обновленные на v3.2.0, продолжают работать в старом формате до их миграции.

## Планы развития

### v3.3.0 (планируется на ноябрь 2025)
- Расширение унифицированного формата на все endpoints
- Добавление метаданных пагинации
- Улучшенные коды ошибок и сообщения
- GraphQL поддержка для сложных запросов

### v3.4.0 (планируется на декабрь 2025)
- OpenAPI 3.0 полная спецификация
- Автоматическая валидация запросов/ответов
- SDK для популярных языков программирования
- WebSocket поддержка для real-time обновлений

---

*Документ обновлен: 13.09.2025 (v3.2.0)*
*Техническая информация: [История изменений API](../changelog.md)*