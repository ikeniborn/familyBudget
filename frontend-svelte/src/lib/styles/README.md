# Стили FamilyBudget SvelteKit

## Быстрый старт

### Импорт компонентов

```svelte
import { Button, Card, FinancialIcon } from '$lib/components/ui';
```

### Цвета в Tailwind

```html
<!-- Основные цвета дизайн-системы -->
<div class="bg-navy text-white">Темно-синий</div>
<div class="bg-sky text-white">Светло-голубой</div>
<div class="bg-beige text-navy">Бежевый</div>
<div class="bg-steel text-navy">Серо-голубой</div>

<!-- Семантические цвета -->
<div class="bg-primary text-primary-foreground">Основной</div>
<div class="bg-accent text-accent-foreground">Акцент</div>
<div class="bg-warm-accent text-warm-accent-foreground">Теплый акцент</div>
```

### Основные компоненты

```svelte
<!-- Финансовые иконки -->
<FinancialIcon icon="$" variant="navy" size="lg" />
<FinancialIcon icon="📈" variant="sky" size="md" />

<!-- Кнопки -->
<Button variant="default">Основная</Button>
<Button variant="accent">Акцентная</Button>
<Button variant="warm">Теплая</Button>

<!-- Карточки -->
<Card variant="elevated">
  <div class="design-card-body">
    Контент карточки
  </div>
</Card>
```

### Абстрактный макет

```svelte
<div class="abstract-layout">
  <!-- Декорации -->
  <div class="geometric-decoration circle-1"></div>
  <div class="geometric-decoration circle-2"></div>
  
  <!-- Контент -->
  <main class="container mx-auto px-4 py-8">
    <!-- Ваш контент -->
  </main>
</div>
```

## Файлы

- `app.css` - Основные CSS переменные и базовые стили
- `design-system.css` - Компоненты дизайн-системы
- `DESIGN_SYSTEM.md` - Полная документация