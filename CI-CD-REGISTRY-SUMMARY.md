# Что изменилось: CI/CD Registry Integration (v8.0)

## Краткое описание

Добавлена возможность деплоя на тестовый сервер **без локальной сборки Docker образов** - теперь можно pull готовые образы из GitHub Container Registry (ghcr.io), собранные через CI/CD.

## Ключевые преимущества

**⚡ Скорость:**
- **Раньше:** 5-7 минут (локальная сборка Docker образов)
- **Теперь:** 2-3 минуты (pull готовых образов из registry)
- **Экономия времени:** ~50-60%

**✅ Консистентность:**
- Те же образы что прошли CI/CD проверки (ESLint, TypeScript, pytest, Trivy security scan)
- Гарантированное качество (все проверки прошли в GitHub Actions)

**🚀 Простота:**
- Не требуется Node.js/npm на сервере для registry deployments
- Автоматическое определение тега образа

---

## Как это работает

### 1. GitHub Actions (автоматически при push в test)

Когда вы делаете `git push origin test`, GitHub Actions автоматически:

1. **Frontend build** - собирает TypeScript/CSS
2. **Quality checks** - ESLint, TypeScript, Python mypy/ruff, pytest
3. **Build Docker images** - создает backend и bot образы
4. **Push to ghcr.io** - публикует в GitHub Container Registry с тегами:
   - `test` (от имени ветки)
   - `sha-abc1234` (от git commit hash)
   - `v6.6.0` (если git tag)
   - `latest` (для default branch)
5. **Security scan** - Trivy CVE scanning

**Результат:** Готовые Docker images в `ghcr.io/ikeniborn/familybudget-backend:test` и `ghcr.io/ikeniborn/familybudget-bot:test`

### 2. Deployment на budget-test (вручную или через deploy-test skill)

**Два режима деплоя:**

#### Режим A: Локальная сборка (как раньше)
```bash
# На локальной машине
git push origin test

# SSH на сервер
ssh budget-test

# Деплой с локальной сборкой
cd ~/familyBudget
sudo ./deploy.sh --sync-mode update --cleanup-mode smart --version patch
```
**Время:** 5-7 минут
**Сборка:** Локально на сервере (требует npm, Node.js)

#### Режим B: Registry Pull (НОВОЕ v8.0)
```bash
# На локальной машине
git push origin test
# ⏳ Ждем пока GitHub Actions соберет образы (5-7 мин)

# SSH на сервер
ssh budget-test

# Деплой с pull из registry
cd ~/familyBudget
sudo ./deploy.sh --use-registry --sync-mode update --cleanup-mode smart
```
**Время:** 2-3 минуты
**Сборка:** Нет (pull готовых образов)
**Тег:** Автоопределение (git branch → VERSION → hash → latest)

---

## Как использовать

### Вариант 1: Через deploy-test skill (рекомендуется)

```
Пользователь: "Задеплой на тестовый сервер используя образы из registry"
```

Claude автоматически:
1. Проверит SSH подключение
2. Сделает git pull на сервере
3. Запустит `deploy.sh --use-registry --sync-mode update --cleanup-mode smart`
4. Проанализирует логи
5. Проверит статус контейнеров
6. Выведет итоговый отчет

**Новая опция в интерактивном диалоге:**
```
Вопрос: Какие дополнительные опции применить?
[ ] Стандартный деплой (Recommended)
[✓] --use-registry (Pull pre-built images из ghcr.io)  ← НОВАЯ ОПЦИЯ
[ ] --force-build (Принудительная пересборка)
[ ] --verbose (Детальный вывод)
...
```

### Вариант 2: Вручную (прямо на сервере)

```bash
# SSH на budget-test
ssh budget-test

# Переход в репозиторий
cd ~/familyBudget

# Pull последних изменений
git pull origin test

# Деплой с registry pull
sudo ./deploy.sh --use-registry --sync-mode update --cleanup-mode smart
```

**Дополнительные опции:**
```bash
# С явным указанием тега
sudo ./deploy.sh --use-registry --image-tag test

# С версионированием (version bump без пересборки)
sudo ./deploy.sh --use-registry --version patch

# Rollback на предыдущую версию
sudo ./deploy.sh --use-registry --image-tag sha-abc1234

# Pull production версии
sudo ./deploy.sh --use-registry --image-tag 6.6.0
```

---

## Автоматическое определение тега

При использовании `--use-registry` без явного `--image-tag`, скрипт определяет тег в таком порядке:

1. **Флаг --image-tag** (если указан явно)
   ```bash
   --image-tag test  → ghcr.io/ikeniborn/familybudget-backend:test
   ```

2. **Git branch name** (из ~/familyBudget на сервере)
   ```bash
   cd ~/familyBudget && git branch
   # * test
   → ghcr.io/ikeniborn/familybudget-backend:test
   ```

3. **VERSION файл** (в /opt/budget/VERSION)
   ```bash
   cat /opt/budget/VERSION
   # 6.6.0
   → ghcr.io/ikeniborn/familybudget-backend:6.6.0
   ```

4. **Git short hash** (из ~/familyBudget)
   ```bash
   cd ~/familyBudget && git rev-parse --short HEAD
   # abc1234
   → ghcr.io/ikeniborn/familybudget-backend:sha-abc1234
   ```

5. **Fallback: latest**
   ```bash
   → ghcr.io/ikeniborn/familybudget-backend:latest
   ```

---

## Когда использовать каждый режим

### Используйте Registry Mode (`--use-registry`) когда:
- ✅ GitHub Actions workflow успешно собрал образы
- ✅ Нужен быстрый деплой (50-60% экономия времени)
- ✅ Важна консистентность образов с CI/CD
- ✅ Хотите использовать образы прошедшие все проверки
- ✅ На сервере нет Node.js/npm

### Используйте Build Mode (обычный) когда:
- ✅ Тестируете локальные изменения (еще не в git)
- ✅ CI/CD workflow еще не завершился
- ✅ Нужен air-gapped деплой (без внешних зависимостей)
- ✅ Изменения только в коде (не требуют полной пересборки)

---

## Примеры workflow

### Workflow 1: Быстрый деплой после push

```bash
# Локально
git add .
git commit -m "feat: add new feature"
git push origin test

# ⏳ Ждем GitHub Actions (~5-7 мин)
# Проверяем: https://github.com/user/familyBudget/actions

# Деплой через skill
"Задеплой на тестовый сервер используя образы из registry"
```

**Результат:** Деплой за 2-3 минуты вместо 5-7

### Workflow 2: Rollback на предыдущую версию

```bash
# Если текущая версия сломана, откатываемся
ssh budget-test
cd ~/familyBudget

# Находим предыдущий commit hash
git log --oneline -5
# abc1234 fix: current broken version
# def5678 feat: previous working version  ← откатимся сюда

# Rollback
sudo ./deploy.sh --use-registry --image-tag sha-def5678 --sync-mode skip --cleanup-mode smart
```

**Результат:** Быстрый rollback без пересборки

### Workflow 3: Тестирование production образов

```bash
# Деплой production версии на test сервер для проверки
ssh budget-test
cd ~/familyBudget

sudo ./deploy.sh --use-registry --image-tag 6.6.0 --sync-mode skip --cleanup-mode smart
```

**Результат:** Точно те же образы что в production

---

## Что изменилось в файлах

### Новые файлы:
1. **`.github/workflows/build-and-push.yml`** - CI/CD pipeline (5 jobs)
2. **`.github/workflows/pr-checks.yml`** - PR validation workflow
3. **`scripts/lib/registry.sh`** - Registry integration module
4. **`docs/architecture/ci-cd-build-deploy.md`** - Полная документация CI/CD

### Обновленные файлы:
1. **`deploy.sh`** - добавлены флаги `--use-registry`, `--image-tag`
2. **`scripts/lib/services.sh`** - логика выбора build vs registry mode
3. **`scripts/lib/validation.sh`** - обновлена help документация
4. **`.claude/skills/deploy-test/SKILL.md`** - обновлена v8.0.0 с registry support
5. **`.claude/skills/deploy-test/examples/usage.md`** - добавлен пример registry mode
6. **`eslint.config.js`** - конфигурация ESLint для CI/CD (CommonJS)
7. **`package.json`** - добавлены lint скрипты

### Новые сущности:
- **GitHub Container Registry images:**
  - `ghcr.io/ikeniborn/familybudget-backend:test`
  - `ghcr.io/ikeniborn/familybudget-bot:test`
- **Deployment history log:**
  - `/opt/budget/logs/deployment-history.log`
  - Формат: `[timestamp] mode=registry tag=test result=success user=admin`

---

## Важные замечания

### 1. Требования для registry mode

**На GitHub:**
- ✅ GitHub Actions workflow должен успешно завершиться
- ✅ Образы должны быть опубликованы в ghcr.io

**На сервере:**
- ✅ Docker должен быть аутентифицирован (для приватных репозиториев):
  ```bash
  docker login ghcr.io
  Username: <github_username>
  Password: <github_personal_access_token>
  ```

### 2. Проверка наличия образов

Перед деплоем можно проверить наличие образов:
```bash
# Проверка через docker manifest (не скачивает образ)
docker manifest inspect ghcr.io/ikeniborn/familybudget-backend:test

# Если образ существует - выведет JSON манифест
# Если не существует - ошибка "manifest unknown"
```

### 3. Размеры образов

- **Backend image:** ~400-500 MB
- **Bot image:** ~350-450 MB
- **Total download:** ~750-950 MB (при первом pull)
- **Subsequent pulls:** Только измененные слои (~50-200 MB)

### 4. Deployment history

Все деплои логируются в `/opt/budget/logs/deployment-history.log`:
```
[2026-01-20 22:07:01] mode=registry tag=test result=pull_success user=admin
[2026-01-20 21:15:33] mode=build tag=6.6.0 result=success user=admin
```

Хранится последние 100 записей.

---

## Troubleshooting

### Проблема 1: Image pull fails

**Ошибка:**
```
✗ Failed to pull backend image: ghcr.io/ikeniborn/familybudget-backend:test
```

**Решения:**
1. Проверьте что образ существует:
   ```bash
   docker manifest inspect ghcr.io/ikeniborn/familybudget-backend:test
   ```
2. Проверьте GitHub Actions:
   - Перейдите в https://github.com/user/familyBudget/actions
   - Убедитесь что workflow "Build and Push Docker Images" завершился успешно
3. Для приватных репозиториев - аутентифицируйтесь:
   ```bash
   docker login ghcr.io
   ```
4. Попробуйте другой тег:
   ```bash
   sudo ./deploy.sh --use-registry --image-tag latest
   ```

### Проблема 2: CI/CD workflow не запустился

**Причина:** Workflow триггерится только при push в test branch или создании git tag.

**Решение:**
```bash
# Убедитесь что push в правильную ветку
git branch  # Должен быть test
git push origin test

# Или вручную запустите workflow
# GitHub → Actions → Build and Push Docker Images → Run workflow
```

### Проблема 3: Тег определился неправильно

**Если автоопределение выбрало не тот тег:**
```bash
# Используйте явное указание тега
sudo ./deploy.sh --use-registry --image-tag test
```

---

## Ссылки на документацию

- **CI/CD архитектура:** `docs/architecture/ci-cd-build-deploy.md`
- **Registry module:** `scripts/lib/registry.sh`
- **Deploy-test skill:** `.claude/skills/deploy-test/SKILL.md`
- **GitHub Actions workflows:** `.github/workflows/`
- **Deployment troubleshooting:** `docs/architecture/guides/deployment-troubleshooting.md`

---

## Итого

**Что получили:**
1. ⚡ **Быстрее:** Деплой 2-3 минуты вместо 5-7
2. ✅ **Надежнее:** Образы прошли все CI/CD проверки
3. 🚀 **Проще:** Не нужен Node.js/npm на сервере
4. 🔄 **Гибче:** Можно pull любую версию (rollback, A/B testing)

**Как начать использовать:**
1. Убедитесь что GitHub Actions workflow успешно собрал образы
2. Используйте `--use-registry` флаг при деплое
3. Наслаждайтесь ускорением на 50-60% 🎉

---

**Версия документа:** 1.0
**Дата:** 2026-01-20
**Автор:** Claude Sonnet 4.5
