# TASK.md

## Текущие задачи

### Срочные (Critical)

- [ ] **Вынести секреты из docker-compose.yaml** (2025-01-06)
  - Создать .env файлы для каждого сервиса
  - Обновить docker-compose для использования env_file
  - Добавить .env.example файлы

- [ ] **Добавить базовую аутентификацию для API** (2025-01-06)
  - Implement JWT tokens
  - Add middleware для проверки токенов
  - Update Streamlit для работы с токенами

### Высокий приоритет

- [ ] **Настроить автоматические бэкапы БД**
  - Добавить cron job в docker
  - Настроить ротацию бэкапов
  - Добавить уведомления об ошибках

- [ ] **Создать базовые тесты для API**
  - Setup pytest
  - Написать тесты для основных endpoints
  - Добавить тесты в CI

- [ ] **Документировать API endpoints**
  - Добавить OpenAPI descriptions
  - Создать Postman collection
  - Обновить README с примерами

### Средний приоритет

- [ ] **Добавить Redis для кэширования**
  - Добавить Redis в docker-compose
  - Implement кэширование для частых запросов
  - Добавить TTL для разных типов данных

- [ ] **Настроить логирование**
  - Structured logging в JSON
  - Централизованный сбор логов
  - Log rotation

- [ ] **Оптимизировать запросы к БД**
  - Analyze slow queries
  - Добавить недостающие индексы
  - Implement query optimization

### Низкий приоритет

- [ ] **Улучшить UI/UX**
  - Добавить темную тему
  - Improve mobile responsiveness
  - Add loading states

- [ ] **Расширить интеграцию с Google Sheets**
  - Автоматический импорт данных
  - Двусторонняя синхронизация
  - Шаблоны отчетов

## Выполненные задачи

- [x] **Исправить healthcheck для CouchDB** (2025-01-06)
  - Добавлена аутентификация в healthcheck URL

- [x] **Добавить healthcheck для HAProxy** (2025-01-06)
  - Использован netcat для проверки порта

- [x] **Создать документацию** (2025-01-06)
  - README.md
  - CLAUDE.md
  - PLANNING.md
  - TASK.md

## Backlog (Будущие улучшения)

### Инфраструктура
- Kubernetes deployment
- Auto-scaling
- Multi-region deployment
- CDN для статики

### Функциональность
- Мобильное приложение
- Экспорт в различные форматы
- Интеграция с банками
- ML для прогнозирования расходов
- Семейные группы и права доступа

### Интеграции
- Интеграция с бухгалтерскими системами
- Webhook notifications
- Email уведомления
- SMS alerts

### DevOps
- Blue-green deployments
- Canary releases
- A/B testing infrastructure
- Disaster recovery plan

## Заметки

### Приоритеты
1. **Critical** - Блокирующие проблемы безопасности и стабильности
2. **High** - Важные улучшения, влияющие на пользователей
3. **Medium** - Улучшения производительности и maintainability
4. **Low** - Nice-to-have функции

### Процесс
- Новые задачи добавляются в соответствующий раздел
- При начале работы задача помечается как "В работе"
- После завершения перемещается в "Выполненные" с датой
- Регулярный review и re-prioritization задач