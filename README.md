# 🏠 Family Budget - Система управления семейным бюджетом

## 📋 О системе

Family Budget - это современное веб-приложение для управления семейным бюджетом с поддержкой нескольких пользователей, авторизацией через Telegram и детальным отслеживанием финансов.

### Основные возможности:
- 📊 **Планирование бюджета** - создание и управление планами расходов по периодам
- 💰 **Учет фактических расходов** - регистрация реальных трат с детализацией
- 📈 **Аналитика и отчеты** - визуализация данных с помощью графиков и диаграмм
- 👥 **Многопользовательский режим** - каждый член семьи имеет свой аккаунт
- 🔐 **Безопасная авторизация** - вход через Telegram или логин/пароль
- 📱 **Адаптивный дизайн** - работа на любых устройствах

## 🚀 Быстрый старт

### Требования
- Docker и Docker Compose
- 2 GB свободной оперативной памяти
- Современный браузер (Chrome, Firefox, Safari, Edge)

### Установка и запуск

1. **Клонируйте репозиторий:**
```bash
git clone https://github.com/your-repo/familyBudget.git
cd familyBudget
```

2. **Настройте переменные окружения:**
```bash
cp .env.example .env
# Отредактируйте .env файл, установив свои пароли и токены
```

3. **Запустите приложение:**
```bash
./scripts/dev.sh -d          # Запуск в фоновом режиме
./scripts/dev.sh --init-db   # Запуск с инициализацией БД
```

4. **Откройте в браузере:**
- Приложение: http://localhost:5173
- API документация: http://localhost:4000/docs

## 📖 Руководство пользователя

### 🔑 Авторизация

#### Вход через Telegram
1. Нажмите кнопку "Войти через Telegram"
2. Авторизуйтесь в Telegram
3. Разрешите доступ к вашим данным
4. Вы будете автоматически перенаправлены в систему

#### Вход по паролю  
1. Введите ваш email
2. Введите пароль
3. Нажмите "Войти"

### 📊 Главная панель (Dashboard)

После входа вы попадаете на главную панель, где отображается:
- **Общий бюджет** - сумма запланированных расходов
- **Потрачено** - сумма фактических расходов
- **Остаток** - доступные средства
- **Графики по категориям** - визуализация расходов
- **Последние транзакции** - недавние операции

### 💼 Управление бюджетом

#### Создание плана бюджета
1. Перейдите в раздел "Бюджет"
2. Нажмите "Добавить план"
3. Заполните:
   - Период (месяц и год)
   - Категорию расходов
   - Плановую сумму
   - Описание (опционально)
4. Сохраните план

#### Редактирование плана
1. В списке планов найдите нужный
2. Нажмите иконку редактирования
3. Внесите изменения
4. Сохраните

### 💳 Учет расходов

#### Добавление факта расхода
1. Перейдите в раздел "Факт"
2. Нажмите "Добавить расход"
3. Укажите:
   - Дату операции
   - Категорию
   - Сумму
   - Описание
   - Место покупки (опционально)
4. Сохраните

#### Массовое добавление
Для быстрого ввода нескольких расходов:
1. Используйте кнопку "Массовый ввод"
2. Заполните таблицу расходов
3. Сохраните все записи одновременно

### 📁 Справочники

Система использует настраиваемые справочники для организации данных:

#### Периоды
- Формат: YYYY.MM (например, 2025.01)
- Автоматическое создание при добавлении планов

#### Категории (Номенклатуры)
Стандартные категории:
- Продукты питания
- Транспорт
- Коммунальные услуги
- Развлечения
- Одежда
- Здоровье
- Образование
- Прочее

Вы можете добавлять свои категории:
1. Перейдите в "Справочники" → "Номенклатуры"
2. Нажмите "Добавить"
3. Введите название и код категории
4. Сохраните

#### Центры финансовой ответственности (ЦФО)
Используются для группировки расходов по ответственным лицам:
- Личные расходы
- Семейные расходы
- Детские расходы

#### Места возникновения затрат (МВЗ)
Для детализации мест трат:
- Магазины
- Онлайн-сервисы
- Рестораны и кафе

### 📈 Отчеты и аналитика

#### Доступные отчеты:
1. **План vs Факт** - сравнение запланированного и фактического
2. **Динамика расходов** - тренды по периодам
3. **Структура расходов** - распределение по категориям
4. **Детальный отчет** - все операции с фильтрами

#### Работа с отчетами:
1. Перейдите в раздел "Отчеты"
2. Выберите тип отчета
3. Настройте фильтры:
   - Период
   - Категории
   - ЦФО/МВЗ
4. Нажмите "Сформировать"

#### Экспорт данных:
- **Excel** - для дальнейшего анализа
- **PDF** - для печати
- **PNG/JPG** - сохранение графиков

### 🛍️ Каталог товаров

Система позволяет вести учет цен на товары:

#### Добавление товара:
1. Раздел "Товары"
2. "Добавить товар"
3. Заполните:
   - Название
   - Единицу измерения
   - Текущую цену
   - Категорию
4. Сохраните

#### Отслеживание цен:
- История изменения цен
- Средняя цена за период
- Графики динамики цен

### ⚙️ Настройки

#### Профиль пользователя:
- Изменение имени
- Настройка уведомлений
- Выбор языка интерфейса
- Настройка темы (светлая/темная)

#### Безопасность:
- Смена пароля
- Двухфакторная аутентификация
- Управление сессиями
- История входов

#### Импорт/Экспорт:
- Загрузка данных из Excel
- Выгрузка в различные форматы
- Резервное копирование

### 👨‍💻 Администрирование системы

**Важно:** Функции администрирования доступны только пользователю с ID 1 (первый зарегистрированный пользователь).

#### Управление пользователями
Администратор имеет доступ к разделу "Пользователи" в настройках системы:

1. **Просмотр всех пользователей:**
   - Список всех зарегистрированных пользователей
   - Информация о последней активности
   - Статистика по использованию

2. **Детальная информация о пользователе:**
   - Профиль пользователя
   - Количество периодов и транзакций
   - Дата последней активности

3. **Удаление пользователей:**
   - Мягкое удаление (деактивация) аккаунта пользователя
   - Пользователь помечается как удаленный, данные сохраняются
   - Безопасное удаление с подтверждением и защитой от случайного удаления
   - Нельзя удалить собственную учетную запись или основного администратора

#### Системные настройки
Администратор может управлять общесистемными параметрами:

1. **Настройки безопасности:**
   - Управление сессиями пользователей
   - Настройка времени жизни токенов
   - Конфигурация авторизации

2. **Импорт и экспорт данных:**
   - Массовый экспорт данных пользователей
   - Импорт данных из внешних систем
   - Создание резервных копий системы

3. **Мониторинг системы:**
   - Просмотр системной информации
   - Анализ производительности
   - Логи системных операций

#### Доступ к admin функциям

**Через веб-интерфейс:**
- В разделе "Настройки" появляется категория "Система"
- Доступ к управлению пользователями
- Системные настройки и мониторинг

**Через API (для разработчиков):**
```bash
# Получить список всех пользователей (только admin)
curl -H "Cookie: connect.sid=..." http://localhost:4000/api/users/

# Получить системную информацию
curl -H "Cookie: connect.sid=..." http://localhost:4000/api/admin/system-info

# Удалить пользователя (необратимая операция!)
curl -X DELETE -H "Cookie: connect.sid=..." http://localhost:4000/api/users/123
```

#### Безопасность admin функций

Система обеспечивает трехуровневую защиту admin функций:

1. **Уровень интерфейса:** Admin элементы скрываются для обычных пользователей
2. **Уровень маршрутизации:** Защита страниц admin панели
3. **Уровень API:** Серверная проверка прав доступа

**Журналирование:** Все admin действия записываются в журнал аудита:
```json
{
  "timestamp": "2025-09-08T14:30:00Z",
  "admin_user_id": 1,
  "action": "user_deletion",
  "target_user_id": 123,
  "ip_address": "192.168.1.100",
  "details": "User deleted with all associated data"
}
```

#### Troubleshooting admin доступа

**Проблема:** Не вижу admin функции
**Решение:**
1. Убедитесь, что ваш user ID = 1
2. Выйдите и войдите заново в систему
3. Очистите кэш браузера

**Проблема:** Ошибка 403 при обращении к admin API
**Решение:**
1. Проверьте аутентификацию (валидная сессия)
2. Убедитесь, что user ID = 1
3. Проверьте логи backend для деталей

**Для разработчиков:**
```bash
# Проверить кто является админом
docker exec -it budget-postgres psql -U budget -d budgetdb -c \
  "SELECT id, username, first_name FROM t_d_user WHERE id = 1;"

# Просмотреть логи admin доступа
docker logs budget-backend | grep -i admin
```

### 👥 Многопользовательский режим

#### Добавление пользователей (для администратора):
1. Настройки → Пользователи
2. "Добавить пользователя"
3. Укажите email и роль
4. Отправьте приглашение

#### Роли пользователей:
- **Администратор** - полный доступ
- **Пользователь** - свои данные
- **Наблюдатель** - только просмотр

### 📱 Мобильная версия

Приложение полностью адаптировано для мобильных устройств:
- Свайп-жесты для навигации
- Оптимизированные формы ввода
- Быстрые действия на главном экране
- Работа в офлайн-режиме (с последующей синхронизацией)

## 🆘 Часто задаваемые вопросы

### Как восстановить пароль?
1. На странице входа нажмите "Забыли пароль?"
2. Введите ваш email
3. Следуйте инструкциям в письме

### Можно ли использовать несколько валют?
Да, в настройках можно добавить дополнительные валюты и настроить автоматическую конвертацию.

### Как настроить автоматические напоминания?
1. Настройки → Уведомления
2. Включите нужные типы напоминаний
3. Настройте расписание

### Безопасны ли мои данные?
- Все данные шифруются
- Пароли хранятся в зашифрованном виде
- Сессии автоматически завершаются
- Регулярное резервное копирование

### Как связаться с поддержкой?
- Email: support@familybudget.com
- Telegram: @familybudget_support
- Раздел "Помощь" в приложении

## 📊 Анализ эффективности и оптимизация

### 🎯 Метрики качества разработки

Система отслеживает следующие метрики эффективности:
- **Workflow compliance rate**: 95% (цель)
- **Token efficiency**: оптимизация через batch операции
- **Quality gates success**: 85% (automated testing)
- **Documentation coverage**: 90% (auto-generation)
- **Code review coverage**: 100% (mandatory delegation)

### 🔄 Обязательный Workflow для Claude Code

Все изменения кода должны проходить следующие этапы:

1. **ANALYZE** - анализ требований
2. **DECOMPOSE** - разбиение на задачи <50 строк
3. **CHECKPOINT** - сохранение состояния проекта
4. **DELEGATE** - использование специализированных агентов:
   - `api-developer` → REST endpoints
   - `frontend-developer` → Svelte компоненты
   - `database-designer` → схема БД
   - `typescript-developer` → типы
   - `uxui-design-architect` → UI/UX
   - `backend-developer` → бизнес-логика
   - `code-documenter` → документация
   - `code-reviewer` → проверка кода
5. **VALIDATE** - автоматические тесты и проверки
6. **DOCUMENT** - обновление документации

### 🛡️ Quality Gates

#### Обязательные проверки перед коммитом:
```bash
# Backend тестирование
docker exec budget-backend python -m pytest --cov=app tests/

# Frontend тестирование  
docker exec budget-frontend npm run test
docker exec budget-frontend npm run check

# Проверка типов
docker exec budget-backend mypy app/
docker exec budget-frontend npm run check
```

#### Автоматизированные проверки:
- **Unit tests**: 80%+ покрытие кода
- **Integration tests**: API endpoints
- **Type checking**: строгая типизация
- **E2E tests**: критические пользовательские сценарии
- **Migrations**: проверка схемы БД

### 📈 Оптимизация производительности

#### Token Usage Optimization:
- Используйте batch operations для множественных операций
- Группируйте похожие файловые операции
- Минимизируйте context switching

Пример:
```bash
# ❌ Неэффективно: множественные мелкие операции
Read file1.py
Read file2.py  
Read file3.py

# ✅ Эффективно: batch операции
MultiRead [file1.py, file2.py, file3.py]
```

#### Automated Testing Pipeline:
```yaml
mandatory_tests:
  pre_commit:
    - docker exec budget-backend python -m pytest --cov=app tests/
    - docker exec budget-frontend npm run test
    - docker exec budget-frontend npm run check
    
  post_implementation:
    - integration_tests: true
    - e2e_tests: true  
    - type_coverage: ">80%"
```

### 📋 Workflow Validation Script

Для обеспечения соблюдения workflow создан валидатор:

```bash
# Создание автоматического валидатора
./scripts/workflow-validator.sh

# Проверки:
- ✓ Делегирование к специализированным агентам
- ✓ Блокирующая валидация перед выполнением кода
```

## 🔧 Решение проблем

### Не работает авторизация через Telegram
1. Проверьте настройки бота в .env файле
2. Убедитесь, что бот активен
3. Проверьте доступность Telegram API

### Ошибка подключения к базе данных
1. Проверьте запущены ли Docker контейнеры
2. Проверьте логи: `docker logs budget-postgres`
3. Переинициализируйте БД: `./scripts/dev.sh --init-db`

### Медленная работа приложения
1. Проверьте ресурсы системы
2. Очистите кэш браузера
3. Перезапустите контейнеры

### Workflow Compliance Issues
1. **Пропуск делегирования**: Используйте специализированных агентов для всех изменений
2. **Отсутствие тестов**: Все новые функции должны покрываться тестами
3. **Несоответствие типов**: Запускайте `npm run check` и `mypy` перед коммитом

## 🛠️ Техническая документация для разработчиков

### Архитектура системы

```
Traefik (80/443) → Frontend (5173) → FastAPI (4000) → PostgreSQL/Redis
```

### Технологический стек

- **Frontend**: SvelteKit 2 + Svelte 4 с TypeScript
- **Backend**: FastAPI + SQLAlchemy 2.0 + Pydantic  
- **Database**: PostgreSQL 13 с партиционированными таблицами
- **Cache**: Redis для сессий и кэширования данных
- **Контейнеризация**: Docker + Docker Compose

### База данных

#### Основные таблицы
- **t_d_user**: Пользователи с Telegram интеграцией (BigInt telegram_id)
- **t_d_period**: Периоды бюджета (формат YYYY.MM)
- **t_d_financial_center**: Центры финансовой ответственности (ЦФО)
- **t_d_cost_center**: Места возникновения затрат (МВЗ)
- **t_d_nomenclature**: Категории бюджета
- **t_f_registry**: Основные транзакции (партиционированы 2023-2030)
- **t_d_product**: Каталог товаров
- **t_f_product_price**: История цен

#### Ключевые связи
- Все данные изолированы по `user_id`
- Типы строк: 1=План, 2=Факт
- Registry связан с period, financial_center, cost_center, nomenclature

### API архитектура

#### Структура endpoints
```
/api/auth/*         # Аутентификация (без user_id)
/api/users/*        # Управление пользователями
/api/periods/*      # CRUD периодов
/api/financial_centers/*  # Управление ЦФО
/api/cost_centers/*       # Управление МВЗ
/api/nomenclatures/*      # Управление категориями
/api/registry/*           # Операции с транзакциями
/api/products/*           # Каталог товаров
/api/reports/*            # Аналитические endpoints
```

#### Управление сессиями
- Redis хранит сессии в формате express-session
- Session ID в cookie `connect.sid`
- User ID в `session.user.id` (number)
- Все endpoints требуют аутентификацию кроме `/auth/*`

#### Формат ответов
```typescript
// Успех
{ success: true, data: {...} }

// Ошибка
{ success: false, error: "message" }

// Список
{ success: true, data: [...], total: number }
```

### Docker окружение

**ВСЕ операции выполняются через Docker контейнеры:**

#### Имена контейнеров:
- Frontend: `budget-frontend`
- Backend: `budget-backend`
- Database: `budget-postgres`
- Cache: `budget-redis`

#### ⚠️ ВАЖНО: Управление контейнерами

**ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА:**
1. **Проверяйте статус контейнеров** перед запуском: `docker ps | grep budget-`
2. **НЕ создавайте дублирующие процессы** в контейнерах
3. **Перезапускайте контейнеры**, а не создавайте новые процессы
4. **Убивайте зависшие процессы** перед перезапуском

```bash
# Проверка дублирующих процессов
docker exec budget-frontend ps aux | grep "npm run dev"
docker exec budget-backend ps aux | grep uvicorn

# Убийство дублирующих процессов
docker exec budget-frontend pkill -f "npm run dev" || true
docker exec budget-backend pkill -f uvicorn || true

# Правильный перезапуск контейнеров
docker restart budget-frontend budget-backend
# ИЛИ
docker-compose restart
```

### Команды для разработки

#### Окружение разработки
```bash
# Запуск разработки
./scripts/dev.sh -d          # Запуск в detached режиме
./scripts/dev.sh --init-db   # Переинициализация базы данных

# Остановка сервисов
docker-compose down

# Полный рестарт
docker-compose down && docker-compose up -d
```

#### Frontend команды (SvelteKit)
```bash
# Сервер разработки (порт 5173)
docker exec budget-frontend npm run dev

# Проверка типов (выполнять перед коммитами)
docker exec budget-frontend npm run check

# Тестирование
docker exec budget-frontend npm run test          # Запуск Vitest тестов
docker exec budget-frontend npm run test:ui       # Запуск тестов с UI
docker exec budget-frontend npm run test:coverage # Генерация отчета покрытия

# Сборка
docker exec budget-frontend npm run build         # Production сборка
docker exec budget-frontend npm run preview       # Просмотр production сборки

# Качество кода
docker exec budget-frontend npm run lint          # ESLint
docker exec budget-frontend npm run format        # Prettier
```

#### Backend команды (FastAPI)
```bash
# Сервер разработки (порт 4000)
docker exec budget-backend uvicorn app.main:app --reload --host 0.0.0.0 --port 4000

# Тестирование
docker exec budget-backend python -m pytest                    # Все тесты
docker exec budget-backend python -m pytest tests/test_auth.py # Конкретный тест
docker exec budget-backend python -m pytest --cov=app         # С покрытием

# Качество кода
docker exec budget-backend black app/      # Форматирование кода
docker exec budget-backend mypy app/       # Проверка типов
docker exec budget-backend flake8 app/     # Линтинг

# Миграции базы данных
docker exec budget-backend alembic upgrade head                           # Применить миграции
docker exec budget-backend alembic revision --autogenerate -m "Description" # Создать миграцию
docker exec budget-backend alembic downgrade -1                          # Откатить одну миграцию
```

#### Операции с БД
```bash
# Доступ к PostgreSQL
docker exec -it budget-postgres psql -U budget -d budgetdb

# Backup/Restore
docker exec budget-postgres pg_dump -U budget budgetdb > backup.sql
docker exec -i budget-postgres psql -U budget budgetdb < backup.sql

# Просмотр логов
docker logs -f budget-backend --tail=100
docker logs -f budget-postgres --tail=50
```

#### Отладка и управление процессами

```bash
# ВАЖНО: Проверка и управление процессами
# Проверить статус контейнеров
docker ps -a | grep budget-

# Найти дублирующие процессы
docker exec budget-frontend ps aux | grep "npm run dev"
docker exec budget-backend ps aux | grep uvicorn

# Убить дублирующие процессы если найдены
docker exec budget-frontend pkill -f "npm run dev" || true
docker exec budget-backend pkill -f uvicorn || true

# Правильный перезапуск (НЕ создавать новые процессы!)
docker restart budget-frontend budget-backend

# Стандартная отладка
```bash
# Статус контейнеров
docker ps -a

# Просмотр логов
docker logs --tail 100 -f <container>

# Shell доступ
docker exec -it budget-backend bash
docker exec -it budget-frontend sh

# Проверка здоровья
curl http://localhost:4000/health     # Backend API
curl http://localhost:5173/           # Frontend
```

### Переменные окружения

Ключевые переменные в `.env`:
- `POSTGRES_PASSWORD` - Пароль root базы данных
- `BUDGET_DB_PASSWORD` - Пароль приложения для БД
- `SESSION_SECRET` - Ключ шифрования сессий
- `TELEGRAM_BOT_TOKEN` - Токен Telegram бота
- `REDIS_URL` - Строка подключения к Redis
- `PASSWORD_AUTH_ENABLED` - Включить авторизацию по паролю

### Изоляция данных

**КРИТИЧНО**: Все запросы к БД ДОЛЖНЫ фильтроваться по `user_id`
- Никогда не показывать данные других пользователей
- Использовать SQLAlchemy фильтры: `.filter(Model.user_id == current_user.id)`
- Сессионная аутентификация обеспечивает изоляцию пользователей

### Документация и Architecture Decision Records (ADR)

#### Структура документации:
```
/docs/
├── architecture/     # Архитектурные решения и ADR
│   ├── adr-001-admin-access-control.md  # ADR для admin системы
│   └── decisions.log                    # Журнал принятых решений
├── api/             # Документация API endpoints
│   ├── admin-endpoints.md               # Admin API endpoints
│   └── security-changes.md              # Изменения безопасности API
├── deployment/      # Инструкции по развертыванию
│   └── admin-setup.md                   # Настройка admin функций
├── templates/       # Шаблоны для документации
│   ├── api-change.md                    # Шаблон изменений API
│   ├── component-change.md              # Шаблон изменений компонентов
│   ├── admin-feature-template.md        # Шаблон admin функций
│   └── architecture-decision.md         # Шаблон ADR
└── efficiency-analysis.md  # Анализы эффективности
```

#### Автоматическое создание документации:
- Новые API endpoints → `/docs/api/`
- Компоненты Svelte → `/docs/components/`
- Архитектурные изменения → `/docs/architecture/`
- ADR создаются автоматически при системных изменениях
- **Admin функции:** Полная документация с примерами и troubleshooting

#### Документация admin системы:
- **[ADR-001 Admin Access Control](/docs/architecture/adr-001-admin-access-control.md)** - Архитектурное решение
- **[Admin API Endpoints](/docs/api/admin-endpoints.md)** - Полная документация API
- **[Security Changes](/docs/api/security-changes.md)** - Изменения безопасности
- **[Admin Setup Guide](/docs/deployment/admin-setup.md)** - Инструкции по настройке

### Code Quality Standards

#### Обязательные проверки:
```bash
# Форматирование и линтинг
docker exec budget-backend black app/
docker exec budget-backend flake8 app/
docker exec budget-frontend npm run lint
docker exec budget-frontend npm run format

# Проверка безопасности
docker exec budget-backend bandit -r app/
```

#### Стандарты файловой организации:
- **Максимум 500 строк на файл**
- **Группировка по функциональности**
- **Относительные импорты внутри пакетов**
- **Строгое соблюдение TypeScript типов**

### Деплой в продакшн

```bash
# Production deployment
./scripts/prod.sh

# Стратегия бэкапов
postgresql/backup/postgres-backup.sh  # Ежедневные бэкапы в Yandex Object Storage
```

### Точки доступа

- Frontend: http://localhost:5173
- API: http://localhost:4000
- API Documentation: http://localhost:4000/docs

## 📊 Performance Monitoring

### Метрики разработки

Система отслеживает следующие KPI:
- **Token efficiency ratio**: output/input токенов
- **Workflow compliance rate**: % соблюдения обязательного процесса
- **Task completion time**: время выполнения задач
- **Quality gates success rate**: % успешных проверок
- **Agent delegation coverage**: % использования специализированных агентов

### Checkpoint System

Используется для создания точек восстановления:
- Автоматические checkpoint'ы каждые 3 значимых изменения
- Recovery points для быстрого восстановления состояния
- Сохранение контекста проекта для длительных сессий

### Smart Context Management

Оптимизация работы с контекстом:
```typescript
interface ContextManager {
  batchSimilarOperations(): Operation[];
  predictNextSteps(): string[];
  optimizeTokenUsage(): TokenStrategy;
}
```

## 📋 Рекомендации по эффективности

### Критический приоритет
1. **Всегда используйте workflow-validator.sh** перед началом работы
2. **Обязательное делегирование** специализированным агентам
3. **Batch operations** для снижения token waste на 50%
4. **Checkpoint creation** для каждой сессии

### Высокий приоритет
1. **Automated testing pipeline** - все изменения должны проходить тесты
2. **Documentation automation** - автоматическое создание документации
3. **Quality gates validation** - блокирующие проверки качества

### Ожидаемые результаты оптимизации
- **Token efficiency**: +50% через batching
- **Workflow compliance**: 33% → 95% через автоматизацию
- **Quality gates success**: 20% → 85% через automated testing
- **Documentation coverage**: 0% → 90% через auto-generation

## 📝 Лицензия

MIT License - см. файл LICENSE

## 🤝 Вклад в проект

Мы приветствуем вклад в развитие проекта! См. CONTRIBUTING.md для деталей.

### Требования к контрибьютерам:
1. Соблюдение обязательного workflow из CLAUDE.md
2. 80%+ покрытие кода тестами
3. Использование специализированных агентов
4. Автоматическое создание документации
5. Прохождение всех quality gates

## 📞 Контакты

- GitHub: [https://github.com/your-repo/familyBudget](https://github.com/your-repo/familyBudget)
- Issues: [https://github.com/your-repo/familyBudget/issues](https://github.com/your-repo/familyBudget/issues)