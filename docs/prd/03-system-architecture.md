## 3. System Architecture

### 3.1 Architecture Overview

**Архитектурный стиль:** Monolithic Backend с separate Bot service

**Обоснование:**
Для семейного приложения с 2-5 пользователями монолитная архитектура проще для разработки и поддержки. Telegram Bot вынесен отдельно для изоляции долгосрочных соединений.

**Слои архитектуры:**

#### 1. Presentation Layer
- **Компоненты:**
  - Telegram Bot Commands (python-telegram-bot) - текстовые команды
  - Telegram Web Apps (Vanilla JS ES6+ + Telegram SDK) - интерактивные HTML формы через Menu Button
  - HTMX Web Interface (Jinja2 templates) - веб-аналитика через браузер
- **Ответственность:** Взаимодействие с пользователем через разные каналы

#### 2. Business Logic Layer
- **Компоненты:** FastAPI Backend
- **Ответственность:**
  - REST API endpoints
  - Бизнес-логика (план-факт аналитика, SCD2 management)
  - Авторизация и аутентификация
  - Data validation

#### 3. Data Layer
- **Компоненты:** PostgreSQL Database
- **Ответственность:**
  - Хранение данных
  - Транзакционная целостность
  - SCD2 версионирование
  - Иерархия через Closure Table

#### 4. Infrastructure Layer
- **Компоненты:** Nginx Reverse Proxy, Docker & Docker Compose, Backup System
- **Ответственность:**
  - HTTPS termination
  - Контейнеризация
  - Резервное копирование

**Архитектурные паттерны:**

| Паттерн | Описание | Реализация |
|---------|----------|------------|
| **MVC** | Model-View-Controller для веб-интерфейса | Jinja2 (View), FastAPI (Controller), SQLModel (Model) |
| **Repository Pattern** | Абстракция доступа к данным | SQLModel repositories для каждой сущности |
| **Dependency Injection** | Управление зависимостями | FastAPI Depends для current_user, db session |
| **SCD Type 2** | Историчность справочников | valid_from, valid_to, is_current в dimension tables |
| **Closure Table** | Иерархические структуры | t_d_article_hierarchy для дерева статей |

### 3.2 Component Description

#### Component 1: Telegram Bot

**Назначение:** Оперативный ввод данных пользователями через Telegram

**Технологии:** Python 3.11+, python-telegram-bot v21+

**Ключевые модули:**
- **ConversationHandler** для многошаговых диалогов (add_expense, add_plan, edit)
- **CommandHandler** для команд (/start, /summary, /help, /settings)
- **Scheduled tasks** для еженедельных отчетов (Python schedule)
- **Budget alert monitor** для уведомлений о превышении (проверка при добавлении факта)

**Интерфейсы:**
- **Вход:** Telegram API (Long Polling)
- **Выход:** HTTP REST к FastAPI Backend

**Развертывание:** Docker container `telegram-bot`

#### Component 2: FastAPI Backend

**Назначение:** Центральный API сервер, бизнес-логика, авторизация

**Технологии:** FastAPI v0.115+, SQLModel, Pydantic, python-jose

**Ключевые модули:**
- **REST API endpoints** (4 группы: Auth, Dictionaries, Facts, Analytics)
- **Telegram OAuth authentication** (hash validation + JWT generation)
- **JWT token management** (7 дней lifetime, httpOnly cookies)
- **Business logic** для план-факт аналитики (GROUP BY queries)
- **SCD2 management** для справочников (close old, insert new)
- **User data isolation middleware** (WHERE user_id = current_user)

**Интерфейсы:**
- **Вход:** HTTP REST от Telegram Bot и Web
- **Выход:** PostgreSQL через SQLModel ORM

**Развертывание:** Docker container `backend`, port 8000

#### Component 3: HTMX Web Interface

**Назначение:** Аналитика и CRUD администрирование через веб-браузер

**Технологии:** HTMX v2.0+, Jinja2, ECharts v5.5+

**Ключевые страницы:**

| Путь | Авторизация | Описание |
|------|-------------|----------|
| `/` | Required | Dashboard с ключевыми метриками |
| `/analytics` | Required | 5 типов графиков (ECharts) |
| `/facts` | Required | Просмотр своих фактов (user) или всех (admin) |
| `/admin/articles` | Admin | CRUD статей (дерево) |
| `/admin/cost_centers` | Admin | CRUD МВЗ |
| `/admin/financial_centers` | Admin | CRUD ЦФО |
| `/admin/periods` | Admin | CRUD периодов |

**Типы графиков:**
1. **Bar chart** - План-факт анализ (столбчатая)
2. **Line chart** - Динамика затрат (линейная)
3. **Pie chart** - Структура расходов (круговая)
4. **Waterfall** - Бюджет waterfall
5. **Heatmap** - Тепловая карта расходов

**Интерфейсы:**
- **Вход:** HTTPS через Nginx
- **Выход:** HTMX AJAX к FastAPI

**Развертывание:** Серверится FastAPI (Jinja2 templates)

#### Component 4: PostgreSQL Database

**Назначение:** Хранение данных с SCD2 и иерархией

**Технологии:** PostgreSQL 16+

**Схема:**

**Dimension Tables:**
- `t_d_user` (пользователи)
- `t_d_article` (статьи расходов, SCD2, иерархия)
- `t_d_financial_center` (ЦФО, SCD2)
- `t_d_cost_center` (МВЗ, SCD2)
- `t_d_period` (периоды, SCD2)
- `t_d_article_hierarchy` (Closure Table)

**Fact Tables:**
- `t_f_registry` (план/факт транзакции)

**Views:**
- `v_d_article_current` (актуальные статьи, is_current=true)
- `v_d_cost_center_current`
- `v_d_financial_center_current`
- `v_d_period_current`

**Ключевые особенности:**
- SCD Type 2 для всех справочников (valid_from, valid_to, is_current)
- Closure Table для иерархии статей
- Constraints на уровне БД (foreign keys, checks)
- Индексы для аналитических запросов (user_id, period_id, article_id)

**Развертывание:** Docker container `postgres`, port 5432 (conditional external access)

#### Component 5: Nginx Reverse Proxy

**Назначение:** HTTPS, reverse proxy, статические файлы

**Технологии:** Nginx (Alpine)

**Конфигурация:**
- **Proxy:** `/` → FastAPI (backend:8000)
- **Static:** `/static` → volume
- **SSL:** Let's Encrypt или самоподписанный сертификат
- **Ports:** 80 (HTTP redirect to HTTPS), 443 (HTTPS)

**Развертывание:** Docker container `nginx`

#### Component 6: Backup System

**Назначение:** Резервное копирование БД

**Технологии:** Bash scripts, pg_dump, Yandex CLI (s3cmd)

**Расписание:**
- **Локально:** Ежедневно в 02:00, retention 7 дней
- **S3:** Еженедельно в воскресенье, retention 28 дней (Яндекс Object Storage)

**Реализация:**
- **Скрипт:** `backup.sh`: pg_dump → gzip → local save → weekly S3 upload
- **Cron:** `0 2 * * * /scripts/backup.sh`

#### Component 7: Deployment Scripts

**Назначение:** Автоматическое развертывание на VPS

**Технологии:** Bash scripts

**Скрипты:**
- **install.sh** - Установка Docker, Docker Compose, утилит, UFW setup
- **setup.sh** - Интерактивная настройка (env vars, secrets, PostgreSQL external access)
- **deploy.sh** - Запуск Docker Compose, health checks
- **backup.sh** - Резервное копирование с S3 upload
- **update.sh** - Pull latest code, rebuild, restart

#### Component 8: Telegram Web Apps (NEW - Phase 3)

**Назначение:** Интерактивные HTML формы через Menu Button в Telegram боте

**Технологии:** Telegram Web Apps SDK, Vanilla JavaScript ES6+, Telegram Theme API

**Ключевые страницы:**

| Путь | Описание | Size |
|------|----------|------|
| `/webapp/index.html` | Main Menu (3x3 grid) + Quick Stats | 9.8KB |
| `/webapp/add.html` | Add Transaction form | 17KB |
| `/webapp/today.html` | Today's transactions | 14KB |
| `/webapp/list.html` | Transaction list + filters | 23KB |
| `/webapp/edit.html` | Edit/Delete transaction (unified) | 23KB |
| `/webapp/stats.html` | Statistics by category | 20KB |
| `/webapp/addplan.html` | Create budget plan | 21KB |
| `/webapp/summary.html` | Plan vs Fact comparison | 23KB |
| `/webapp/search.html` | Advanced search + CSV export | 22KB |

**JavaScript Modules (7 core):**
1. **app.js** - Core initialization, BackButton setup
2. **api.js** - API client с JWT Bearer token auth
3. **auth.js** - InitData validation, token management
4. **ui.js** - Haptic feedback, loading states, messages
5. **validators.js** - Client-side validation (amount, date, required)
6. **theme.js** - Telegram theme integration (light/dark)
7. **storage.js** - CloudStorage wrapper

**CSS Modules (3):**
1. **telegram-theme.css** - Theme variables от Telegram
2. **app.css** - Main styles
3. **forms.css** - Form components

**Bundle Size:** ~190KB total (HTML + JS + CSS) - excellent для mobile

**Ключевые особенности:**
- **Menu Button integration** - запуск через Menu Button (≡) в чате бота
- **JWT Bearer token auth** - `Authorization: Bearer <token>` header
- **Telegram theme support** - Auto light/dark mode
- **Haptic feedback** - через Telegram SDK
- **Period selectors** - Month/Quarter/Year/Custom с auto date calculation
- **Hybrid filtering** - Backend reduces data, client filters
- **CSV export** - Client-side generation с BOM для Excel
- **Client-side aggregation** - Statistics и Summary без backend overload

**Интерфейсы:**
- **Вход:** Telegram Web Apps SDK (Menu Button)
- **Выход:** HTTP REST к FastAPI Backend (`/api/v1/facts`, `/api/v1/articles`, `/api/v1/webapp/validate`)

**Развертывание:** Static files в `/bot/webapp/`, serve через FastAPI StaticFiles

**Authentication Flow:**
1. Telegram SDK provides `initData` (HMAC-SHA256 signed)
2. POST `/api/v1/webapp/validate` → Backend validates, returns JWT token
3. Frontend stores token в `auth.js`, uses `Authorization: Bearer <token>` для всех API calls

**Architecture Decisions:**
- **No endpoint duplication** - использует существующие `/api/v1/facts` и `/api/v1/articles`
- **Single new endpoint** - `/api/v1/webapp/validate` (только initData validation)
- **Delete integrated** - в edit.html (no separate delete.html)
- **Client-side aggregation** - для statistics и summary (no backend stats endpoints needed)

### 3.3 Data Flow

#### Scenario 1: Добавление расхода через Telegram (20 шагов)

```mermaid
sequenceDiagram
    participant User
    participant TBot as Telegram Bot
    participant API as FastAPI
    participant DB as PostgreSQL

    User->>TBot: /add_expense
    TBot->>User: "Введите сумму"
    User->>TBot: "500"
    TBot->>API: GET /api/v1/articles
    API->>DB: SELECT * FROM v_d_article_current
    DB->>API: [список статей с иерархией]
    API->>TBot: JSON response
    TBot->>User: Inline keyboard с категориями
    User->>TBot: callback "Продукты"
    TBot->>User: Inline keyboard с подкатегориями
    User->>TBot: callback "Молочные продукты"
    Note over TBot,User: [аналогично для ЦФО, МВЗ, периода]
    TBot->>API: POST /api/v1/facts {amount: 500, ...}
    API->>API: Валидация + user_id из контекста
    API->>DB: INSERT INTO t_f_registry (...)
    DB->>API: Success
    API->>TBot: {success: true, fact_id: 1234}
    TBot->>User: "✅ Расход добавлен: 500 руб"
    TBot->>TBot: Проверка бюджета (факт/план)
    alt Превышение > 90%
        TBot->>User: "⚠️ Бюджет превышен на 95%"
    end
```

#### Scenario 2: Просмотр аналитики через веб (12 шагов)

```mermaid
sequenceDiagram
    participant User
    participant Nginx
    participant API as FastAPI
    participant DB as PostgreSQL
    participant Browser

    User->>Nginx: GET /analytics (HTTPS)
    Nginx->>API: proxy GET /analytics
    API->>API: Проверка JWT из cookie
    API->>API: Рендер Jinja2 template
    API->>Browser: HTML страница с placeholders
    Browser->>Browser: загрузка ECharts.js
    Browser->>API: HTMX GET /api/v1/analytics/plan_fact
    API->>API: WHERE user_id = current_user
    API->>DB: SELECT ... FROM t_f_registry GROUP BY ...
    DB->>API: Агрегированные данные
    API->>Browser: JSON {plan: [...], fact: [...]}
    Browser->>Browser: ECharts рендерит график
```

#### Scenario 3: CRUD справочников админом (12 шагов)

```mermaid
sequenceDiagram
    participant Admin
    participant Web
    participant API as FastAPI
    participant DB as PostgreSQL

    Admin->>Web: GET /admin/articles
    Web->>API: Запрос страницы
    API->>API: Проверка is_admin=true
    API->>DB: SELECT * FROM v_d_article_current
    API->>API: Построение дерева из Closure Table
    API->>Admin: HTML с деревом статей
    Admin->>API: HTMX PUT /api/v1/articles/5 {name: "Новое имя"}
    API->>API: SCD2 logic
    API->>DB: UPDATE t_d_article SET valid_to=NOW(), is_current=false WHERE id=5
    API->>DB: INSERT INTO t_d_article (code, name, valid_from, is_current) VALUES (...)
    DB->>API: Success, new_id=25
    API->>Admin: HTMX partial update (новая строка)
```

### 3.4 Technology Stack Details

**Python 3.11+**
- Async/await для асинхронных операций
- Type hints для type safety
- Context managers для управления ресурсами

**FastAPI 0.115+**
- Автоматическая генерация OpenAPI документации
- Pydantic для валидации данных
- Dependency Injection для current_user
- Асинхронные endpoint'ы для высокой производительности

**python-telegram-bot 21+**
- ConversationHandler для многошаговых диалогов
- Async/await support
- Inline keyboards для UX
- Long Polling для получения обновлений

**PostgreSQL 16+**
- JSONB для гибких данных (опционально)
- Partitioning capabilities (для будущего масштабирования)
- Full-text search (опционально для поиска)
- Transactional integrity

**HTMX 2.0+**
- `hx-get` для загрузки контента
- `hx-post` для отправки форм
- `hx-swap` для замены элементов
- Минимальный JavaScript код

**ECharts 5.5+**
- 5 типов графиков: bar, line, pie, waterfall, heatmap
- Интерактивность из коробки
- Responsive design
- Богатые опции кастомизации

**Docker & Docker Compose**
- Изоляция компонентов
- Reproducible builds
- Easy deployment
- Version pinning

### 3.5 Infrastructure Architecture

**VPS Требования:**
- **CPU:** 2+ ядер
- **RAM:** 4+ GB
- **Disk:** 50 GB
- **OS:** Ubuntu 20.04+ / Debian 11+

**Docker Compose Конфигурация:**

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"  # Exposed but access controlled by UFW
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}

  backend:
    build: ./backend-fastapi
    ports:
      - "8000:8000"
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}

  telegram-bot:
    build: ./telegram-bot
    depends_on:
      - backend
    environment:
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      BACKEND_API_URL: http://backend:8000/api/v1

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
      - static_files:/usr/share/nginx/html/static
    depends_on:
      - backend

networks:
  familybudget-network:
    driver: bridge

volumes:
  postgres_data:
  backups:
  static_files:
```

**Networking:**
- Bridge network `familybudget-network` для внутренней коммуникации
- Только Nginx открыт наружу (80, 443)
- PostgreSQL опционально открыта (5432) с IP-restriction

**Volumes:**
- `postgres_data` - данные PostgreSQL
- `backups` - локальные бэкапы
- `static_files` - статические файлы веб-интерфейса

### 3.6 Integration Points

**Внешние интеграции:**

1. **Telegram Bot API (Long Polling)**
   - Получение обновлений от пользователей
   - Отправка сообщений и inline keyboards
   - Webhook альтернатива (не используется)

2. **Telegram Login Widget (OAuth)**
   - HMAC-SHA256 валидация hash
   - Получение user data (id, first_name, username)
   - Отсутствие password flow

3. **Яндекс Object Storage (S3 API)**
   - Загрузка еженедельных бэкапов
   - AWS S3-compatible API
   - s3cmd или aws-cli для взаимодействия

### 3.7 Deployment Structure

**Проблема:** При традиционном подходе (развертывание из Git-репозитория) возникают конфликты при `git pull` из-за runtime файлов (.env, data/, logs/).

**Решение:** Разделение исходного кода и рабочей директории развертывания.

#### 3.7.1 Directory Structure

**Структура директорий:**

```
Repository (~/familyBudget)          Deployment (/opt/budget)
├── backend/                         ├── backend/              [copied]
├── bot/                             ├── bot/                  [copied]
├── nginx/                           ├── nginx/                [copied]
├── web/                             ├── web/                  [copied]
├── scripts/                         ├── scripts/              [copied]
├── docker-compose.yml               ├── docker-compose.yml    [copied]
├── .env.example                     ├── .env.example          [copied]
├── deploy.sh                        ├── deploy.sh             [copied]
├── install.sh                       │
├── setup.sh                         ├── .env                  [generated]
├── README.md                        ├── data/                 [runtime]
├── .git/                            ├── logs/                 [runtime]
└── docs/                            ├── backups/              [runtime]
                                     ├── uploads/              [runtime]
                                     ├── certbot/              [runtime]
                                     └── nginx/conf.d/         [runtime configs]
```

**Принципы разделения:**

| Тип файла | Где находится | Описание |
|-----------|---------------|----------|
| **Исходный код** | Repository (~familyBudget) | Python, конфиги, шаблоны - под git |
| **Runtime конфиги** | Deployment (/opt/budget) | .env, override файлы - НЕ в git |
| **Данные** | Deployment (/opt/budget) | PostgreSQL data, logs, backups |
| **Деплой скрипты** | Repository (запускаются оттуда) | install.sh, setup.sh |
| **Деплой скрипт** | Deployment (копируется туда) | deploy.sh |

#### 3.7.2 Deployment Workflow

**Шаг 1: Установка системных зависимостей (один раз)**

```bash
cd ~/familyBudget
sudo ./install.sh
```

**Что делает install.sh:**
- Устанавливает Docker Engine + Docker Compose
- Устанавливает утилиты (curl, git, jq, vim, etc.)
- Настраивает UFW firewall (SSH, HTTP, HTTPS)
- Создает структуру директорий в `/opt/budget`:
  - data/postgres/
  - backups/
  - logs/ (setup.log, deploy.log, nginx/)
  - uploads/
  - certbot/conf/, certbot/www/
  - nginx/conf.d/
- Устанавливает права доступа (owner: текущий пользователь)
- Добавляет пользователя в группу `docker`

**Шаг 2: Настройка приложения**

```bash
cd ~/familyBudget
./setup.sh [--clean]
```

**Что делает setup.sh:**
1. **Проверяет `/opt/budget`** - директория должна существовать
2. **Опционально очищает** (если `--clean`):
   - Интерактивное меню с 3 опциями:
     - [1] Cancel - отмена
     - [2] Backup - копирует /opt/budget в timestamped backup
     - [3] Delete - удаляет без backup (требует подтверждение "DELETE")
3. **Копирует исходный код** из ~/familyBudget в /opt/budget:
   - backend/, bot/, nginx/, web/, scripts/
   - docker-compose.yml, .env.example, deploy.sh
4. **Создает .env файл** в /opt/budget/.env:
   - Интерактивный промпт или использует defaults
   - Генерирует секреты (JWT_SECRET, passwords)
   - Настраивает PostgreSQL external access (опционально)
5. **Генерирует nginx config** (для full profile):
   - Копирует template → /opt/budget/nginx/conf.d/app.conf
   - Заменяет {{DOMAIN}} на реальный домен
6. **Настраивает PostgreSQL external access** (если выбрано):
   - Добавляет UFW правило: `ufw allow from <IP> to any port 5432`
   - Порт 5432 уже exposed в docker-compose.yml
   - Без UFW правила порт заблокирован firewall'ом
7. **Валидирует конфигурацию**
8. **Опционально собирает Docker images**

**Опции setup.sh:**
- `-h, --help` - справка
- `-y, --yes` - non-interactive mode (все defaults)
- `--skip-ufw` - пропустить UFW конфигурацию
- `--skip-build` - не собирать Docker images
- `--clean` - очистить /opt/budget перед setup (интерактивное меню)

**Шаг 3: Развертывание приложения**

```bash
./deploy.sh [--profile full] [--build]
```

**Примечание:** deploy.sh запускается из репозитория, работает с файлами в /opt/budget

**Что делает deploy.sh:**
- Проверяет prerequisites (Docker running, .env exists)
- Валидирует environment variables
- Опционально собирает images (`--build`)
- Останавливает старые сервисы
- Запускает новые сервисы (`docker compose up -d`)
- Ждет health checks
- Запускает database migrations
- Настраивает SSL certificates (для full profile + letsencrypt)
- Выводит статус и URLs

**Опции deploy.sh:**
- `-h, --help` - справка
- `-b, --build` - force rebuild images
- `-d, --detach` - detached mode (default)
- `-f, --foreground` - foreground mode (show logs)
- `-p, --profile PROFILE` - Docker Compose profile (none|full)
- `--no-migrate` - skip database migrations
- `--clean` - clean deployment (удаляет volumes)

#### 3.7.3 Update Workflow

**Обновление приложения после изменений в Git:**

```bash
# 1. Pull latest code в repository
cd ~/familyBudget
git pull origin master

# 2. Re-run setup для копирования обновленного кода
./setup.sh

# 3. Deploy из репозитория (работает с /opt/budget)
./deploy.sh --build
```

**Важно:** Git repository остается чистым - все runtime файлы находятся в /opt/budget.

#### 3.7.4 Security Considerations

**PostgreSQL External Access:**

По умолчанию PostgreSQL НЕ доступна извне Docker network (самая безопасная конфигурация).

Если требуется внешний доступ (pgAdmin, backup tools):

1. **setup.sh спрашивает IP адрес** клиента
2. **Создает UFW rule:**
   ```bash
   ufw allow from <ALLOWED_IP> to any port 5432
   ```
3. **Порт 5432 уже exposed** в docker-compose.yml (постоянно):
   ```yaml
   postgres:
     ports:
       - "5432:5432"  # Exposed but access controlled by UFW
   ```
4. **Все остальные IP блокируются UFW** (firewall активен по умолчанию)

**Файл .env permissions:**
- Автоматически устанавливается `chmod 600` (только owner read/write)
- Никогда не коммитится в git
- Содержит все секреты (passwords, JWT_SECRET, bot token)

**UFW Firewall Rules:**
- SSH (22) - всегда открыт
- HTTP (80) - открыт если full profile
- HTTPS (443) - открыт если full profile
- PostgreSQL (5432) - только для указанного IP (опционально)

#### 3.7.5 Directory Ownership

**После install.sh:**
```bash
/opt/budget/
  owner: <user>:<user>  # пользователь, запустивший sudo ./install.sh
  permissions: 755 (directories), 644 (files)
```

**После setup.sh:**
```bash
/opt/budget/.env
  permissions: 600 (только owner read/write)

/opt/budget/data/postgres/
  permissions: 700 (PostgreSQL контейнер имеет доступ через volumes)

/opt/budget/backups/
  permissions: 700 (только для backup скриптов)
```

#### 3.7.6 Advantages of This Structure

**Преимущества разделения Repository / Deployment:**

1. **Нет git конфликтов** - runtime файлы не мешают `git pull`
2. **Чистый repository** - только source code под версионным контролем
3. **Изоляция окружений** - можно иметь несколько deployments из одного repo
4. **Упрощенные rollback** - просто запускаем deploy.sh с другим тегом
5. **Безопасность** - .env и secrets не попадают в git случайно
6. **Централизованные данные** - все runtime данные в одном месте (/opt/budget)

---

_Продолжение следует..._

