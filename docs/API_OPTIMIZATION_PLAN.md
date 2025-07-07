# План оптимизации API архитектуры

## Текущее состояние

### Проблемы существующей архитектуры

1. **Два отдельных API**:
   - Frontend API (Node.js) - прокси с аутентификацией
   - Backend API (Python/FastAPI) - бизнес-логика и БД

2. **Критические проблемы безопасности**:
   - SQL-инъекции в Backend API
   - Отсутствие проверки user_id в запросах
   - Backend API принимает любые запросы без аутентификации

3. **Архитектурные недостатки**:
   - Дополнительная сетевая задержка
   - Дублирование определений маршрутов
   - Сложность развертывания и поддержки
   - Frontend API - простой прокси без бизнес-логики

## Рекомендуемый план действий

### Фаза 1: Критические исправления (1-2 недели)

#### 1.1 Исправить SQL-инъекции в Backend API

**Текущий код (уязвимый)**:
```python
# api/budget_api.py
sql = f"SELECT * FROM t_d_user WHERE user_name='{user_name}'"
```

**Исправленный код**:
```python
sql = "SELECT * FROM t_d_user WHERE user_name = $1"
result = await connection.fetch(sql, user_name)
```

**Файлы для изменения**:
- `/api/budget_api.py` - все функции с SQL запросами

#### 1.2 Добавить валидацию user_id

**Добавить middleware в FastAPI**:
```python
from fastapi import Request, HTTPException

@app.middleware("http")
async def validate_user_context(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        user_id = request.headers.get("X-User-Id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID required")
    response = await call_next(request)
    return response
```

#### 1.3 Реализовать недостающие endpoints

**Products API**:
```python
@app.get("/products")
async def get_products(user_id: str = Header(alias="X-User-Id")):
    # Реализация

@app.post("/products") 
async def create_product(product: ProductModel, user_id: str = Header(alias="X-User-Id")):
    # Реализация
```

### Фаза 2: Оптимизация текущей архитектуры (2-4 недели)

#### 2.1 Добавить кеширование Redis

**docker-compose.yaml**:
```yaml
redis:
  image: redis:7-alpine
  container_name: redis
  networks:
    - app_network
```

**Frontend API кеширование**:
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Кеширование справочников
const getCachedData = async (key: string, fetcher: Function) => {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const data = await fetcher();
  await redis.setex(key, 3600, JSON.stringify(data)); // 1 час
  return data;
};
```

#### 2.2 Оптимизировать производительность

- Добавить индексы в БД для часто используемых запросов
- Использовать connection pooling
- Добавить пагинацию для больших списков

### Фаза 3: Миграция на единый API (1-2 месяца)

#### 3.1 Выбор технологии

**Рекомендация: Node.js с TypeScript**

**Преимущества**:
- Единый стек с фронтендом (JavaScript/TypeScript)
- Современные ORM (Prisma, TypeORM) предотвращают SQL-инъекции
- Лучше для real-time функций
- Проще найти разработчиков

**Альтернатива: Расширить Python API**
- Сохранить существующую логику
- Добавить аутентификацию в FastAPI
- Требует больше изменений во фронтенде

#### 3.2 План миграции на Node.js

**Шаг 1: Настройка ORM**
```typescript
// Prisma schema
model User {
  id            Int      @id @default(autoincrement())
  userName      String   @map("user_name")
  telegramId    String   @unique @map("telegram_id")
  createdAt     DateTime @default(now()) @map("created_dttm")
  
  @@map("t_d_user")
}
```

**Шаг 2: Перенос endpoints поэтапно**
1. Справочники (users, periods, nomenclatures)
2. CRUD операции (registry)
3. Отчеты и аналитика
4. Новые функции (products)

**Шаг 3: Параллельная работа**
```typescript
// Frontend API временно поддерживает оба backend
const useNewApi = process.env.FEATURE_NEW_API === 'true';

router.get('/users', async (req, res) => {
  if (useNewApi) {
    // Новая реализация с ORM
    const users = await prisma.user.findMany({
      where: { isActive: true }
    });
    res.json(users);
  } else {
    // Старый прокси к Python API
    const data = await backendApi.getUsers();
    res.json(data);
  }
});
```

### Фаза 4: Завершение миграции (2-4 недели)

1. Полное тестирование нового API
2. Миграция всех пользователей
3. Отключение Python API
4. Упрощение Docker конфигурации

## Итоговая архитектура

### Единый Node.js API
- Express.js + TypeScript
- Prisma ORM для БД
- Redis для кеширования
- Встроенная аутентификация
- WebSocket для real-time

### Преимущества
- Упрощенное развертывание (один API контейнер)
- Единый технологический стек
- Лучшая производительность (нет прокси)
- Проще поддержка и разработка

## Альтернативный подход: GraphQL

Рассмотреть внедрение GraphQL для:
- Оптимизации запросов данных
- Типизированного API
- Автогенерации клиентского кода

## Метрики успеха

1. **Производительность**:
   - Снижение latency API на 30-50%
   - Уменьшение нагрузки на сеть

2. **Разработка**:
   - Единый репозиторий для API
   - Быстрее добавление новых функций

3. **Безопасность**:
   - Устранение SQL-инъекций
   - Правильная изоляция данных пользователей

## Временные оценки

- **Фаза 1**: 1-2 недели (критично!)
- **Фаза 2**: 2-4 недели
- **Фаза 3**: 4-8 недель
- **Фаза 4**: 2-4 недели

**Общее время**: 2-4 месяца для полной миграции

## Риски

1. **Потеря данных** - тщательное тестирование миграции
2. **Downtime** - использовать feature flags
3. **Производительность** - мониторинг и оптимизация
4. **Навыки команды** - обучение Node.js/TypeScript