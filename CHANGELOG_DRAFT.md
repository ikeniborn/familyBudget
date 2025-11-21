# Changelog Draft

Черновик changelog entries для будущих GitHub Releases.

**ВАЖНО:** Этот файл НЕ является официальным changelog. Официальные changelog создаются вручную при публикации GitHub Release.

---

## [Unreleased]

### Bug Fixes

#### 🐛 Исправлена ошибка "Cannot find module 'node-releases'" при npm build на чистой системе

**Изменения:**
- 🐛 Исправлен критический баг с резолвингом npm модулей при деплое на чистой системе
- 🔧 Заменен симлинк `node_modules` на использование `NODE_PATH` environment variable
- 🔧 Добавлена автоматическая очистка старых симлинков при деплое
- ✅ Добавлена проверка критических зависимостей в `check_npm_env.sh` (Check 6)
- 📝 Обновлена документация CLAUDE.md с описанием npm Build Environment

**Влияние на пользователей:**
После обновления `npm run build:css` будет работать корректно на чистых системах после `install.sh`. При деплое старые симлинки `node_modules` автоматически удаляются.

**Технические детали:**
- Файлы:
  - `deploy.sh` (lines 941-976) - заменен симлинк на NODE_PATH
  - `scripts/lib/check_npm_env.sh` (lines 124-135) - добавлен Check 6
  - `CLAUDE.md` (lines 126-169) - добавлена секция npm Build Environment
- **Проблема:** Симлинк `/opt/budget/node_modules` → `.npm-isolated/node_modules` нарушал резолвинг вложенных `require()` в bundled модулях (Tailwind CSS → browserslist → node-releases/data/processed/envs.json)
- **Root Cause:** Node.js некорректно резолвит относительные пути для транзитивных зависимостей через симлинки
- **Решение:** Использование `NODE_PATH` для прямого указания пути к модулям без симлинков
- **Commits:** [будет добавлено при коммите]

**Breaking Changes:** Нет

**Migration Guide:**
```bash
# На существующих инсталляциях симлинк удалится автоматически при следующем деплое:
cd ~/familyBudget && git pull
./deploy.sh --profile full

# Ручное удаление (опционально, если требуется до деплоя):
sudo rm /opt/budget/node_modules 2>/dev/null || true
```

**Ссылки:**
- Issue: npm build fails on clean system with "Cannot find module 'node-releases/data/processed/envs.json'"
- Fix PR: [будет добавлено]
- Related: FR-099 (Deployment operations)

---

## Инструкция по использованию

При создании GitHub Release:

1. Скопировать релевантную секцию из [Unreleased]
2. Изменить `## [Unreleased]` на `## v{version} - {date}`
3. Удалить использованную секцию из CHANGELOG_DRAFT.md
4. Опубликовать Release на GitHub

**Пример:**
```markdown
## v5.1.4 - 2025-11-21

### Bug Fixes
#### 🐛 Исправлена ошибка "Cannot find module 'node-releases'"
[скопировать текст выше]
```
