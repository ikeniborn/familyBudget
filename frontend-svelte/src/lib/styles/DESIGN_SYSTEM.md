# Дизайн-система FamilyBudget

## Обзор

Новая дизайн-система основана на геометрическом минимализме с финансовой тематикой. 
Вдохновлена современными финтех-приложениями с акцентом на доверие, стабильность и простоту использования.

## Цветовая палитра

### Основные цвета

```css
/* Темно-синий - основной бренд-цвет */
--navy-dark: 210 69% 25%; /* #1e3a5f */

/* Светло-голубой - акцентный цвет */
--sky-light: 203 46% 66%; /* #7fb3d5 */

/* Бежевый - теплый акцент */
--beige: 40 33% 70%; /* #d4b896 */

/* Серо-голубой - второстепенный */
--steel: 205 24% 73%; /* #a8c0d0 */
```

### Применение цветов

- **Navy Dark (#1e3a5f)** - Основной текст, кнопки, заголовки
- **Sky Light (#7fb3d5)** - Ссылки, активные состояния, акценты
- **Beige (#d4b896)** - Теплые акценты, вторичная информация
- **Steel (#a8c0d0)** - Границы, неактивные состояния, фоны

## Компоненты

### FinancialIcon

Компонент для отображения финансовых иконок в круглых контейнерах.

```svelte
<FinancialIcon icon="$" variant="navy" size="lg" />
<FinancialIcon icon="📊" variant="beige" size="md" />
<FinancialIcon icon="%" variant="steel" size="sm" />
```

**Пропсы:**
- `icon: string` - символ или эмодзи для отображения
- `variant: 'navy' | 'sky' | 'beige' | 'steel'` - цветовая схема
- `size: 'sm' | 'md' | 'lg'` - размер иконки

### Button (обновленный)

```svelte
<Button variant="default">Основная кнопка</Button>
<Button variant="accent">Акцентная кнопка</Button>
<Button variant="warm">Теплая кнопка</Button>
<Button variant="outline">Контурная кнопка</Button>
```

**Новые варианты:**
- `accent` - голубая акцентная кнопка
- `warm` - бежевая теплая кнопка

### Card (обновленный)

```svelte
<Card variant="elevated">Приподнятая карточка</Card>
<Card variant="navy">Карточка с синей границей</Card>
<Card variant="sky">Карточка с голубой границей</Card>
<Card variant="beige">Карточка с бежевой границей</Card>
```

## CSS-классы

### Геометрические формы

```css
.geometric-circle          /* Круг с градиентом */
.geometric-circle-beige    /* Бежевый круг */
.geometric-rectangle       /* Прямоугольник */
.geometric-triangle-up     /* Треугольник вверх */
.geometric-triangle-down   /* Треугольник вниз */
```

### Контейнеры для иконок

```css
.financial-icon            /* Базовая финансовая иконка */
.financial-icon.navy       /* Темно-синий вариант */
.financial-icon.beige      /* Бежевый вариант */
.financial-icon.steel      /* Серо-голубой вариант */
```

### Макеты

```css
.abstract-layout           /* Абстрактный фон с декорациями */
.design-card               /* Карточка в новом стиле */
.design-card.elevated      /* Приподнятая карточка */
```

### Типографика

```css
.display-heading           /* Большой заголовок */
.subtitle                  /* Подзаголовок */
```

### Декоративные элементы

```css
.geometric-decoration      /* Базовый декоративный элемент */
.geometric-decoration.circle-1    /* Большой круг справа сверху */
.geometric-decoration.circle-2    /* Малый круг слева снизу */
.geometric-decoration.rectangle-1 /* Прямоугольник слева */
.geometric-decoration.triangle-1  /* Треугольник справа снизу */
```

## Примеры использования

### Страница входа

```svelte
<div class="abstract-layout flex items-center justify-center p-4">
  <div class="geometric-decoration circle-1"></div>
  <div class="geometric-decoration circle-2"></div>
  
  <div class="design-card elevated max-w-lg w-full">
    <div class="design-card-body space-y-8">
      <!-- Финансовые иконки -->
      <div class="flex justify-center space-x-6 mb-8">
        <FinancialIcon icon="$" variant="navy" size="lg" />
        <FinancialIcon icon="📊" variant="beige" size="lg" />
        <FinancialIcon icon="%" variant="steel" size="lg" />
      </div>
      
      <h1 class="display-heading text-center">
        ДОМАШНИЙ<br>БУХГАЛТЕР
      </h1>
      <p class="subtitle text-center">
        Сохраняем и приумножаем вместе!
      </p>
      
      <!-- Контент -->
    </div>
  </div>
</div>
```

### Карточки дашборда

```svelte
<Card variant="navy" class="p-6">
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-lg font-semibold">Общий бюджет</h3>
      <p class="text-2xl font-bold">150 000 ₽</p>
    </div>
    <FinancialIcon icon="💰" variant="navy" size="md" />
  </div>
</Card>
```

## Адаптивность

Дизайн-система включает адаптивные брейкпоинты:

- Мобильные устройства: `@media (max-width: 640px)`
- Планшеты: `@media (min-width: 641px) and (max-width: 1024px)`
- Десктоп: `@media (min-width: 1025px)`

### Адаптивные изменения

На мобильных устройствах:
- Финансовые иконки уменьшаются с 64px до 48px
- Геометрические декорации масштабируются
- Заголовки адаптируются под ширину экрана

## Доступность

- Контрастность цветов соответствует WCAG AA
- Все интерактивные элементы имеют focus-состояния
- Размеры touch-целей не менее 44px
- Поддержка клавиатурной навигации

## Анимации

Система включает плавные переходы:
- `transition: all 0.2s ease-in-out` для базовых интеракций
- `hover:transform: translateY(-2px)` для карточек
- `hover:scale(1.05)` для финансовых иконок

## Теневые эффекты

```css
/* Основная тень для геометрических элементов */
--shadow-geometric: 0 4px 20px rgba(30, 58, 95, 0.1);

/* Для приподнятых карточек */
box-shadow: 
  0 10px 40px rgba(30, 58, 95, 0.1),
  0 2px 8px rgba(30, 58, 95, 0.05);
```

## Миграция с старой системы

1. Замените старые цветовые классы:
   - `bg-blue-600` → `bg-primary`
   - `bg-gray-100` → `bg-secondary`
   - `text-gray-600` → `text-muted-foreground`

2. Обновите компоненты Button:
   ```svelte
   <!-- Старый -->
   <Button variant="secondary">Кнопка</Button>
   
   <!-- Новый -->
   <Button variant="accent">Кнопка</Button>
   ```

3. Используйте новые Card варианты:
   ```svelte
   <!-- Старый -->
   <Card variant="blue">
   
   <!-- Новый -->
   <Card variant="navy">
   ```

## Будущие планы

- [ ] Темная тема
- [ ] Больше размеров для FinancialIcon
- [ ] Анимированные переходы между страницами
- [ ] Компонент для графиков в стиле дизайн-системы