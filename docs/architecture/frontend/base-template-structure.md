# Base Template Structure (base.html)

## Обзор

Документация модульной структуры главного шаблона `frontend/web/templates/base.html` после декомпозиции v7.x.

## История

**До декомпозиции (v6.x):**
- Размер: 2884 строк (135 KB)
- Структура: Монолитный файл с inline CSS/JS
- Проблемы: Сложность поддержки, дублирование кода, трудности навигации

**После декомпозиции (v7.x):**
- Размер: 1355 строк (сокращение на 53%)
- Структура: Модульная с includes/macros
- Преимущества: Легкая поддержка, переиспользование компонентов, улучшенная читаемость

## Модульная структура

### JavaScript модули (templates/scripts/)

| Файл | Размер | Назначение | Зависимости |
|------|--------|-----------|-------------|
| toast-manager.html | 176 строк | showToast(), showToastWithAction() | ❌ Нет |
| service-worker-registration.html | 436 строк | PWA Service Worker регистрация | ✅ toast-manager.html |
| offline-manager-init.html | 220 строк | Offline режим инициализация | ✅ toast-manager.html |
| push-bell-manager.html | 40 строк | Push уведомления управление | ✅ toast-manager.html |
| navbar-sync-badge.html | 115 строк | Sync badge navbar | ✅ toast-manager.html |
| pwa-splash-screen.html | 134 строки | PWA Splash Screen | ❌ Нет |

**КРИТИЧНО: Порядок загрузки!**

JavaScript модули должны загружаться в строгом порядке из-за зависимостей:

```jinja2
<!-- 1. Toast Manager (ПЕРВЫМ!) -->
{% include 'scripts/toast-manager.html' %}

<!-- 2. Service Worker (использует showToast) -->
{% include 'scripts/service-worker-registration.html' %}

<!-- 3. Offline Manager группа (использует showToast) -->
{% if user %}
{% include 'scripts/offline-manager-init.html' %}
{% include 'scripts/push-bell-manager.html' %}
{% include 'scripts/navbar-sync-badge.html' %}
{% endif %}

<!-- 4. PWA Splash (независим) -->
{% include 'scripts/pwa-splash-screen.html' %}
```

**Критическая зависимость**: Service Worker и Offline Manager используют функции `showToast()` и `showToastWithAction()`, которые определены в Toast Manager. Нарушение порядка загрузки приведет к ошибке `ReferenceError: showToast is not defined`.

### Компоненты (templates/components/)

| Файл | Тип | Назначение |
|------|-----|-----------|
| user_dropdown_menu.html | Macro | User dropdown (desktop/mobile варианты) |
| cookie_consent_banner.html | Macro | GDPR cookie consent |
| push_permission_banner.html | Macro | Push notification permission |
| sw_update_modal.html | Macro | Service Worker update modal |

**Использование компонентов:**

```jinja2
<!-- User Dropdown -->
{% from "components/user_dropdown_menu.html" import user_dropdown_menu %}

<!-- Desktop variant -->
{{ user_dropdown_menu(variant='desktop', user=user, request=request) }}

<!-- Mobile variant -->
{{ user_dropdown_menu(variant='mobile', user=user, request=request) }}

<!-- Cookie Consent -->
{% from "components/cookie_consent_banner.html" import cookie_consent_banner %}
{{ cookie_consent_banner() }}

<!-- Push Permission -->
{% from "components/push_permission_banner.html" import push_permission_banner %}
{{ push_permission_banner() }}

<!-- SW Update Modal -->
{% from "components/sw_update_modal.html" import sw_update_modal %}
{{ sw_update_modal() }}
```

### Partials (templates/partials/)

| Файл | Размер | Назначение |
|------|--------|-----------|
| navbar_center_menu.html | 56 строк | Desktop navbar меню с dropdowns |

**Использование partials:**

```jinja2
<!-- Navbar Center Menu -->
{% include 'partials/navbar_center_menu.html' %}
```

### CSS модули (static/css/)

| Файл | Размер | Назначение |
|------|--------|-----------|
| loading-dots.css | 125 строк | Loading dots анимация (.morphing-dots) |
| daisyui-overrides.css (секция 10) | 152 строки | Modal & iOS Safari фиксы (--real-vh, safe-area) |

**CSS Build Pipeline:**

CSS модули автоматически минифицируются через `scripts/minify-vendor.js`:

```bash
# Минификация CSS (PostCSS + cssnano)
npm run minify:vendor-css

# Полная сборка vendor файлов (JS + CSS)
npm run build:vendor
```

**Использование в HTML:**

```html
<!-- Loading dots animation -->
<link rel="stylesheet" href="/static/css/loading-dots.min.css?v=PLACEHOLDER">
```

**Cache busting**: URL параметр `?v=PLACEHOLDER` заменяется на актуальную версию/commit hash во время деплоя.

## Что остается в base.html

### Inline JavaScript (обязательно):

1. **Dark Mode IIFE** (~24 строки)
   - **Причина**: Предотвращает FOUC (Flash of Unstyled Content)
   - **Критичность**: Должен выполняться ДО рендеринга страницы
   - **Расположение**: В `<head>` секции, до загрузки внешних скриптов

2. **handleLogout()** (~28 строк)
   - **Причина**: Используется в HTML через `onclick="handleLogout()"`
   - **Критичность**: Глобальная функция для navbar logout button
   - **Зависимости**: Использует `showToast()` из toast-manager.html

3. **setButtonLoading()** (~32 строки)
   - **Причина**: Утилита для handleLogout() и других inline обработчиков
   - **Критичность**: Управление loading состоянием кнопок

4. **updateRealVH()** (~20 строк)
   - **Причина**: iOS Safari viewport height fix
   - **Критичность**: Должен выполняться сразу при загрузке страницы
   - **Назначение**: Обновляет CSS переменную `--real-vh` для корректного позиционирования модалов

### Inline CSS (критический):

1. **PWA Splash Screen styles** (~68 строк)
   - **Причина**: Мгновенный рендеринг splash screen при холодном старте PWA
   - **Критичность**: Fast First Paint - критичен для UX
   - **Расположение**: В `<head>` секции

2. **Offline detection CSS** (~12 строк)
   - **Причина**: Feature flag CSS для offline элементов
   - **Критичность**: Instant feedback при потере сети

3. **Service Worker Update Icon animations** (~30 строк)
   - **Причина**: Анимации для update button (pulse, gradient)
   - **Критичность**: Визуальная индикация доступного обновления

## Dependency Graph

```
Toast Manager (независим)
    ├─> Service Worker Registration (использует showToast)
    └─> Offline Manager Init (использует showToast)
            ├─> Push Bell Manager
            └─> Navbar Sync Badge

PWA Splash Screen (независим)

User Dropdown Macro (независим)

Cookie Consent Banner (независим, требует initCookieConsent IIFE)

Push Permission Banner (независим, требует initPushBanner IIFE)

SW Update Modal (независим, требует handleUpdateNow/Later)
```

## Использование

### Импорт компонентов

Компоненты импортируются локально, перед использованием:

```jinja2
{% from "components/user_dropdown_menu.html" import user_dropdown_menu %}

<!-- Desktop variant -->
{{ user_dropdown_menu(variant='desktop', user=user, request=request) }}

<!-- Mobile variant -->
{{ user_dropdown_menu(variant='mobile', user=user, request=request) }}
```

### Include модулей

JavaScript модули подключаются через `{% include %}`:

```jinja2
{% include 'scripts/toast-manager.html' %}
{% include 'scripts/service-worker-registration.html' %}
```

### Условная загрузка

Некоторые модули загружаются только для авторизованных пользователей:

```jinja2
{% if user %}
{% include 'scripts/offline-manager-init.html' %}
{% include 'scripts/push-bell-manager.html' %}
{% include 'scripts/navbar-sync-badge.html' %}
{% endif %}
```

## Тестирование

После изменений в модулях проверить:

### Функциональные тесты:
- [ ] PWA функциональность (Service Worker регистрируется, offline mode работает)
- [ ] Toast notifications (success, error, info, toast с action button)
- [ ] User dropdown (desktop показывается на lg+, mobile в мобильном меню)
- [ ] Dark mode переключение (без FOUC при загрузке)
- [ ] iOS Safari модалы (правильное позиционирование с --real-vh)
- [ ] Loading dots анимация (показывается при навигации)
- [ ] Cookie consent (показывается первому посетителю, сохраняется выбор)
- [ ] Push permission banner (показывается после cookie consent)
- [ ] SW Update modal (показывается при доступном обновлении)

### Тесты зависимостей:
- [ ] `showToast()` доступен в Service Worker
- [ ] `showToast()` доступен в Offline Manager
- [ ] `handleLogout()` вызывается из navbar onclick
- [ ] `updateRealVH()` выполняется при resize/orientationchange

### Performance тесты:
- [ ] First Contentful Paint (FCP) < 1.8s
- [ ] Time to Interactive (TTI) < 3.8s
- [ ] No JavaScript errors в консоли
- [ ] CSS модули загружаются и кэшируются
- [ ] Minified файлы существуют (loading-dots.min.css)

## Troubleshooting

### Ошибка: `ReferenceError: showToast is not defined`

**Причина**: Toast Manager загружен ПОСЛЕ Service Worker или Offline Manager

**Решение**:
1. Проверить порядок `{% include %}` директив в base.html
2. Toast Manager ДОЛЖЕН быть загружен ПЕРВЫМ
3. Правильный порядок:
   ```jinja2
   {% include 'scripts/toast-manager.html' %}
   {% include 'scripts/service-worker-registration.html' %}
   {% if user %}
   {% include 'scripts/offline-manager-init.html' %}
   ...
   {% endif %}
   ```

### Ошибка: Модалы некорректно позиционированы на iOS Safari

**Причина**: CSS переменная `--real-vh` не обновляется или секция 10 в daisyui-overrides.css отсутствует

**Решение**:
1. Проверить, что `daisyui-overrides.min.css` загружен
2. Проверить, что секция 10 присутствует в `daisyui-overrides.css`
3. Запустить `npm run build:vendor` для пересборки CSS
4. Проверить, что `updateRealVH()` выполняется при загрузке страницы

### Ошибка: `handleLogout()` не работает

**Причина**: handleLogout() должен оставаться в base.html (используется onclick в HTML)

**Решение**:
1. Проверить, что handleLogout() НЕ был удален из base.html
2. Функция должна находиться в inline `<script>` блоке
3. handleLogout() зависит от showToast() - проверить порядок загрузки

### Ошибка: Loading dots не анимируются

**Причина**: loading-dots.min.css не загружен или не минифицирован

**Решение**:
1. Запустить `npm run build:vendor`
2. Проверить, что файл `frontend/web/static/css/loading-dots.min.css` существует
3. Проверить, что в base.html есть `<link rel="stylesheet" href="/static/css/loading-dots.min.css?v=PLACEHOLDER">`
4. Проверить Network tab в DevTools - файл должен загружаться со status 200

### Ошибка: Cookie consent не показывается

**Причина**: `initCookieConsent()` IIFE не выполнен или localStorage уже содержит consent

**Решение**:
1. Проверить, что `initCookieConsent()` IIFE присутствует в base.html (не был удален при декомпозиции)
2. Очистить localStorage ключ `cookieConsent` для тестирования
3. Проверить консоль на JavaScript ошибки

## Deployment Integration

### Автоматическая сборка при деплое

Deployment скрипт автоматически собирает все vendor файлы перед деплоем:

```bash
# deploy.sh вызывает:
npm run build:prod

# build:prod включает:
npm run build:vendor

# build:vendor минифицирует:
- loading-dots.css → loading-dots.min.css (PostCSS + cssnano)
- htmx.js, choices.js, echarts.js, qr-creator.js → *.min.js (Terser)
```

**Цепочка сборки:**
1. `deploy.sh` → `npm run build:prod` (строка 1499)
2. `package.json build:prod` → `npm run build:vendor` (строка 24)
3. `package.json build:vendor` → `npm run minify:vendor-js` (строка 16)
4. `scripts/minify-vendor.js` → минификация CSS и JS параллельно

### Синхронизация файлов

Deployment использует rsync для синхронизации кода:

```bash
# scripts/lib/sync.sh функция sync_code_to_deploy()
rsync -avc --delete \
  --filter='protect .npm-isolated/' \
  --filter='protect .migration_checksums' \
  --exclude='.env' \
  --exclude='node_modules/' \
  "$REPO_DIR/" "$DEPLOY_DIR/"
```

**Синхронизируются:**
- `frontend/web/templates/` - включая все поддиректории:
  - `scripts/` - JavaScript модули
  - `components/` - Jinja2 макросы
  - `partials/` - Partial templates
- `frontend/web/static/css/` - включая `loading-dots.min.css`
- Все остальные файлы проекта

**Паттерны изменений для перезапуска backend:**

```bash
# scripts/lib/sync.sh строка 824-825
if [[ "$file" == frontend/web/templates/* ]] || \
   [[ "$file" == frontend/web/static/* ]] || \
```

Любое изменение в `templates/` или `static/` триггерит перезапуск backend контейнера для инвалидации Jinja2 кэша.

## Build Pipeline

### CSS Minification

CSS модули минифицируются через PostCSS + cssnano:

```javascript
// scripts/minify-vendor.js
const CSS_FILES = [
  {
    input: path.join(VENDOR_CSS_DIR, 'loading-dots.css'),
    output: path.join(VENDOR_CSS_DIR, 'loading-dots.min.css')
  }
];

function minifyCSS(fileConfig) {
  const { input, output } = fileConfig;
  execSync(`npx postcss ${input} -o ${output} -u cssnano`, {...});
}
```

### Параллельная сборка

JavaScript и CSS минификация выполняются параллельно через `Promise.all()`:

```javascript
async function main() {
  await Promise.all([
    ...JS_FILES.map(file => minifyFile(file)),
    ...CSS_FILES.map(fileConfig => minifyCSS(fileConfig))
  ]);
}
```

## Maintenance

### Добавление нового JavaScript модуля

1. Создать файл в `frontend/web/templates/scripts/module-name.html`
2. Обернуть код в `<script>` тег
3. Добавить documentation comment в начале файла
4. Добавить `{% include 'scripts/module-name.html' %}` в base.html в правильном месте
5. Учесть зависимости (если модуль использует showToast, загрузить ПОСЛЕ toast-manager.html)

### Добавление нового компонента

1. Создать файл в `frontend/web/templates/components/component-name.html`
2. Создать Jinja2 макрос с documentation comment
3. Определить параметры макроса
4. В base.html добавить импорт и вызов:
   ```jinja2
   {% from "components/component-name.html" import component_name %}
   {{ component_name(param1=value1, param2=value2) }}
   ```

### Добавление нового CSS модуля

1. Создать файл в `frontend/web/static/css/module-name.css` (unminified)
2. Добавить в `scripts/minify-vendor.js` в массив `CSS_FILES`
3. Запустить `npm run build:vendor`
4. Добавить в base.html `<link rel="stylesheet" href="/static/css/module-name.min.css?v=PLACEHOLDER">`
5. Добавить `*.min.css` в `.gitignore` (если еще не добавлен)

## Performance Considerations

### Критический CSS остается inline

Следующие CSS блоки остаются inline для Fast First Paint:
- PWA Splash Screen styles (~68 строк)
- Offline detection CSS (~12 строк)
- Service Worker Update Icon animations (~30 строк)

**Причина**: Эти стили критичны для мгновенного рендеринга при загрузке страницы. Вынос в external файл добавит дополнительный HTTP request и задержку.

### Non-critical CSS извлекается

Некритичные стили (loading dots, modal fixes) извлечены в external CSS для:
- Уменьшения размера HTML документа
- Кэширования браузером
- Параллельной загрузки с HTML

### JavaScript модули загружаются синхронно

Все JavaScript модули загружаются синхронно через `{% include %}` для:
- Гарантии правильного порядка выполнения
- Доступности функций (showToast, handleLogout) при рендеринге HTML
- Предотвращения race conditions

## Security Considerations

### XSS Prevention

Все пользовательские данные в компонентах автоматически экранируются Jinja2:

```jinja2
<!-- Безопасно: Jinja2 автоматически экранирует user.username -->
{{ user.username }}

<!-- Опасно: Не использовать! -->
{{ user.username|safe }}
```

### CSP Compatibility

Inline JavaScript сохранен минимально для критических функций. Для строгой CSP политики:
- Используйте nonce для inline scripts
- Или переместите handleLogout/setButtonLoading в external модуль и используйте event listeners вместо onclick

## Future Improvements

### Возможные оптимизации:

1. **DOM Cache Utility** (опционально)
   - Сократить 50+ вызовов `document.getElementById()`
   - Кэшировать DOM элементы в `DOMCache.get(id)`
   - Прирост производительности при частых обращениях к DOM

2. **Event Delegation**
   - Заменить onclick в HTML на event delegation
   - Улучшение совместимости с CSP
   - Более чистый HTML

3. **Lazy Loading модулей**
   - Загрузка некритичных модулей через `defer` или `async`
   - Уменьшение блокирования рендеринга
   - Требует переработки зависимостей

4. **CSS Modules**
   - Использование CSS Modules для компонентов
   - Автоматический scoping классов
   - Предотвращение конфликтов стилей

## References

- [Jinja2 Templates Documentation](https://jinja.palletsprojects.com/)
- [DaisyUI Component Library](https://daisyui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [PWA Best Practices](https://web.dev/pwa/)
- [PostCSS Documentation](https://postcss.org/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
