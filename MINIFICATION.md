# Minification Strategy - Family Budget

**Version:** 1.0.0
**Date:** 2025-11-05
**Status:** ✅ Implemented

## Обзор

Inline minification для JS и CSS файлов в production с сохранением имен файлов и автоматическим cache busting.

## Архитектура

### Структура файлов

```
familyBudget/
├── shared/static/          # NEW! Общие модули для web/ и webapp/
│   ├── js/
│   │   ├── calendar-widget.js
│   │   ├── choicesCategoryTree.js
│   │   └── dateFormatter.js
│   └── css/
├── web/static/             # HTMX Web UI
│   ├── js/
│   └── css/
├── webapp/static/          # Telegram Web Apps
│   ├── js/
│   └── css/
├── scripts/lib/
│   └── minify.sh           # Minification script
└── package.json            # Terser + cssnano dependencies
```

## Процесс минификации

### При deployment (`./deploy.sh`)

```bash
1. sync_code_to_deploy      # ~/familyBudget → /opt/budget
2. npm install --production # Установка Terser + cssnano (если нужно)
3. npm run build            # Минификация: app.js → app.min.js
4. run_cache_busting        # Обновление версий: ?v=20251105_HHMM
5. docker compose up        # Деплой с минифицированными файлами
```

### Результат минификации

| Тип | Вход | Выход | Source Map |
|-----|------|-------|------------|
| JS  | `app.js` (18KB) | `app.min.js` (12KB, -33%) | `app.min.js.map` |
| CSS | `app.css` (6KB) | `app.min.css` (5KB, -17%) | - |

**Общая экономия:** ~35% bundle size

## Использование

### Автоматическое (production)

```bash
cd ~/familyBudget
./deploy.sh --profile full
# Минификация происходит автоматически
```

### Ручное (development/testing)

```bash
# Минифицировать все
npm run build

# Только JS
npm run minify:js

# Только CSS
npm run minify:css

# Валидация синтаксиса
npm run validate:minified
```

## Cache Busting

### Поддерживаемые паттерны

Cache busting обновляет версии для:
- ✅ `/webapp/static/js/*.js?v=XXXXXX`
- ✅ `/webapp/static/js/*.min.js?v=XXXXXX`  ← NEW!
- ✅ `/web/static/js/*.js?v=XXXXXX`
- ✅ `/shared/static/js/*.js?v=XXXXXX`      ← NEW!
- ✅ `/static/js/vendor/*.min.js?v=XXXXXX`  ← Vendor libraries

Аналогично для CSS (`*.css`, `*.min.css`).

### Пример обновления версий

```html
<!-- До cache busting -->
<script src="/shared/static/js/calendar-widget.min.js?v=PLACEHOLDER"></script>

<!-- После cache busting -->
<script src="/shared/static/js/calendar-widget.min.js?v=20251105_1430"></script>
```

## Troubleshooting

### Минификация падает

```bash
# Проверить dependencies
npm install

# Проверить синтаксис оригинальных файлов
npx terser --parse webapp/static/js/app.js

# Пересоздать минифицированные файлы
rm -f web/static/js/*.min.js webapp/static/js/*.min.js
npm run build
```

### Cache не обновляется

```bash
# Проверить что cache busting отработал
grep "?v=" web/templates/base.html webapp/add.html

# Если версии не обновились - запустить вручную
bash scripts/lib/cache_busting.sh auto /opt/budget
```

## Performance Impact

**Bundle Size Reduction:**
- Webapp: 193KB → 125KB (-35%, -68KB)
- Web: 216KB → 140KB (-35%, -76KB)

**Network Performance:**
- 3G: 1.5s → 1.0s (-0.5s load time)
- 4G: 155ms → 100ms (-55ms load time)

## Development Workflow

**Локальная разработка (БЕЗ минификации):**
```bash
# Редактируй оригинальные файлы
vim webapp/static/js/app.js

# Тестируй в браузере (dev mode)
uvicorn backend.app.main:app --reload

# Коммит
git commit -m "feat: update app.js"
```

**Production deployment (С минификацией):**
```bash
git push
# На сервере:
cd ~/familyBudget && git pull
./deploy.sh --profile full
# Минификация происходит автоматически
```

## Известные ограничения

1. **Минификация только при deploy** - локально работает с неминифицированными файлами
2. **Source maps не деплоятся** - для безопасности (можно включить если нужно)
3. **Vendor библиотеки пропускаются** - уже минифицированы
4. **Build time +30s** - добавляет ~30 секунд к deployment time

## Дополнительная информация

- **Minification script:** `scripts/lib/minify.sh` (170 lines)
- **Cache busting script:** `scripts/lib/cache_busting.sh` (updated regex)
- **Deploy integration:** `deploy.sh` (lines 344-362)
- **Dependencies:** `package.json` (Terser ^5.34.1, cssnano ^7.0.6)

---

**Автор:** Family Budget Team
**Дата создания:** 2025-11-05
**Последнее обновление:** 2025-11-05
