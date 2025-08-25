# Миграция с React на SvelteKit

## Что сделано

Создана полная структура проекта SvelteKit для миграции с React. Новый проект находится в директории `frontend-svelte` и полностью готов к запуску.

## Структура проекта

```
familyBudget/
├── frontend/           # Существующий React frontend
├── frontend-svelte/    # Новый SvelteKit frontend
│   ├── src/
│   │   ├── lib/       # Библиотеки и компоненты
│   │   │   ├── components/   # UI компоненты
│   │   │   ├── stores/       # Управление состоянием
│   │   │   ├── services/     # API сервисы
│   │   │   ├── types/        # TypeScript типы
│   │   │   └── utils/        # Утилиты
│   │   ├── routes/    # Страницы и маршрутизация
│   │   ├── app.html   # HTML шаблон
│   │   ├── app.css    # Глобальные стили
│   │   └── app.d.ts   # Глобальные типы
│   ├── static/        # Статические файлы
│   └── [конфиг файлы]
└── frontend-api/      # Общий backend API

## Конфигурация

### 1. TypeScript (строгий режим)
- Полная типизация с strict: true
- Алиасы путей для удобного импорта
- Интеграция с SvelteKit типами

### 2. Tailwind CSS
- Настроен с кастомной темой
- Градиентные фоны как в React версии
- Utility-first подход

### 3. Vite
- Быстрая сборка и HMR
- Прокси для API запросов
- Оптимизация для production

### 4. Алиасы путей
- `$lib` → библиотеки
- `$components` → компоненты
- `$stores` → хранилища
- `$services` → API сервисы
- `$types` → типы
- `$utils` → утилиты

## Установленные зависимости

### Основные
- **@tanstack/svelte-table** - таблицы данных
- **svelte-forms-lib** - работа с формами
- **chart.js + svelte-chartjs** - графики
- **axios** - HTTP клиент
- **lucide-svelte** - иконки
- **date-fns** - работа с датами
- **yup/zod** - валидация

### Dev зависимости
- SvelteKit и Svelte 5
- TypeScript 5
- ESLint + Prettier
- Tailwind CSS + PostCSS

## Готовые компоненты

### 1. API клиент (`$services/api.ts`)
- Настроенный axios с interceptors
- Обработка авторизации
- Типизированные запросы

### 2. Сервисы
- **auth.service.ts** - авторизация через Telegram
- **periods.service.ts** - управление периодами
- **registry.service.ts** - работа с реестром

### 3. Stores
- **auth.store.ts** - состояние авторизации
- **toast.store.ts** - уведомления

### 4. UI компоненты
- **Button.svelte** - кнопка с вариантами
- **Card.svelte** - карточка с цветными границами

### 5. Утилиты
- **cn.ts** - объединение классов (как в React)
- **format.ts** - форматирование дат, валют, чисел

## Запуск проекта

### Локальная разработка

```bash
# Перейти в директорию
cd frontend-svelte

# Установить зависимости
npm install

# Скопировать переменные окружения
cp .env.example .env

# Запустить dev сервер
npm run dev
```

Приложение будет доступно на http://localhost:5173

### Через скрипт

```bash
# Запуск SvelteKit версии
./scripts/dev-svelte.sh
```

### Docker разработка

```bash
# Запуск с hot-reload
docker-compose -f docker-compose.svelte-dev.yaml up -d
```

### Production сборка

```bash
# Локально
npm run build
npm run preview

# Docker
docker-compose -f docker-compose.svelte.yaml up -d
```

## Порты

- **5173** - SvelteKit dev server (вместо 5172 для React)
- **4001** - API для SvelteKit версии (если нужен отдельный)
- **3001** - Production SvelteKit (вместо 3000 для React)

## Следующие шаги миграции

### Фаза 1: UI компоненты (1-2 дня)
- [ ] Мигрировать все компоненты из `frontend/src/components/ui`
- [ ] Адаптировать shadcn/ui компоненты
- [ ] Создать систему дизайна

### Фаза 2: Страницы (3-4 дня)
- [ ] Dashboard
- [ ] План/Факт
- [ ] Справочники
- [ ] Отчеты
- [ ] Продукты

### Фаза 3: Бизнес-логика (2-3 дня)
- [ ] Мигрировать все stores
- [ ] Адаптировать хуки в композиции
- [ ] Настроить SSR где нужно

### Фаза 4: Интеграция (1-2 дня)
- [ ] Telegram авторизация
- [ ] Работа с API
- [ ] Кеширование

### Фаза 5: Тестирование (2-3 дня)
- [ ] Unit тесты
- [ ] E2E тесты
- [ ] Performance тесты

## Преимущества SvelteKit

1. **Производительность**
   - Меньший размер бандла (нет runtime)
   - Быстрее initial load
   - Нативная реактивность

2. **Developer Experience**
   - Проще синтаксис
   - Меньше boilerplate
   - Встроенные stores
   - Встроенный роутинг

3. **SEO и SSR**
   - SSR из коробки
   - Статическая генерация
   - Лучше для SEO

4. **Современность**
   - Svelte 5 с runes
   - Vite по умолчанию
   - TypeScript first

## Сравнение с React

| Функция | React | SvelteKit |
|---------|-------|-----------|
| Состояние | useState | let переменная |
| Эффекты | useEffect | onMount, $: |
| Контекст | Context API | Stores |
| Мемоизация | useMemo | $: derived |
| Роутинг | React Router | Встроенный |
| Формы | React Hook Form | svelte-forms-lib |
| Анимации | Framer Motion | Встроенные |

## Полезные ссылки

- [SvelteKit Docs](https://kit.svelte.dev)
- [Svelte Tutorial](https://learn.svelte.dev)
- [Migrating from React](https://kit.svelte.dev/docs/migrating)

## Команды

```bash
# Разработка
npm run dev

# Сборка
npm run build

# Превью production
npm run preview

# Проверка типов
npm run check

# Линтинг
npm run lint

# Форматирование
npm run format
```

## Поддержка

При проблемах:
1. Очистить кеш: `rm -rf .svelte-kit node_modules`
2. Переустановить: `npm install`
3. Проверить логи: `npm run dev`