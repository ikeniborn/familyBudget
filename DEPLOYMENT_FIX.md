# DEPLOYMENT FIX: Tailwind CSS Version Mismatch

**Проблема:** `npm run build:css` на удаленном сервере возвращает ошибку "could not determine executable to run"

**Причина:** На сервере установлена Tailwind CSS **4.x** вместо **3.4.15** из-за устаревшего `node_modules`

**Статус:** Исправлено в коде (изолированная npm среда + валидация версий)

---

## Быстрое исправление на production сервере

### Шаг 1: Обновить код из репозитория

```bash
# SSH в сервер
cd ~/familyBudget

# Убедиться что находимся на правильной ветке
git branch
# Должно быть: * feature/cdn-to-local-migration

# Обновить код
git pull origin feature/cdn-to-local-migration
```

### Шаг 2: Переустановить npm dependencies

```bash
# Удалить старые node_modules (если существуют в корне)
rm -rf node_modules package-lock.json

# Запустить install.sh для создания изолированной среды
sudo ./install.sh

# Install.sh автоматически:
# 1. Создаст .npm-isolated/ каталог
# 2. Установит dependencies в .npm-isolated/node_modules
# 3. Проверит версию Tailwind CSS (должна быть 3.4.15)
```

### Шаг 3: Проверить установку

```bash
# Проверить что изолированная среда создана
ls -la .npm-isolated/node_modules

# Проверить версию Tailwind CSS
grep '"version"' .npm-isolated/node_modules/tailwindcss/package.json
# Должно вывести: "version": "3.4.15"

# Проверить что package.json требует правильную версию
grep "tailwindcss" package.json
# Должно вывести: "tailwindcss": "3.4.15"
```

### Шаг 4: Тестовый build

```bash
# Тест build в репозитории
cd ~/familyBudget
npm run build:css

# Должно успешно завершиться (~1-2 секунды)
# Output файл:
ls -lh frontend/web/static/css/vendor/tailwind-daisyui.min.css
# Должен быть ~150-200KB
```

### Шаг 5: Деплой

```bash
cd ~/familyBudget
./deploy.sh --sync-mode mirror --profile full

# Deploy.sh автоматически:
# 1. Синхронизирует .npm-isolated/ в /opt/budget
# 2. Проверит версии npm packages
# 3. Запустит npm run build если версии совпадают
```

---

## Verification Checklist

После выполнения шагов выше, проверьте:

### ✓ Репозиторий (~/familyBudget)

```bash
cd ~/familyBudget

# 1. package.json содержит точную версию
grep "tailwindcss" package.json
# ✓ Ожидаемое: "tailwindcss": "3.4.15" (БЕЗ ^ или ~)

# 2. Изолированная среда создана
[ -d .npm-isolated/node_modules ] && echo "✓ OK" || echo "✗ FAILED"

# 3. Tailwind CSS версия правильная
TW_VERSION=$(jq -r '.version' .npm-isolated/node_modules/tailwindcss/package.json 2>/dev/null)
[ "$TW_VERSION" == "3.4.15" ] && echo "✓ OK: $TW_VERSION" || echo "✗ FAILED: $TW_VERSION"

# 4. Build работает
npm run build:css &>/dev/null && echo "✓ OK" || echo "✗ FAILED"

# 5. Output файл создан
[ -f frontend/web/static/css/vendor/tailwind-daisyui.min.css ] && echo "✓ OK" || echo "✗ FAILED"
```

### ✓ Deployment (/opt/budget)

```bash
cd /opt/budget

# 1. Изолированная среда скопирована
[ -d .npm-isolated/node_modules ] && echo "✓ OK" || echo "✗ FAILED"

# 2. Tailwind CSS версия совпадает
TW_VERSION=$(jq -r '.version' .npm-isolated/node_modules/tailwindcss/package.json 2>/dev/null)
[ "$TW_VERSION" == "3.4.15" ] && echo "✓ OK: $TW_VERSION" || echo "✗ FAILED: $TW_VERSION"

# 3. Output файл скопирован
[ -f frontend/web/static/css/vendor/tailwind-daisyui.min.css ] && echo "✓ OK" || echo "✗ FAILED"
```

### ✓ Веб-интерфейс

```bash
# Проверить что CSS файл доступен
curl -I https://your-domain.com/static/css/vendor/tailwind-daisyui.min.css
# Должно вернуть: HTTP/2 200

# Проверить размер файла (должен быть ~150-200KB)
curl -s https://your-domain.com/static/css/vendor/tailwind-daisyui.min.css | wc -c
```

---

## Troubleshooting

### Проблема 1: "node_modules not found in /opt/budget"

**Причина:** .npm-isolated не скопировался из репозитория

**Решение:**
```bash
cd ~/familyBudget
./deploy.sh --sync-mode mirror --profile full
# sync.sh теперь НЕ исключает .npm-isolated из синхронизации
```

### Проблема 2: "Tailwind CSS version mismatch detected!"

**Причина:** Версия в .npm-isolated не совпадает с package.json

**Решение:**
```bash
cd ~/familyBudget
# Удалить .npm-isolated и переустановить
rm -rf .npm-isolated
sudo ./install.sh
```

### Проблема 3: "Build failed - check npm logs"

**Причина:** Corrupted node_modules или missing packages

**Решение:**
```bash
cd ~/familyBudget
# Полная переустановка
rm -rf .npm-isolated
sudo ./install.sh

# Проверить критичные packages
for pkg in terser cssnano-cli tailwindcss daisyui; do
    [ -d .npm-isolated/node_modules/$pkg ] && echo "✓ $pkg" || echo "✗ $pkg MISSING"
done
```

### Проблема 4: "Permission denied" при npm install

**Причина:** install.sh запущен не от sudo

**Решение:**
```bash
sudo ./install.sh
# Script автоматически меняет ownership на SUDO_USER
```

---

## Изменения в архитектуре (для справки)

### До исправления

```
~/familyBudget/
├── node_modules/         # Установлен глобально, может быть 4.x
├── package.json
└── package-lock.json

/opt/budget/
└── [node_modules НЕ копируется - исключен в sync.sh]
```

**Проблема:** node_modules не синхронизируется, build не работает в /opt/budget

### После исправления

```
~/familyBudget/
├── .npm-isolated/             # Изолированная среда
│   ├── node_modules/          # npm packages (Tailwind CSS 3.4.15)
│   ├── .npmrc                 # npm config
│   └── package.json           # Скопирован из корня
├── package.json
└── package-lock.json

/opt/budget/
├── .npm-isolated/             # Копия из репозитория
│   └── node_modules/          # npm packages (проверенные версии)
├── package.json
└── package-lock.json
```

**Решение:**
1. Изолированная среда в .npm-isolated/
2. Автоматическая синхронизация в /opt/budget
3. Валидация версий перед build
4. Автоматическое обнаружение mismatch

---

## Для разработчиков

### Workflow после исправления

```bash
# 1. Локальная разработка (на ПК разработчика)
cd ~/familyBudget
# Изменить код, тестировать

# 2. Коммит и пуш
git add .
git commit -m "feat: новая фича"
git push

# 3. Деплой на сервер (через SSH)
ssh your-server
cd ~/familyBudget
git pull
./deploy.sh --profile full

# Deploy.sh автоматически:
# - Синхронизирует .npm-isolated из репозитория
# - Проверит версии (Tailwind CSS 3.4.15)
# - Запустит build если всё OK
# - Перезапустит services
```

### Когда запускать install.sh

**Запускать ТОЛЬКО если:**
- Изменился package.json (добавлены/удалены dependencies)
- .npm-isolated отсутствует на сервере
- Версии npm packages не совпадают
- Corrupted node_modules

**НЕ запускать при каждом deploy!**

---

## Дополнительная документация

- `install.sh` - функции `setup_isolated_npm_env()`, `check_npm_dependencies()`
- `scripts/lib/sync.sh` - удалено `--exclude='node_modules/'`
- `deploy.sh` - валидация версий Tailwind CSS перед build
- `MIGRATION_CDN_TO_LOCAL.md` - полная документация миграции (строки 282-324)

---

**Версия:** 1.0
**Дата:** 2025-11-08
**Автор:** Claude Code (automated fix)
