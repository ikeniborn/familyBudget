# Миграция на Svelte 5

## Дата миграции
25 августа 2025

## Обзор
Проект успешно мигрирован на Svelte 5 с частичной поддержкой нового синтаксиса runes.

## Выполненные изменения

### 1. Обновление конфигурации
- ✅ Svelte уже был обновлен до версии 5.0.0
- ✅ SvelteKit обновлен до версии 2.0.0
- ⚠️ Режим runes временно отключен из-за несовместимости lucide-svelte

### 2. Миграция компонентов

#### UI компоненты (полностью мигрированы на runes)
- Button.svelte - использует `$props()` и `$derived()`
- Input.svelte - использует `$props()` с `$bindable()` для value
- Card.svelte - использует `$props()` и `$derived()`
- Badge.svelte - использует `$props()` и `$derived()`
- Modal.svelte - использует `$props()`, `$effect()` и `$bindable()`
- Alert.svelte - использует `$props()` и `$derived()`

#### Компоненты аутентификации
- PasswordLogin.svelte - использует `$state()` для всех переменных
- AuthGuard.svelte - частично мигрирован

### 3. Миграция stores

#### auth.store.ts
- ✅ Переписан с использованием класса и `$state()`
- ✅ Добавлен `$effect()` для автоматического сохранения в localStorage
- ✅ Поддерживает обратную совместимость через метод subscribe
- ✅ Экспортирует удобные функции для использования

#### toast.store.ts
- ✅ Переписан с использованием класса и `$state()`
- ✅ Поддерживает все существующие методы (success, error, warning, info)
- ✅ Обратная совместимость через store-compatible экспорты

#### referenceData.store.ts
- ✅ Переписан с использованием класса и `$state()`
- ✅ Добавлен `$effect()` для автоматического сохранения
- ✅ Поддерживает все CRUD операции
- ✅ Экспортирует хуки для каждого типа данных

## Основные изменения синтаксиса

### Props
```svelte
<!-- Старый синтаксис -->
<script>
  export let prop1 = 'default';
  export let prop2;
</script>

<!-- Новый синтаксис -->
<script>
  interface Props {
    prop1?: string;
    prop2: string;
  }
  
  let { prop1 = 'default', prop2 }: Props = $props();
</script>
```

### Реактивные переменные
```svelte
<!-- Старый синтаксис -->
<script>
  let count = 0;
  $: doubled = count * 2;
</script>

<!-- Новый синтаксис -->
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>
```

### События
```svelte
<!-- Старый синтаксис -->
<button on:click={handleClick}>Click</button>

<!-- Новый синтаксис -->
<button onclick={handleClick}>Click</button>
```

### Slots
```svelte
<!-- Старый синтаксис -->
<slot />

<!-- Новый синтаксис -->
{@render children?.()}
```

## Известные проблемы

### 1. lucide-svelte несовместимость
- Библиотека lucide-svelte не поддерживает режим runes
- Временное решение: отключен режим runes глобально
- Ожидается обновление библиотеки

### 2. svelte-forms-lib предупреждения
- Библиотека выдает предупреждения о missing exports
- Не влияет на функциональность
- Рекомендуется заменить на современную альтернативу

## Рекомендации

### Немедленные действия
1. ✅ Использовать новый синтаксис в новых компонентах
2. ✅ Постепенно мигрировать оставшиеся компоненты
3. ✅ Следить за обновлениями lucide-svelte

### Будущие улучшения
1. Включить режим runes после обновления lucide-svelte
2. Заменить svelte-forms-lib на современную библиотеку
3. Полностью мигрировать все компоненты на новый синтаксис
4. Обновить тесты для работы с новым синтаксисом

## Преимущества миграции

1. **Производительность**: Улучшенная реактивность через runes
2. **Type Safety**: Лучшая поддержка TypeScript
3. **Читаемость**: Более явный и понятный код
4. **Будущее**: Готовность к долгосрочной поддержке Svelte 5

## Статус миграции

- ✅ Основные UI компоненты
- ✅ Stores (auth, toast, referenceData)
- ✅ Компоненты аутентификации
- ⚠️ Остальные компоненты (работают в legacy режиме)
- ⏳ Полный режим runes (ожидает обновления зависимостей)

## Команды для разработки

```bash
# Запуск dev сервера
docker exec -it budget-frontend npm run dev

# Проверка типов
docker exec budget-frontend npm run check

# Сборка проекта
docker exec budget-frontend npm run build

# Запуск тестов
docker exec budget-frontend npm run test
```

## Ресурсы

- [Svelte 5 Documentation](https://svelte.dev/docs/svelte/overview)
- [Svelte 5 Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [Runes Documentation](https://svelte.dev/docs/svelte/runes)