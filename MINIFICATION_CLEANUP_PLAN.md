# План: Удаление минифицированных файлов из git

## Проблема
Минифицированные файлы (*.min.css, *.min.js) отслеживаются git, изменяются при каждой сборке.
Согласно требованиям: в репозитории должны быть ТОЛЬКО исходники, минификация при сборке Docker образов.

## Текущее состояние

### CSS файлы в git (нужно удалить):
1. frontend/web/static/css/tailwind-daisyui.min.css ← генерируется из tailwind.input.css
2. frontend/web/static/css/custom.min.css ← исходник: custom.css ✅
3. frontend/web/static/css/daisyui-overrides.min.css ← исходник: daisyui-overrides.css ✅
4. frontend/web/static/css/choices-tailwind.min.css ← исходник: choices-tailwind.css ✅
5. frontend/web/static/css/loading-dots.min.css ← исходник: loading-dots.css ✅

## План исправления

### ШАГ 1: Изменить package.json
Разделить генерацию и минификацию Tailwind CSS.

### ШАГ 2: Обновить .gitignore
Добавить игнорирование промежуточного tailwind-daisyui.css

### ШАГ 3: Удалить минифицированные из git
git rm --cached для всех *.min.css

### ШАГ 4: Проверить build процесс
Убедиться что npm run build:css генерирует все минифицированные файлы заново
