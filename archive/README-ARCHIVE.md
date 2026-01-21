# Build Mode Archive - README

## Назначение

Эта ветка содержит **РЕЗЕРВНУЮ КОПИЮ** оригинального deploy.sh с поддержкой build mode (локальная минификация и сборка на сервере).

## Информация о ветке

**Ветка**: `archive/build-mode-backup`
**Создана**: 2026-01-20
**От ветки**: `test`
**Причина создания**: Миграция на registry-first архитектуру (v9.0.0)

## Что сохранено в этой ветке

### 1. Оригинальный deploy.sh с build mode

**Возможности**:
- ✅ Локальная минификация frontend (`npm run build:prod`)
- ✅ Cache busting на сервере
- ✅ Флаги `--force-build` и `--use-registry`
- ✅ Поддержка bind volumes для frontend в docker-compose.yml
- ✅ Nginx отдает статику напрямую (не через backend)

### 2. Критические файлы build mode

- `deploy.sh` (строки 1255-1650 - build логика)
- `scripts/lib/cache_busting.sh` - Cache busting на сервере
- `docker-compose.yml` с build секциями
- `nginx/conf.d/app-https.conf.template` с location /static/

## Когда использовать эту ветку

### Сценарий 1: Проблемы с registry

Если GitHub Container Registry недоступен или возникли проблемы с CI/CD:

```bash
# На сервере (budget-test или budget-prod)
cd /opt/budget
git fetch origin archive/build-mode-backup
git checkout archive/build-mode-backup
sudo bash deploy.sh --force-build
```

### Сценарий 2: Критический откат production

Если registry-first миграция вызвала критические проблемы на production:

```bash
# АВАРИЙНЫЙ ОТКАТ
ssh budget-prod
cd /opt/budget

# Откат на бэкап ветку
git checkout archive/build-mode-backup
git pull origin archive/build-mode-backup

# Деплой со старой логикой
sudo bash deploy.sh --force-build

# Проверка
docker ps
curl http://localhost:8000/health
```

### Сценарий 3: Сравнение версий

Для сравнения старой и новой реализации:

```bash
# Diff deploy.sh
git diff archive/build-mode-backup..test -- deploy.sh

# Diff docker-compose.yml
git diff archive/build-mode-backup..test -- docker-compose.yml
```

## Процедура отката (Rollback)

### ВАРИАНТ 1: Быстрый откат (рекомендуется)

**Время**: ~5 минут
**Риск**: Низкий
**Подходит для**: Временных проблем с registry

```bash
# 1. SSH на сервер
ssh budget-test  # или budget-prod

# 2. Переключение на бэкап ветку
cd /opt/budget
git fetch origin archive/build-mode-backup
git checkout archive/build-mode-backup

# 3. Установка зависимостей (если нужно)
npm ci

# 4. Деплой с build mode
sudo bash deploy.sh --force-build

# 5. Проверка
docker ps                          # Все контейнеры running
curl http://localhost:8000/health  # Backend healthy
docker logs familybudget-backend | tail -50

# 6. Проверка статики
curl http://localhost/static/css/tailwind-daisyui.min.css | head -10
# Должен отдать CSS (nginx отдает напрямую)
```

**Что происходит**:
- ✅ Git переключается на archive/build-mode-backup ветку
- ✅ npm ci устанавливает зависимости (если нужно)
- ✅ deploy.sh выполняет `npm run build:prod` (минификация)
- ✅ deploy.sh выполняет cache busting
- ✅ Docker собирает образы локально (build секции в docker-compose.yml)
- ✅ Контейнеры запускаются с bind mounts для frontend

**Данные**:
- ✅ PostgreSQL data сохранены (postgres_data volume)
- ✅ Redis data сохранены (redis_data volume)
- ✅ Uploads сохранены (./uploads directory)

### ВАРИАНТ 2: Полный откат с очисткой

**Время**: ~10 минут
**Риск**: Средний
**Подходит для**: Критических проблем, требующих чистого состояния

```bash
# 1-2. То же что в Варианте 1

# 3. Остановка всех контейнеров
cd /opt/budget
sudo docker compose down

# 4. Удаление registry образов (опционально)
sudo docker images | grep ghcr.io/ikeniborn/familybudget | awk '{print $3}' | xargs -r sudo docker rmi

# 5. Очистка dangling images
sudo docker image prune -f

# 6. Чистая установка зависимостей
rm -rf node_modules package-lock.json
npm install

# 7. Деплой с build mode
sudo bash deploy.sh --force-build

# 8. Проверка (как в Варианте 1)
```

**Дополнительно удаляется**:
- Registry образы (ghcr.io/ikeniborn/familybudget-*)
- Dangling images
- node_modules (переустановка)

### ВАРИАНТ 3: Аварийное восстановление

**Время**: ~3 минуты
**Риск**: Очень низкий
**Подходит для**: Экстренных ситуаций, когда git недоступен

```bash
# Если git недоступен, используем локальные образы

# 1. Остановка контейнеров
cd /opt/budget
sudo docker compose down

# 2. Список локальных образов
sudo docker images | grep familybudget

# 3. Ручной запуск с предыдущей версией
VERSION=6.6.0 sudo docker compose up -d

# 4. Если образов нет, восстановление из бэкапа
sudo tar -xzf /opt/budget/backups/latest/familybudget-backup-*.tar.gz -C /opt/budget

# 5. Перезапуск
sudo docker compose up -d
```

## Различия build mode vs registry-first

### Build Mode (эта ветка)

**Преимущества**:
- ✅ Не зависит от GitHub Container Registry
- ✅ Полный контроль над сборкой на сервере
- ✅ Легко тестировать изменения локально

**Недостатки**:
- ❌ Медленный деплой (5-7 минут с npm build)
- ❌ Требует Node.js/npm на сервере
- ❌ Build артефакты на сервере
- ❌ Bind mounts для frontend (медленнее на I/O)
- ❌ Nginx config для /static/ (дублирование логики)

### Registry-First Mode (новая архитектура)

**Преимущества**:
- ✅ Быстрый деплой (2-3 минуты, только pull + up)
- ✅ Не требует Node.js/npm на сервере
- ✅ Встроенный frontend в backend образ
- ✅ Единая стратегия версионирования (5 кастомных образов)
- ✅ Cache busting в CI (консистентность)

**Недостатки**:
- ❌ Зависимость от GitHub Container Registry
- ❌ Требует успешный CI/CD перед деплоем
- ❌ Невозможность hotfix без пуша в репозиторий

## Критические отличия в файлах

### deploy.sh

**Build mode** (archive/build-mode-backup):
```bash
# Строки 1255-1260: Cache busting
source scripts/lib/cache_busting.sh
run_cache_busting auto "$REPO_DIR"

# Строки 1440-1650: Frontend build
info "Running frontend build..."
npm run build:prod
```

**Registry-first** (test ветка после миграции):
```bash
# Cache busting УДАЛЕН (происходит в CI)
# Frontend build УДАЛЕН (происходит в CI)

# Только registry pull
pull_from_registry "$VERSION"
docker compose up -d
```

### docker-compose.yml

**Build mode**:
```yaml
backend:
  build:
    context: .
    dockerfile: backend/Dockerfile
  volumes:
    - ./frontend:/app/frontend:ro  # Bind mount
```

**Registry-first**:
```yaml
backend:
  image: ghcr.io/ikeniborn/familybudget-backend:${VERSION}
  # Нет bind mounts (frontend embedded в образ)
```

### nginx/conf.d/app-https.conf.template

**Build mode**:
```nginx
location /static/ {
    alias /usr/share/nginx/html/static/;
    expires 1y;
}
```

**Registry-first**:
```nginx
# location /static/ УДАЛЕН
# Backend FastAPI отдает через StaticFiles
```

## Тестирование отката

Перед использованием в production, **обязательно** протестируйте откат на budget-test:

```bash
# 1. Тест отката
ssh budget-test
cd /opt/budget
git checkout archive/build-mode-backup
sudo bash deploy.sh --force-build

# 2. Проверки
docker ps
curl http://localhost:8000/health
curl http://localhost/static/css/tailwind-daisyui.min.css | head

# 3. Функциональные тесты
# - Логин через Telegram
# - Создание транзакции
# - WebSocket real-time updates
# - Offline sync
# - Service Worker update

# 4. Откат назад на registry-first
git checkout test
sudo bash deploy.sh

# 5. Проверка что всё работает
```

## Мониторинг после отката

После отката на build mode, следите за:

1. **Размер логов**: Build mode создает больше логов (npm output)
   ```bash
   du -sh /opt/budget/logs/
   ```

2. **Дисковое пространство**: Build артефакты занимают место
   ```bash
   df -h /opt/budget
   du -sh /opt/budget/node_modules
   ```

3. **Время деплоя**: Build mode медленнее (5-7 мин vs 2-3 мин)
   ```bash
   grep "Deployment complete" /opt/budget/logs/deploy.log | tail -5
   ```

4. **Статика**: Nginx должен отдавать /static/ напрямую
   ```bash
   curl -I http://localhost/static/css/tailwind-daisyui.min.css
   # Должно быть: Server: nginx
   ```

## Когда УДАЛИТЬ эту ветку

Эту ветку можно удалить когда:

- ✅ Registry-first миграция стабильна 3+ месяца на production
- ✅ Нет планов возврата к build mode
- ✅ Создан полный бэкап (tar.gz архив)
- ✅ Команда согласна на удаление

**Процедура удаления**:
```bash
# Создать tar.gz архив ПЕРЕД удалением
git checkout archive/build-mode-backup
tar -czf archive/build-mode-backup-$(date +%Y%m%d).tar.gz \
  deploy.sh docker-compose.yml nginx/ scripts/lib/

# Удаление ветки
git push origin --delete archive/build-mode-backup
git branch -D archive/build-mode-backup

# Сохранить архив в безопасном месте
mv archive/build-mode-backup-*.tar.gz /backups/git-archives/
```

## Контакты

**Вопросы об отката**: Проверьте `/docs/architecture/guides/deployment-troubleshooting.md`
**GitHub Issues**: https://github.com/ikeniborn/familyBudget/issues
**Production Monitoring**: `/opt/budget/logs/`

## История изменений

- **2026-01-20**: Создание archive/build-mode-backup ветки при миграции на registry-first
- **TBD**: Стабилизация registry-first на production
- **TBD**: Решение об удалении бэкап ветки

---

**ВАЖНО**: Эта документация описывает ПОСЛЕДНЮЮ РАБОЧУЮ ВЕРСИЮ build mode. Используйте её как справочник для отката в критических ситуациях.
