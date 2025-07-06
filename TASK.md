# TASK.md - План рефакторинга фронтенда

## Дата начала: 2025-01-06

## Цель проекта
Замена текущего фронтенда на Streamlit на современный стек React + Node.js + Tailwind CSS с сохранением всего функционала.

## Анализ текущего функционала Streamlit

### Основные компоненты:
1. **Авторизация через Telegram** (streamlit-telegram-login)
2. **Три основных режима работы:**
   - Факт - внесение фактических расходов
   - Бюджет - планирование бюджета
   - Отчетность - аналитика и графики
3. **Справочники:**
   - Пользователи (t_d_user)
   - Периоды (t_d_period)
   - ЦФО - Центры финансовой ответственности (t_d_financial_center)
   - МВЗ - Места возникновения затрат (t_d_cost_center)
   - Номенклатура (t_d_nomenclature)
   - Типы операций (t_d_row_type)
4. **Функциональность:**
   - Иерархический выбор номенклатуры (Счет → Статья → Номенклатура)
   - Валидация форм
   - Отображение последних записей
   - Интерактивные графики (Plotly)
   - Кеширование данных (TTL)

## План рефакторинга

### Фаза 1: Подготовка инфраструктуры (1-2 дня)

#### 1.1 Создание структуры React проекта
- [x] Создать директорию `frontend/` в корне проекта
- [x] Инициализировать React приложение с TypeScript (Vite)
- [x] Настроить Tailwind CSS
- [x] Настроить ESLint и Prettier
- [x] Создать базовую структуру директорий:
  ```
  frontend/
  ├── src/
  │   ├── components/
  │   ├── pages/
  │   ├── services/
  │   ├── hooks/
  │   ├── utils/
  │   ├── types/
  │   └── styles/
  ├── public/
  └── package.json
  ```

#### 1.2 Настройка Node.js backend (BFF - Backend for Frontend)
- [x] Создать директорию `frontend-api/`
- [x] Настроить Express.js сервер с TypeScript
- [x] Реализовать прокси к существующему FastAPI
- [x] Добавить middleware для авторизации
- [x] Настроить session management

#### 1.3 Обновление Docker инфраструктуры
- [x] Создать Dockerfile для React приложения
- [x] Создать Dockerfile для Node.js BFF
- [x] Обновить docker-compose.yaml для включения новых сервисов
- [x] Добавить Traefik labels для всех сервисов (существующих и новых)
- [x] Удалить HAProxy из конфигурации
- [x] Настроить hot-reload для development
- [x] Настроить production build с nginx для статики

### Фаза 2: Реализация авторизации (2-3 дня) ✅

#### 2.1 Telegram OAuth
- [x] Исследовать Telegram Login Widget для React
- [x] Реализовать компонент TelegramLogin
- [x] Настроить Redux/Zustand для управления состоянием пользователя
- [x] Реализовать AuthGuard для защищенных маршрутов
- [x] Добавить logout функциональность

#### 2.2 Session Management
- [x] Настроить sessions через express-session
- [x] Реализовать проверку авторизации на backend
- [x] Добавить interceptors для API запросов

### Фаза 3: Реализация базовых компонентов UI (3-4 дня) ✅ [Завершено: 06.01.2025]

#### 3.1 Layout компоненты
- [x] Header с информацией о пользователе
- [x] Sidebar с навигацией
- [x] Main content area
- [x] Обновление всех страниц для использования Layout

#### 3.2 Form компоненты
- [x] DatePicker
- [x] Select/Dropdown
- [x] Input с валидацией
- [x] TextArea
- [x] Button с различными вариантами
- [ ] Form с валидацией (react-hook-form)

#### 3.3 Display компоненты
- [x] DataTable с сортировкой и фильтрацией
- [x] Loading states
- [x] Card компонент
- [x] Toast notifications

### Фаза 4: Реализация основного функционала (5-7 дней)

#### 4.1 Модуль "Факт"
- [ ] Форма добавления фактических расходов
- [ ] Иерархический выбор номенклатуры
- [ ] Toggle для МВЗ
- [ ] Отображение последних записей
- [ ] График план/факт после добавления

#### 4.2 Модуль "Бюджет"
- [ ] Форма планирования бюджета
- [ ] Выбор периода
- [ ] Операции списание/пополнение
- [ ] Валидация обязательных полей

#### 4.3 Модуль "Отчетность"
- [ ] Выбор ЦФО и периода
- [ ] Вкладки отчетов (Бюджет/План-Факт)
- [ ] Интеграция с Recharts/Chart.js для графиков
- [ ] Экспорт данных

#### 4.4 Модуль "Список продуктов" (НОВЫЙ ФУНКЦИОНАЛ)
- [ ] Создание интерфейса для управления списком продуктов
- [ ] Таблица продуктов с колонками:
  - Наименование продукта
  - Категория
  - Единица измерения
  - Средняя цена
  - Поставщик/Магазин
  - Дата последнего обновления
- [ ] Функции импорта данных:
  - Импорт из Google Sheets API
  - Загрузка из Excel файлов (.xlsx)
  - Загрузка из CSV файлов
  - Drag & Drop для файлов
- [ ] Функции редактирования:
  - Добавление новых продуктов
  - Редактирование существующих
  - Массовое удаление
  - Поиск и фильтрация
- [ ] Интеграция с номенклатурой:
  - Автоматическое сопоставление продуктов с номенклатурой
  - Создание новых позиций номенклатуры из продуктов
- [ ] Аналитика по продуктам:
  - История цен
  - Сравнение цен по магазинам
  - Частота покупок

### Фаза 5: Интеграция API (4-5 дней)

#### 5.1 API Services
- [ ] Создать API client с axios/fetch
- [ ] Реализовать сервисы для каждой сущности:
  - UserService
  - PeriodService
  - FinancialCenterService
  - CostCenterService
  - NomenclatureService
  - RegistryService
  - ReportService
  - ProductService (новый)
  - GoogleSheetsService (новый)
  - FileImportService (новый)

#### 5.2 State Management
- [ ] Настроить Redux Toolkit или Zustand
- [ ] Реализовать slices/stores для каждого модуля
- [ ] Добавить RTK Query или React Query для кеширования

#### 5.3 Оптимизация
- [ ] Реализовать lazy loading для страниц
- [ ] Добавить мемоизацию для тяжелых вычислений
- [ ] Настроить кеширование API запросов

### Фаза 6: Тестирование и оптимизация (2-3 дня)

#### 6.1 Unit тесты
- [ ] Настроить Jest и React Testing Library
- [ ] Написать тесты для компонентов
- [ ] Написать тесты для API сервисов
- [ ] Написать тесты для utils функций

#### 6.2 E2E тесты
- [ ] Настроить Cypress или Playwright
- [ ] Написать тесты основных user flows
- [ ] Добавить визуальное регрессионное тестирование

#### 6.3 Performance
- [ ] Провести аудит с Lighthouse
- [ ] Оптимизировать bundle size
- [ ] Добавить code splitting
- [ ] Настроить PWA функциональность

### Фаза 7: Миграция и развертывание (2-3 дня)

#### 7.1 Подготовка к миграции
- [ ] Создать feature flag для переключения UI
- [ ] Подготовить миграционные скрипты
- [ ] Написать документацию для пользователей

#### 7.2 Развертывание
- [ ] Обновить CI/CD pipeline
- [ ] Настроить мониторинг и логирование
- [ ] Провести нагрузочное тестирование
- [ ] Подготовить rollback план

#### 7.3 Постепенная миграция
- [ ] Развернуть в dev окружении
- [ ] Провести UAT тестирование
- [ ] Развернуть в production с канареечным релизом
- [ ] Мониторинг и исправление issues

## Технический стек

### Frontend:
- React 18+ с TypeScript
- Tailwind CSS для стилизации
- React Router для навигации
- Redux Toolkit или Zustand для state management
- React Query или RTK Query для data fetching
- React Hook Form для форм
- Recharts или Chart.js для графиков
- Axios для HTTP запросов
- Date-fns для работы с датами
- React Table или TanStack Table для таблиц
- React Dropzone для загрузки файлов
- SheetJS для работы с Excel файлами
- PapaParse для работы с CSV

### Backend (BFF):
- Node.js с Express
- TypeScript
- Express-session для сессий
- Passport.js для авторизации
- Winston для логирования
- Joi для валидации

### DevOps:
- Docker multi-stage builds
- Nginx для serving статики (внутри контейнеров React)
- Traefik (уже установлен на сервере) для reverse proxy
- Docker Compose для оркестрации
- GitHub Actions для CI/CD

## Оценка времени

- **Общее время разработки**: 22-32 дня (с учетом нового функционала)
- **С учетом тестирования и отладки**: 30-42 дня
- **Рекомендуемая команда**: 2 разработчика (1 senior, 1 middle)

### Дополнительное время на модуль "Список продуктов":
- Разработка UI: 2-3 дня
- Интеграция с Google Sheets API: 1-2 дня
- Импорт файлов (Excel/CSV): 1-2 дня
- Интеграция с существующей номенклатурой: 1 день
- Тестирование: 1-2 дня

## Риски и митигация

1. **Сложность Telegram авторизации**
   - Митигация: Изучить существующие решения, подготовить fallback

2. **Производительность с большими данными**
   - Митигация: Виртуализация списков, пагинация, lazy loading

3. **Совместимость с существующим API**
   - Митигация: Создать адаптер слой в BFF

4. **Различия в UX между Streamlit и React**
   - Митигация: Провести user research, A/B тестирование

## Критерии успеха

1. Полное сохранение функционала
2. Улучшение производительности на 30%+
3. Улучшение UX (по результатам опросов)
4. 90%+ покрытие тестами
5. Успешная миграция без downtime

## Следующие шаги

1. Утвердить план с командой
2. Создать детальные задачи в issue tracker
3. Настроить development окружение
4. Начать с Фазы 1

---

## Новый функционал - Раздел "Список продуктов"

### Требования к базе данных

Необходимо создать новые таблицы в PostgreSQL:

```sql
-- Таблица продуктов
CREATE TABLE t_d_product (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    category_name VARCHAR(100),
    unit_measure VARCHAR(50),
    barcode VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица цен на продукты
CREATE TABLE t_f_product_price (
    price_id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES t_d_product(product_id),
    supplier_name VARCHAR(255),
    price_value DECIMAL(10, 2),
    price_date DATE,
    user_id INTEGER REFERENCES t_d_user(user_id),
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Связь продуктов с номенклатурой
CREATE TABLE t_l_product_nomenclature (
    product_id INTEGER REFERENCES t_d_product(product_id),
    nomenclature_id INTEGER REFERENCES t_d_nomenclature(nomenclature_id),
    PRIMARY KEY (product_id, nomenclature_id)
);
```

### API Endpoints (FastAPI)

Новые эндпоинты для работы с продуктами:

- `GET /api/products` - получение списка продуктов с пагинацией
- `GET /api/products/{id}` - получение продукта по ID
- `POST /api/products` - создание нового продукта
- `PUT /api/products/{id}` - обновление продукта
- `DELETE /api/products/{id}` - удаление продукта
- `POST /api/products/import/csv` - импорт из CSV
- `POST /api/products/import/excel` - импорт из Excel
- `POST /api/products/import/google-sheets` - импорт из Google Sheets
- `GET /api/products/{id}/prices` - история цен продукта
- `POST /api/products/{id}/prices` - добавление новой цены

### Интеграция с Google Sheets

Использовать существующие credentials из `budget/secrets/`:
- `client_secret.json` - для OAuth
- `service_secret.json` - для Service Account

### Формат импорта данных

#### CSV формат:
```csv
product_name,category,unit,price,supplier
Молоко Простоквашино 2.5%,Молочные продукты,л,89.90,Пятерочка
Хлеб Дарницкий,Хлебобулочные,шт,45.00,Магнит
```

#### Excel формат:
Аналогично CSV, первая строка - заголовки

#### Google Sheets:
Настраиваемое сопоставление колонок через UI

## Обновления и заметки

_Место для добавления заметок в процессе работы_

**2025-01-06**: 
- Добавлен новый функционал - модуль "Список продуктов" для управления справочником продуктов с возможностью импорта из различных источников (Google Sheets, Excel, CSV)
- Уточнено использование Traefik - сервис уже установлен на сервере, требуется только добавление labels к контейнерам
- Завершена Фаза 1: создана инфраструктура React + Node.js BFF с полной Docker-конфигурацией
- Завершена Фаза 2: реализована Telegram OAuth авторизация с Zustand state management

## Конфигурация сервисов для работы с Traefik

### docker-compose.yaml (сервисы с Traefik labels):

```yaml
version: "3.8"

services:
  # HAProxy удаляется из конфигурации
  
  postgres:
    # ... существующая конфигурация ...
    networks:
      - app_network
    # Traefik не нужен для внутренней БД

  budget-api:
    # ... существующая конфигурация ...
    networks:
      - app_network
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=app_network"
      - "traefik.http.routers.budget-api.rule=Host(`${BUDGET_API_SUBDOMAIN}.${DOMAIN}`)"
      - "traefik.http.routers.budget-api.entrypoints=websecure"
      - "traefik.http.routers.budget-api.tls=true"
      - "traefik.http.services.budget-api.loadbalancer.server.port=8888"

  budget-ui:
    # ... существующая конфигурация ...
    networks:
      - app_network
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=app_network"
      - "traefik.http.routers.budget-ui.rule=Host(`${BUDGET_UI_SUBDOMAIN}.${DOMAIN}`)"
      - "traefik.http.routers.budget-ui.entrypoints=websecure"
      - "traefik.http.routers.budget-ui.tls=true"
      - "traefik.http.services.budget-ui.loadbalancer.server.port=8501"

  frontend:
    # Новый React frontend
    container_name: frontend
    build:
      context: ./frontend
      dockerfile: Dockerfile
    networks:
      - app_network
    environment:
      - NODE_ENV=production
      - API_URL=http://frontend-api:4000
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=app_network"
      - "traefik.http.routers.frontend.rule=Host(`${FRONTEND_SUBDOMAIN}.${DOMAIN}`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls=true"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"

  frontend-api:
    # Node.js BFF
    container_name: frontend-api
    build:
      context: ./frontend-api
      dockerfile: Dockerfile
    networks:
      - app_network
    environment:
      - NODE_ENV=production
      - BACKEND_API_URL=http://budget-api:8888
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=app_network"
      - "traefik.http.routers.frontend-api.rule=Host(`${FRONTEND_API_SUBDOMAIN}.${DOMAIN}`)"
      - "traefik.http.routers.frontend-api.entrypoints=websecure"
      - "traefik.http.routers.frontend-api.tls=true"
      - "traefik.http.services.frontend-api.loadbalancer.server.port=4000"

networks:
  app_network:
    external: true  # Сеть должна быть создана заранее и доступна Traefik
```

### Важные моменты для интеграции с Traefik:

1. **Сеть**: Все сервисы должны быть в одной сети с Traefik (`app_network`)
2. **Labels**: Минимальный набор labels для каждого публичного сервиса
3. **Порты**: Убрать публикацию портов (ports) для сервисов за Traefik
4. **Переменные окружения**: Необходимо добавить в .env файл:
   ```
   DOMAIN=example.com
   BUDGET_API_SUBDOMAIN=api
   BUDGET_UI_SUBDOMAIN=budget
   FRONTEND_SUBDOMAIN=app
   FRONTEND_API_SUBDOMAIN=api-app
   ```
5. **TLS**: Traefik автоматически управляет сертификатами