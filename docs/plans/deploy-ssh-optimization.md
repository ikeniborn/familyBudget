# SSH Deploy Step Optimization

**Дата создания**: 2026-02-03
**Версия**: 1.0
**Scope**: Только `deploy-test` job (Deploy via SSH)
**Цель**: Оптимизация времени деплоя на test сервер

---

## Текущий Deploy Flow (Анализ)

### Job: `deploy-test` (.github/workflows/build-and-push.yml:818-886)

**Dependencies:**
```yaml
needs: [check-version, image-build-push, security-scan]
```
❌ **Проблема**: Ждет завершения security-scan (5-7 минут), хотя может начать деплой сразу после image-build-push

---

### SSH Script Breakdown (Timing Analysis)

```bash
# 1. Git operations (5-10s)
cd ~/familyBudget
git fetch origin
git checkout test
git pull origin test

# 2. Deploy script (90-150s)
sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart
   ├─ pull_from_registry (5 images) → 30-60s
   ├─ docker compose up -d (phased) → 40-60s
   ├─ migrations (Alembic) → 10-20s
   └─ cleanup old images → 10-20s

# 3. Fixed wait (30s)
sleep 30  ← ❌ НЕЭФФЕКТИВНО

# 4. Health checks (5-10s)
docker-compose ps
curl http://localhost:8000/health
curl http://localhost:80
```

**Общее время:** ~140-200 секунд (2.5-3.5 минуты)

---

## Оптимизации Deploy via SSH

### 🔥 P0: Убрать зависимость от security-scan

**Текущее:**
```yaml
deploy-test:
  needs: [check-version, image-build-push, security-scan]
```

**Проблема:**
- Деплой ждет Trivy scan всех 5 образов (5-7 минут)
- Security scan не блокирует функциональность деплоя
- Образы уже в registry, можно деплоить сразу

**Решение:**
```yaml
deploy-test:
  needs: [check-version, image-build-push]
  # security-scan запускается параллельно
```

**Ожидаемый выигрыш:** -5 минут (деплой начинается на 5 мин раньше)

**Риск:** Деплой произойдет до проверки CVE
**Mitigation:**
- Test сервер (не production) - приемлемый риск
- Security issues видны в GitHub Security tab постфактум
- Production деплой должен ждать security-scan

**Файл:** `.github/workflows/build-and-push.yml:820`

---

### 🔥 P0: Заменить sleep 30 на smart health check

**Текущее:**
```bash
sudo bash deploy.sh ...
sleep 30  # Fixed wait
curl -f http://localhost:8000/health
```

**Проблема:**
- Фиксированное ожидание 30 секунд избыточно
- Backend стартует за 10-15 секунд в норме
- При проблемах 30 секунд недостаточно (timeout 60s в compose)

**Решение:**
```bash
sudo bash deploy.sh ...

# Smart polling health check (max 60s, check every 5s)
echo "⏳ Waiting for backend to become healthy..."
for i in {1..12}; do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    ELAPSED=$((i * 5))
    echo "✅ Backend healthy after ${ELAPSED}s"
    break
  fi

  if [ $i -eq 12 ]; then
    echo "❌ Backend health check timeout (60s)"
    sudo docker logs familybudget-backend --tail 50
    exit 1
  fi

  sleep 5
done

# Check nginx (должен быть уже healthy)
curl -f http://localhost:80 || exit 1
```

**Ожидаемый выигрыш:** -15 секунд (среднее время старта 15s вместо 30s)

**Bonus:**
- Раннее обнаружение проблем (если backend не стартует)
- Показывает актуальное время старта в логах
- Лучшая диагностика через docker logs при timeout

**Файл:** `.github/workflows/build-and-push.yml:856-870`

---

### ⚡ P1: Параллелизация git pull и image pull

**Текущее:**
```bash
# Sequential operations
git pull origin test           # 5-10s
sudo bash deploy.sh            # pull images 30-60s
```

**Проблема:**
- Git pull и Docker pull независимы
- Docker images можно начать тянуть ДО git pull (VERSION уже известен из workflow)

**Решение:**
```bash
# Start Docker pull in background
VERSION=$(cat VERSION)
echo "🐳 Pre-pulling Docker images for version $VERSION..."
sudo bash scripts/lib/registry.sh pull_from_registry "$VERSION" &
PULL_PID=$!

# Git operations (parallel)
echo "📥 Pulling latest code..."
git fetch origin
git checkout test
git pull origin test

# Wait for Docker pull to complete
wait $PULL_PID || {
  echo "❌ Docker image pull failed"
  exit 1
}

# Deploy (images already pulled)
sudo bash deploy.sh --skip-pull --sync-mode update --cleanup-mode smart
```

**Требуется:**
- Добавить `--skip-pull` флаг в deploy.sh (skip pull_from_registry)
- Или вынести pull_from_registry в отдельный скрипт

**Ожидаемый выигрыш:** -5-10 секунд (git pull и image pull параллельно)

**Риск:** Средний (требует модификацию deploy.sh)

**Файл:** `.github/workflows/build-and-push.yml:846-854`

---

### ⚡ P1: Убрать docker-compose ps (избыточная проверка)

**Текущее:**
```bash
sudo docker-compose ps           # показывает статусы контейнеров
curl -f http://localhost:8000/health
curl -f http://localhost:80
```

**Проблема:**
- `docker-compose ps` показывает только STATUS (Up 5s), но не проверяет HEALTH
- Дублирование с curl health checks
- Добавляет 2-3 секунды вывода

**Решение:**
```bash
# docker-compose ps удалить, достаточно curl checks
curl -f http://localhost:8000/health || exit 1
curl -f http://localhost:80 || exit 1

# При ошибке показывать docker logs
```

**Ожидаемый выигрыш:** -2 секунды

**Альтернатива (если нужен вывод для логов):**
```bash
# Показывать только при ошибке
if ! curl -sf http://localhost:8000/health > /dev/null; then
  echo "❌ Health check failed, container statuses:"
  sudo docker-compose ps
  sudo docker logs familybudget-backend --tail 50
  exit 1
fi
```

**Файл:** `.github/workflows/build-and-push.yml:861-870`

---

### ⚡ P1: Cleanup в фоновом режиме

**Текущее:**
```bash
sudo bash deploy.sh --cleanup-mode smart
# cleanup_old_images() блокирует до завершения
```

**Проблема:**
- Cleanup старых Docker images может занимать 10-30 секунд
- Не критично для успешности деплоя
- Блокирует health checks

**Решение 1 (в workflow):**
```bash
# Deploy без cleanup
sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode skip

# Cleanup в background (после health checks)
nohup sudo bash scripts/lib/cleanup.sh > /dev/null 2>&1 &
```

**Решение 2 (в deploy.sh):**
```bash
# Модифицировать deploy.sh чтобы cleanup запускался в background
if [[ "$CLEANUP_MODE" == "smart" ]]; then
  cleanup_old_images &  # Background
fi
```

**Ожидаемый выигрыш:** -10-20 секунд

**Риск:** Низкий (cleanup не критичен)

**Файл:**
- `.github/workflows/build-and-push.yml:854`
- `deploy.sh` (требует модификацию)

---

### ⚡ P2: Кэширование git repository на сервере

**Текущее:**
```bash
git fetch origin
git checkout test
git pull origin test
```

**Проблема:**
- При каждом деплое git fetch тянет объекты (5-10s)
- Большая часть объектов уже на сервере

**Решение:**
```bash
# Aggressive git config на сервере
git config fetch.prune true
git config fetch.pruneTags true
git config gc.auto 256  # реже garbage collection

# Shallow pull (только последний коммит)
git fetch origin --depth=1 test
git reset --hard origin/test
```

**Ожидаемый выигрыш:** -3-5 секунд

**Риск:** Низкий

**Файл:** `.github/workflows/build-and-push.yml:847-850`

---

### 🚫 P2: Пропустить checkout code в workflow

**Текущее:**
```yaml
steps:
  - name: Checkout code
    uses: actions/checkout@v4
```

**Проблема:**
- Checkout занимает 3-5 секунд
- Код уже есть на сервере (git pull в SSH script)
- Checkout нужен только для `cat VERSION` в "Deployment Success" step

**Решение:**
```yaml
steps:
  # Убрать checkout, VERSION получать из workflow output
  - name: Deploy via SSH
    uses: appleboy/ssh-action@v1.0.3
    with:
      script: |
        # VERSION уже есть на сервере после git pull
        ...

  - name: Deployment Success
    if: success()
    run: |
      echo "📦 Version: ${{ needs.check-version.outputs.current_version }}" >> $GITHUB_STEP_SUMMARY
```

**Ожидаемый выигрыш:** -3-5 секунд

**Файл:** `.github/workflows/build-and-push.yml:830-831, 879`

---

## Итоговая оптимизация (рекомендуемая)

### До оптимизации:
```
security-scan (5-7 мин) → deploy-test (2.5-3.5 мин)
Total time to deployment: 7.5-10.5 минут
```

### После оптимизации (P0 only):
```
deploy-test (parallel с security-scan): 2-2.5 мин
Total time to deployment: 2-2.5 минуты (на test сервере)
```

**Экономия: -5 минут** (деплой не ждет security scan)

---

## Оптимизированный SSH Script (Final)

```yaml
deploy-test:
  needs: [check-version, image-build-push]  # убрана security-scan dependency

  steps:
    # checkout удален (не нужен)

    - name: Deploy via SSH
      uses: appleboy/ssh-action@v1.0.3
      with:
        host: ${{ secrets.TEST_SERVER_HOST }}
        username: ${{ secrets.TEST_SERVER_USER }}
        key: ${{ secrets.TEST_SERVER_SSH_KEY }}
        port: ${{ secrets.TEST_SERVER_SSH_PORT }}
        script: |
          echo "🚀 Starting deployment to budget-test..."

          cd ~/familyBudget

          # Git operations (faster with shallow fetch)
          echo "📥 Pulling latest code..."
          git fetch origin --depth=1 test
          git reset --hard origin/test

          # Deploy (cleanup в background)
          echo "🐳 Pulling Docker images and restarting containers..."
          sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode skip

          # Background cleanup (не блокирует)
          nohup sudo bash scripts/lib/cleanup.sh > /dev/null 2>&1 &

          # Smart health check (max 60s, poll every 5s)
          echo "⏳ Waiting for backend to become healthy..."
          for i in {1..12}; do
            if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
              echo "✅ Backend healthy after $((i * 5))s"
              break
            fi

            if [ $i -eq 12 ]; then
              echo "❌ Backend health check timeout (60s)"
              sudo docker logs familybudget-backend --tail 50
              exit 1
            fi

            sleep 5
          done

          # Nginx check
          curl -f http://localhost:80 || exit 1

          echo "✅ Deployment completed successfully!"

    - name: Deployment Success
      if: success()
      run: |
        echo "✅ Successfully deployed to test server" >> $GITHUB_STEP_SUMMARY
        echo "🌐 URL: https://fbd.ikeniborn.ru/" >> $GITHUB_STEP_SUMMARY
        echo "📦 Version: ${{ needs.check-version.outputs.current_version }}" >> $GITHUB_STEP_SUMMARY
```

---

## Измеримые метрики

| Метрика | До | После P0 | После P0+P1 | Улучшение |
|---------|----|---------|-----------|---------:|
| **Time to deploy** | 7.5-10.5 мин | 2-2.5 мин | 1.5-2 мин | **-80%** |
| Deploy dependency wait | 5-7 мин | 0 мин | 0 мин | -100% |
| Fixed sleep wait | 30s | 15s (avg) | 15s (avg) | -50% |
| Git operations | 5-10s | 5-10s | 2-5s | -50% |
| Deploy script | 90-150s | 90-150s | 70-130s | -15% |
| Health checks | 5-10s | 5-10s | 3-5s | -40% |

---

## Приоритизация внедрения

### Week 1 (P0 - Quick Wins)
1. ✅ Убрать security-scan из dependencies (-5 мин)
2. ✅ Smart health check вместо sleep 30 (-15s)

**Сложность:** Low
**Impact:** Critical path сокращен на 5 минут
**Риски:** Минимальные (test сервер)

### Week 2 (P1 - Полировка)
3. Cleanup в background (-10-20s)
4. Убрать docker-compose ps (-2s)
5. Shallow git fetch (-3-5s)

**Сложность:** Medium
**Impact:** Дополнительные 20-30 секунд

### Week 3+ (P2 - Долгосрочное)
6. Параллелизация git/image pull (требует модификацию deploy.sh)

---

## Связанные файлы

- `.github/workflows/build-and-push.yml:818-886` - deploy-test job
- `deploy.sh:1116,1405` - pull_from_registry, start_application_services
- `scripts/lib/registry.sh` - Docker image pull логика
- `scripts/lib/cleanup.sh` - Cleanup old images (если создать)

---

## Дополнительные соображения

### Production Deploy
**ВАЖНО:** Production деплой ДОЛЖЕН ждать security-scan:
```yaml
deploy-prod:
  needs: [check-version, image-build-push, security-scan]  # keep security-scan!
```

Причина: CVE vulnerabilities критичны для production, test сервер - приемлемый риск.

### Rollback Strategy
При ошибке health check:
```bash
# Show logs for debugging
sudo docker logs familybudget-backend --tail 100
sudo docker logs familybudget-nginx --tail 50

# Quick rollback (если нужно)
# git reset --hard <previous-commit>
# sudo bash deploy.sh
```

---

**Last Updated:** 2026-02-03
**Maintainer:** Family Budget Team
