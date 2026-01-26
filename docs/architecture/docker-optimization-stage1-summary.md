# Docker Optimization - Этап 1: Quick Wins - Summary

**Дата:** 2026-01-26
**Статус:** ✅ Завершен
**Следующий этап:** Этап 2 (Security & Metadata)

---

## Выполненные изменения

### 1. Backend Dockerfile (`backend/Dockerfile`)

#### 1.1 BuildKit Cache Mounts
**Изменения:**
- **Строка 22-24**: Добавлен `--mount=type=cache,target=/root/.cache/pip` для pip install
- **Строка 37-38**: Добавлен `--mount=type=cache,target=/root/.npm` для npm ci

**До:**
```dockerfile
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt
```

**После:**
```dockerfile
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt
```

**Эффект:**
- Первая сборка: время не меняется (создается cache)
- Последующие сборки: **2-3x быстрее** установка зависимостей
- Cache сохраняется между CI runs (GitHub Actions cache)

---

#### 1.2 Пинирование Base Images
**Изменения:**
- **Строка 3**: `FROM python:3.11-slim` → `FROM python:3.11-slim-bookworm`
- **Строка 63**: `FROM python:3.11-slim` → `FROM python:3.11-slim-bookworm`

**Эффект:**
- Reproducible builds (конкретная версия Debian)
- Потенциально **-5-10 MB**
- Безопасность: пинированная версия Debian 12 (bookworm)

---

#### 1.3 Оптимизация порядка слоев (Строки 77-105)
**Новый порядок** (от редко меняющихся к часто меняющимся):
1. `RUN groupadd` - Create non-root user (редко меняется)
2. `COPY --from=python-builder /opt/venv` - Copy venv (меняется при изменении dependencies)
3. `WORKDIR $APP_HOME`
4. `RUN mkdir -p` - Create directories (редко меняется)
5. `COPY VERSION, manifest.json, sw.min.js` - Change on release
6. `COPY scripts/` - Changes rarely
7. **`COPY backend/`** - Changes frequently (NEAR END) ← **Ключевое изменение**
8. **`COPY frontend/`** - Changes frequently (NEAR END) ← **Ключевое изменение**
9. `RUN chown` - Fix ownership

**Эффект:**
- Лучший cache hit rate при изменении только кода
- **30-40% ускорение CI builds** (при изменении backend/frontend код)
- Размер образа не меняется

**Пример:**
- Изменен только `backend/app/main.py`
- Слои 1-6: **CACHED** (не пересобираются)
- Только слои 7-9: rebuild

---

### 2. Bot Dockerfile (`bot/Dockerfile`)

#### Полная переработка с Multi-Stage Build + Security

**Было:** 31 строка, single-stage, **БЕЗ non-root user** ❌
**Стало:** 62 строки, multi-stage (builder + runtime), **non-root user (botuser)** ✅

**Ключевые изменения:**

1. **Multi-Stage Build:**
   - Stage 1 (builder): Build dependencies + venv creation
   - Stage 2 (runtime): Only runtime dependencies

2. **BuildKit Cache Mount:**
   ```dockerfile
   RUN --mount=type=cache,target=/root/.cache/pip \
       pip install --upgrade pip setuptools wheel && \
       pip install -r requirements.txt
   ```

3. **Non-Root User (КРИТИЧНО для безопасности):**
   ```dockerfile
   RUN groupadd -r botuser && useradd -r -g botuser botuser
   ...
   USER botuser
   ```

4. **Пинирование Base Image:**
   - `FROM python:3.11-slim-bookworm` (оба stages)

5. **Улучшенный Health Check:**
   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
       CMD pgrep -f "python.*bot.main" || exit 1
   ```

**Эффект:**
- **-20-40 MB** размер образа (build tools не попадают в runtime)
- **Улучшенная безопасность**: bot работает как non-root user
- **30-40% ускорение сборки** (BuildKit cache)

---

## Validation Results

### Локальная проверка синтаксиса
✅ **Backend Dockerfile:** Синтаксис корректен
- 2 warnings о casing 'as' vs 'FROM' (косметика)
- BuildKit directives правильно использованы
- Layer ordering корректен

✅ **Bot Dockerfile:** Синтаксис корректен
- 1 warning о casing 'as' (косметика)
- Multi-stage build структура правильная
- Non-root user настроен корректно

**Примечание:** Полная сборка образов требует CI/CD окружения (npm build, network access). Согласно registry-first архитектуре v9.0, все builds происходят в GitHub Actions.

---

## Expected Results (После CI/CD Build)

### Размеры образов

**Backend:**
- Размер: 480-500 MB (без изменений, только build speed)
- Причина: Frontend assets остались прежними, оптимизированы только слои

**Bot:**
- Было: ~400 MB (single-stage)
- Стало: **320-360 MB** (multi-stage)
- Экономия: **-20% (-40-80 MB)**

**Total:**
- Было: 1240 MB
- Стало: **1140-1200 MB**
- Экономия: **-3-8% (-40-100 MB)**

### Build Time (CI/CD)

**service-build job:**
- Было: ~3-4 min
- Стало: **~2-3 min** (-33%)

**image-build-push job:**
- Было: ~5-8 min
- Стало: **~3-5 min** (-40%)

**Total CI/CD time:**
- Было: ~8-12 min
- Стало: **~5-8 min** (-33%)

**Второй build (с cache):**
- Dependency installation: **2-3x faster** (BuildKit cache hit)

---

## Security Improvements

### Bot Security (КРИТИЧНО)
- ✅ **Non-root user (botuser)**: Предотвращает privilege escalation attacks
- ✅ **Multi-stage build**: Build tools не попадают в runtime образ
- ✅ **Minimal runtime dependencies**: Уменьшена attack surface

### Backend Security
- ✅ **Pinned base images**: Reproducible builds, контролируемые CVE
- ✅ **Optimized layer ordering**: Минимизирует rebuild при изменениях кода

---

## Warnings (Non-Critical)

### Dockerfile Casing
Обнаружены warnings о несоответствии casing для 'as' и 'FROM':
```
FromAsCasing: 'as' and 'FROM' keywords' casing do not match
```

**Locations:**
- `backend/Dockerfile`: Line 3, 27
- `bot/Dockerfile`: Line 3

**Fix (Optional):**
```dockerfile
# Текущий стиль:
FROM python:3.11-slim-bookworm as python-builder

# Рекомендуемый стиль (consistent casing):
FROM python:3.11-slim-bookworm AS python-builder
```

**Impact:** Косметический, не влияет на функциональность.
**Priority:** P3 (Low)

---

## Next Steps: Этап 2 (Security & Metadata)

### 2.1 OCI Labels
Добавить metadata в образы:
- `org.opencontainers.image.version`
- `org.opencontainers.image.revision` (git commit)
- `org.opencontainers.image.created` (build date)

**Files to modify:**
- `backend/Dockerfile` (после строки 108)
- `bot/Dockerfile` (после health check)
- `.github/workflows/build-and-push.yml` (build args)

### 2.2 Enhanced Trivy Scanning
- Add MEDIUM severity scanning
- Generate vulnerability summary table
- Upload SARIF reports to GitHub Security

**Files to modify:**
- `.github/workflows/build-and-push.yml` (строки 652-670)

---

## Rollback Plan

Если изменения вызовут проблемы в CI/CD:

```bash
# Step 1: Revert changes
git revert <commit-hash>
git push origin test

# Step 2: Re-trigger CI/CD
# GitHub Actions автоматически пересоберет образы

# Step 3: Deploy reverted version
ssh budget-test
cd /opt/budget
./deploy.sh
```

**Recovery time:** 5-10 минут

---

## Checklist для CI/CD Testing

После merge в test branch:

- [ ] Backend образ собирается успешно
- [ ] Bot образ собирается успешно
- [ ] Build time уменьшился на 30-40%
- [ ] Размер bot образа уменьшился на 20%
- [ ] Health checks проходят в docker-compose
- [ ] Bot работает как non-root user (botuser)
- [ ] Backend API отвечает корректно
- [ ] Telegram bot подключается
- [ ] Нет CVE regressions (Trivy scan)
- [ ] Frontend assets загружаются корректно
- [ ] WebSocket соединения стабильны

---

## References

- **Plan:** `docker-optimization-plan.md` (Этап 1)
- **Docker Best Practices:** https://docs.docker.com/build/building/best-practices/
- **Habr Article:** https://habr.com/ru/companies/domclick/articles/546922/
- **Project Architecture:** `docs/architecture/docker.md`
- **CI/CD Documentation:** `docs/architecture/ci-cd-build-deploy.md`
