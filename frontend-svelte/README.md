# Family Budget - SvelteKit Frontend

Фронтенд приложения Family Budget на SvelteKit (миграция с React).

## Структура проекта

```
frontend-svelte/
├── src/
│   ├── lib/                  # Библиотека компонентов и утилит
│   │   ├── components/        # Переиспользуемые компоненты
│   │   │   └── ui/           # UI компоненты (Button, Card, etc.)
│   │   ├── stores/           # Svelte stores для состояния
│   │   ├── services/         # API сервисы
│   │   ├── types/            # TypeScript типы
│   │   └── utils/            # Утилиты
│   ├── routes/               # Страницы приложения (маршрутизация)
│   ├── app.html              # HTML шаблон
│   ├── app.css               # Глобальные стили
│   └── app.d.ts              # Глобальные типы
├── static/                   # Статические файлы
├── .svelte-kit/             # Сгенерированные файлы (игнорируется git)
└── build/                    # Production build (игнорируется git)
```

## Установка и запуск

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Сборка для production
npm run build

# Предпросмотр production сборки
npm run preview

# Проверка типов
npm run check

# Линтинг
npm run lint

# Форматирование кода
npm run format
```

## Технологический стек

- **Framework**: SvelteKit 2.0
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 3.4
- **State Management**: Svelte stores
- **Forms**: svelte-forms-lib + Yup/Zod
- **Tables**: @tanstack/svelte-table
- **Charts**: Chart.js + svelte-chartjs
- **HTTP Client**: Axios
- **Date Utils**: date-fns
- **Icons**: lucide-svelte

## Алиасы путей

Проект настроен со следующими алиасами:

- `$lib` → `src/lib`
- `$components` → `src/lib/components`
- `$stores` → `src/lib/stores`
- `$services` → `src/lib/services`
- `$types` → `src/lib/types`
- `$utils` → `src/lib/utils`

## Переменные окружения

Скопируйте `.env.example` в `.env` и настройте:

```bash
cp .env.example .env
```

Основные переменные:
- `VITE_API_URL` - URL backend API
- `VITE_TELEGRAM_BOT_NAME` - Имя Telegram бота для авторизации

## Миграция с React

### Соответствие компонентов

| React | SvelteKit |
|-------|-----------|
| `useState` | `let` переменная |
| `useEffect` | `onMount`, `$:` reactive |
| `useContext` | Svelte stores |
| `useMemo` | `$:` derived |
| `useCallback` | Обычная функция |
| React Router | SvelteKit routing |
| React Hook Form | svelte-forms-lib |

### План миграции

1. **Фаза 1: Базовая инфраструктура** ✅
   - Настройка проекта
   - Конфигурация TypeScript и Tailwind
   - Базовые типы и сервисы

2. **Фаза 2: Компоненты UI**
   - Миграция UI компонентов
   - Создание системы компонентов

3. **Фаза 3: Страницы и маршрутизация**
   - Миграция страниц
   - Настройка маршрутизации

4. **Фаза 4: Состояние и бизнес-логика**
   - Миграция stores
   - Интеграция с API

5. **Фаза 5: Тестирование и оптимизация**
   - Написание тестов
   - Оптимизация производительности

## Разработка

### Создание компонента

```svelte
<!-- src/lib/components/MyComponent.svelte -->
<script lang="ts">
  export let prop: string;
  
  let count = 0;
  
  $: doubled = count * 2;
  
  function handleClick() {
    count += 1;
  }
</script>

<button on:click={handleClick}>
  {prop}: {count} (doubled: {doubled})
</button>

<style>
  button {
    @apply px-4 py-2 bg-blue-500 text-white rounded;
  }
</style>
```

### Создание страницы

```typescript
// src/routes/example/+page.ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch('/api/data');
  const data = await response.json();
  
  return {
    data
  };
};
```

```svelte
<!-- src/routes/example/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  
  export let data: PageData;
</script>

<h1>Example Page</h1>
<pre>{JSON.stringify(data, null, 2)}</pre>
```

### Создание store

```typescript
// src/lib/stores/example.store.ts
import { writable, derived } from 'svelte/store';

export const count = writable(0);
export const doubled = derived(count, $count => $count * 2);
```

## Docker интеграция

Для запуска в Docker контейнере используйте:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
RUN npm ci --production
EXPOSE 3000
CMD ["node", "build"]
```

## Поддержка

При возникновении проблем:
1. Проверьте логи: `npm run dev`
2. Очистите кеш: `rm -rf .svelte-kit`
3. Переустановите зависимости: `rm -rf node_modules && npm install`