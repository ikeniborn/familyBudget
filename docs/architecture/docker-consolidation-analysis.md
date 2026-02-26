# Docker Consolidation Analysis: 5 Images → Single Container

**Дата**: 2026-02-26
**Версия**: 1.0
**Статус**: Research Report (без изменений в коде/конфигурации)
**Исследованная версия**: 11.5.35

---

## Краткий вывод (TL;DR)

**Полная консолидация в единый контейнер невозможна и нецелесообразна.**

Частичная консолидация технически возможна для 2 пар сервисов, но даёт минимальный выигрыш при значительных рисках. Текущая 5-контейнерная архитектура оптимальна для данного проекта.

---

## 1. Текущая архитектура: 5 Docker-образов

### 1.1 Реестр образов

| Образ | Версия | Размер | База | Описание |
|-------|--------|--------|------|----------|
| `familybudget-backend` | 11.5.35 | ~400 MB | `gcr.io/distroless/python3-debian12` | FastAPI + embedded frontend (HTMX + Tailwind) |
| `familybudget-bot` | 11.4.52 | ~320 MB | `gcr.io/distroless/python3-debian12` | Telegram bot (python-telegram-bot 21.10) |
| `familybudget-nginx` | 11.1.30 | ~50 MB | `nginx:alpine` | Reverse proxy + TLS termination |
| `familybudget-redis` | 9.0.3 | ~40 MB | `redis:7-alpine` | In-memory cache + Pub/Sub |
| `familybudget-postgresql` | 9.0.3 | ~250 MB | `postgres:16-alpine` | Primary database |
| **ИТОГО** | — | **~1.06 GB** | — | Per-version footprint |

### 1.2 Топология зависимостей

```
Internet
    │
    ▼
[nginx:443]
    │  TLS termination, HTTP/2, WebSocket upgrade
    ▼
[backend:8000]  ←─── [bot] (HTTP REST: /api/v1)
    │
    ├──► [postgres:5432]  asyncpg (asyncio driver)
    │
    └──► [redis:6379]     redis.asyncio (optional)
```

**Ключевые характеристики:**
- Nginx проксирует ВСЕ запросы на backend (нет статики в nginx)
- Bot общается с backend только через HTTP REST, без прямого доступа к БД
- Redis опционален: `is_redis_available()` проверяет наличие перед использованием
- PostgreSQL — листовая зависимость с персистентным external volume `budget_postgres_data`

### 1.3 Registry-First CI/CD

```
GitHub Push (test branch)
    │
    ▼
GitHub Actions (build-and-push.yml)
    │
    ├── Job: check changed images (IMAGE_VERSIONS.json)
    ├── Job: build-backend    (если backend/ или frontend/ изменились)
    ├── Job: build-bot        (если bot/ изменился)
    ├── Job: build-nginx      (если nginx/ изменился)
    ├── Job: build-redis      (если redis/ изменился)
    └── Job: build-postgresql (если postgres/ изменился)
    │
    ▼
ghcr.io/ikeniborn/familybudget-{service}:{semver}
    │
    ▼
deploy.sh → docker pull → docker compose up -d
```

**Преимущество**: Селективная пересборка — изменение в `bot/` не пересобирает backend (экономия 2-4 мин).

---

## 2. Анализ возможности консолидации по сервисам

### 2.1 PostgreSQL — НЕЛЬЗЯ консолидировать

**Обоснование:**

PostgreSQL является stateful сервисом с критической персистентностью данных:

```yaml
# docker-compose.yml
volumes:
  postgres_data:
    external: true
    name: budget_postgres_data  # Named external volume
```

- Данные хранятся в именованном Docker volume, который живёт независимо от контейнеров
- PostgreSQL требует dedicated процесса с PID управлением через `SIGINT` для graceful shutdown
- Встраивание PostgreSQL в контейнер приложения означает потерю изоляции данных: перезапуск приложения = потенциальная потеря данных при некорректном shutdown
- `stop_grace_period: 60s` и `stop_signal: SIGINT` в docker-compose.yml специально для корректного завершения PostgreSQL

**Вердикт: PostgreSQL ДОЛЖЕН оставаться отдельным контейнером.**

### 2.2 Redis — УСЛОВНО нельзя консолидировать

**Обоснование:**

Redis сконфигурирован с AOF persistence и runtime-параметрами:

```yaml
command: >
  redis-server
  --maxmemory ${REDIS_MAXMEMORY:-256mb}
  --maxmemory-policy allkeys-lru
  --appendonly yes
  --appendfsync everysec
  --requirepass "${REDIS_PASSWORD}"
```

Redis в проекте используется для трёх целей:
1. **Кэширование** (optional) — есть graceful degradation через `is_redis_available()`
2. **WebSocket Pub/Sub** (optional) — для broadcasting между uvicorn workers
3. **Write-Behind** (optional) — асинхронная запись в БД

Все три use-case имеют fallback на in-memory, НО:
- Pub/Sub через Redis нужен только при `WORKERS > 1`
- В текущей конфигурации `WORKERS=1` (default), что означает Redis Pub/Sub не критичен
- Без Redis WebSocket теряет cross-worker broadcasting (важно при горизонтальном масштабировании)

**Теоретически**: Если `WORKERS=1` фиксировать навсегда, Redis можно заменить in-memory реализацией прямо в коде. Но это фиксирует архитектурное ограничение.

**Вердикт: Redis лучше оставить отдельным — сохраняет возможность масштабирования.**

### 2.3 Nginx — МОЖНО исключить (с условиями)

**Обоснование:**

Nginx выполняет следующие функции:
- TLS termination (Let's Encrypt, `/etc/letsencrypt`)
- HTTP → HTTPS redirect
- WebSocket upgrade headers
- HTTP/2

Backend уже обслуживает весь контент (static, API, WebApp). Nginx лишь проксирует ВСЕ запросы:

```nginx
location / {
    proxy_pass http://backend;  # ВСЕ → backend
}
```

**Варианты замены nginx:**
1. Uvicorn с SSL (`--ssl-keyfile`, `--ssl-certfile`) — потеря HTTP/2, сложность cert rotation
2. Caddy на хосте (не в Docker) — TLS на уровне хоста, контейнеры работают без nginx
3. Traefik в Docker — замена nginx на более тяжелый сервис, не выигрыш

**Реальный выигрыш от устранения nginx**: экономия 50 MB образа + 1 контейнер. При этом теряется:
- HTTP/2
- Простой cert rotation (certbot + nginx)
- Buffer-based защита от slow clients

**Вердикт: Nginx можно устранить только если TLS обрабатывается на уровне выше (cloud LB, Caddy на хосте). В текущей VPS-архитектуре — нецелесообразно.**

### 2.4 Bot + Backend — ТЕХНИЧЕСКИ возможно, не рекомендуется

**Обоснование:**

Bot взаимодействует с Backend только через HTTP (httpx):

```python
# bot/config/settings.py:23
BACKEND_API_URL: str = os.getenv("BACKEND_API_URL", "http://localhost:8000/api/v1")
# В docker-compose.yml задаётся: BACKEND_API_URL: http://backend:8000/api/v1
```

Теоретически bot можно встроить в backend процесс как background task:

```python
# Концепция (НЕ реализация):
async def lifespan(app):
    asyncio.create_task(run_telegram_bot())  # bot как asyncio task
    yield
```

**Проблемы при слиянии:**
1. **Distroless несовместимость**: Оба используют `gcr.io/distroless/python3-debian12`. При слиянии нужен supervisord (недоступен в distroless) → переход на `python:3.11-slim` → +100 MB + увеличение attack surface
2. **Различные dependency sets**: bot требует `python-telegram-bot==21.10` с APScheduler; backend — FastAPI, asyncpg. Конфликты версий не исключены
3. **Независимые релизы**: bot (11.4.52) и backend (11.5.35) имеют разные хеши изменений, что обеспечивает независимую пересборку. При слиянии — любое изменение бота пересобирает весь образ
4. **Bot уже опциональный**: `profiles: [full]` в docker-compose.yml означает bot запускается только при явном `--profile full`

**Вердикт: Слияние bot + backend технически возможно через asyncio integration, но требует смены базового образа, увеличивает сложность и нарушает принцип single responsibility.**

---

## 3. Матрица рисков консолидации

| # | Риск | Серьёзность | Вероятность | Митигация |
|---|------|-------------|-------------|-----------|
| R1 | Потеря изоляции данных PostgreSQL | Критический | Высокая | Неустранимо — PostgreSQL не консолидируется |
| R2 | Потеря cross-worker WebSocket при удалении Redis | Высокий | Средняя | Фиксируем WORKERS=1 или оставляем Redis |
| R3 | Конфликты зависимостей bot + backend | Высокий | Средняя | Тщательный анализ requirements, виртуальные env |
| R4 | Потеря HTTP/2 и cert rotation при удалении nginx | Средний | Высокая | TLS на уровне хоста (Caddy) |
| R5 | CI/CD: потеря селективной пересборки | Средний | Высокая | Все сервисы в одном образе → rebuild на каждый коммит |
| R6 | Потеря независимых релизов сервисов | Средний | Высокая | Любое изменение в bot → перезапуск backend (downtime) |
| R7 | Потеря per-service resource limits | Низкий | Высокая | Единые limits на весь контейнер — нет защиты от утечек |
| R8 | Distroless несовместимость с supervisord | Средний | Высокая | Переход на slim образ → +100MB + attack surface |

---

## 4. Сценарии частичной консолидации

### Сценарий A: "Минимальный" (текущее состояние, рекомендуется)
**5 контейнеров**: postgres + redis + backend + bot + nginx

- Никаких изменений
- Оптимальная изоляция и независимость релизов
- CI/CD время: 2-3 мин (с кэшем), 5-8 мин (cold build)

### Сценарий B: "Bot-in-Backend" (4 контейнера)
**4 контейнера**: postgres + redis + backend-with-bot + nginx

- Bot handlers как asyncio background tasks внутри FastAPI lifespan
- Требует: смена базового образа с distroless на python:3.11-slim
- Сложность реализации: высокая (2-3 недели разработки и тестирования)
- Выигрыш: -1 контейнер, -320 MB образ бота (но backend образ растёт)
- Риск: любой баг в bot падает backend; нет независимых релизов

**Вывод по сценарию B**: Экономия не оправдывает риски при аудитории 2-5 пользователей.

### Сценарий C: "No-Nginx" (4 контейнера)
**4 контейнера**: postgres + redis + backend + bot (nginx на хосте через Caddy)

- Caddy установлен на хосте VPS как systemd service
- Backend слушает напрямую 443 (или Caddy проксирует на 8000)
- TLS автоматически через Caddy (Let's Encrypt)
- Выигрыш: -1 контейнер (nginx), -50 MB
- Потеря: разрыв с текущей cert-management инфраструктурой (`scripts/ssl_certificate_manager.sh`)

**Вывод по сценарию C**: Интересный вариант при переходе на Caddy, но требует полного переосмысления SSL management.

### Сценарий D: "Absolute Minimum" (3 контейнера)
**3 контейнера**: postgres + redis + monolith (backend+bot+nginx в одном)

- Требует: supervisord (не работает с distroless), nginx внутри Python-контейнера
- Это анти-паттерн Docker: несколько процессов в одном контейнере
- Полная потеря независимых релизов, селективной пересборки, resource limits
- Размер образа: ~800 MB (vs. 400+320+50 = 770 MB распределённо)

**Вывод по сценарию D**: Нет никакого выигрыша в размере, огромные потери в управляемости. Не рекомендуется.**

---

## 5. Анализ ресурсного потребления

### 5.1 Текущий footprint (5 контейнеров)

| Ресурс | postgres | redis | backend | bot | nginx | ИТОГО |
|--------|----------|-------|---------|-----|-------|-------|
| CPU limit | нет | 0.1 | 0.8 | 0.15 | 0.05 | 1.1 cores |
| CPU reserve | нет | 0.02 | 0.3 | 0.05 | 0.01 | 0.38 cores |
| Memory limit | нет | 512 MB | 2 GB | 512 MB | 256 MB | 3.28 GB |
| Memory reserve | нет | 128 MB | 512 MB | 256 MB | 64 MB | 960 MB |

**Минимальный VPS**: 4 GB RAM (соответствует требованиям PRD: "4+ GB")

### 5.2 Потенциальный footprint (3 контейнера, Сценарий D)

При слиянии backend+bot+nginx в один контейнер:
- Нет изоляции ресурсов между компонентами
- Единый OOM killer срабатывает для всего приложения
- Мониторинг сложнее (нет разделения метрик)

---

## 6. Влияние на CI/CD

### 6.1 Текущий CI/CD (5 образов)

```
IMAGE_VERSIONS.json:
{
  "backend": { "hash": "c68d905a", "paths": ["backend/", "frontend/"] },
  "bot":     { "hash": "46395376", "paths": ["bot/"] },
  "nginx":   { "hash": "413175d8", "paths": ["nginx/"] },
  "redis":   { "hash": "4eb5ebb0", "paths": ["redis/"] },
  "postgresql": { "hash": "4eb5ebb0", "paths": ["postgres/"] }
}
```

Изменение в `bot/handlers/` → пересобирается ТОЛЬКО `familybudget-bot` (~2 мин)

### 6.2 Монолитный образ (1 образ)

Любое изменение в любом файле → полная пересборка:
- Python dependencies rebuild: ~3 мин
- Frontend Vite build: ~2 мин
- Node.js npm ci: ~2 мин (при cache miss)
- Итого: 5-8 мин на каждый коммит

**Потеря производительности CI/CD**: в 3-4 раза медленнее.

---

## 7. Рекомендации

### 7.1 Краткосрочные рекомендации (без изменений архитектуры)

Текущая архитектура оптимальна. Рекомендуется:

1. **Документировать текущую архитектуру** — добавить README к каждому Dockerfile объясняющий причины изоляции
2. **Мониторинг resource utilization** — проверить реальное потребление vs limits (возможно можно снизить лимиты)
3. **Рассмотреть Redis как обязательный** — текущая конфигурация `WORKERS=1` означает Redis Pub/Sub не используется полноценно; либо поднять `WORKERS=2` для использования Redis, либо зафиксировать его опциональность

### 7.2 Среднесрочные рекомендации (при наличии ресурсов)

Если цель — снизить количество контейнеров, **единственный разумный вариант**:

**Опция: "No-Nginx" (Сценарий C)** — переход на Caddy

```
Трудозатраты: ~1 неделя
Риски: средние (изменение SSL management)
Выигрыш: -1 контейнер, автоматический TLS через Caddy
Потери: текущая инфраструктура ssl_certificate_manager.sh
```

### 7.3 Чего НЕ делать

- **НЕ объединять postgres** с другими сервисами — потеря data isolation
- **НЕ объединять redis** если планируется `WORKERS > 1`
- **НЕ использовать supervisord** в Docker контейнерах — это анти-паттерн
- **НЕ переходить с distroless** ради консолидации — потеря security hardening

---

## 8. Сравнительная таблица сценариев

| Критерий | Текущее (5) | Bot-in-Backend (4) | No-Nginx (4) | Монолит (3) |
|----------|-------------|---------------------|--------------|-------------|
| Сложность управления | Низкая | Средняя | Средняя | Высокая |
| Независимые релизы | Полные | Частичные | Полные | Нет |
| Изоляция данных | Полная | Полная | Полная | Частичная |
| CI/CD время | 2-3 мин | 3-4 мин | 2-3 мин | 5-8 мин |
| Security hardening | Максимальная | Снижена | Максимальная | Низкая |
| Трудозатраты | — | 2-3 недели | 1 неделя | 4+ недели |
| Итоговый риск | Низкий | Средний | Средний | Высокий |
| **Рекомендация** | **ПОДДЕРЖИВАТЬ** | Не рекомендуется | Рассмотреть | Не рекомендуется |

---

## 9. Заключение

**Переход с 5 Docker-образов на единый контейнер**:

- Технически неосуществим без нарушения критических требований (PostgreSQL data isolation, distroless runtime)
- Экономически нецелесообразен: нет измеримого выигрыша при аудитории 2-5 пользователей на VPS 4 GB
- Архитектурно контрпродуктивен: нарушает Docker best practices, ухудшает CI/CD

**Текущая 5-контейнерная архитектура** является оптимальной для данного проекта по совокупности факторов:
- Registry-First деплой без сборки на сервере
- Distroless образы с минимальной attack surface
- Независимые версии и релизы каждого сервиса
- Селективная пересборка экономит CI/CD время
- Чёткое разделение ответственности

---

## Приложение A: Файлы, исследованные в ходе анализа

| Файл | Роль в анализе |
|------|---------------|
| `docker-compose.yml` | Главный конфигурационный файл всех 5 сервисов |
| `backend/Dockerfile` | Multi-stage 3-stage build с distroless runtime |
| `bot/Dockerfile` | Multi-stage 2-stage build с distroless runtime |
| `nginx/Dockerfile` | Nginx Alpine с config templates |
| `postgres/Dockerfile` | Minimal postgres:16-alpine extension |
| `redis/Dockerfile` | Minimal redis:7-alpine extension |
| `backend/app/main.py` | FastAPI lifespan: startup dependencies order |
| `backend/app/services/redis_service.py` | Redis optional pattern (is_redis_available) |
| `backend/app/services/redis_ws_manager.py` | WebSocket Pub/Sub via Redis |
| `backend/app/scheduler.py` | APScheduler with PG advisory locks |
| `IMAGE_VERSIONS.json` | Selective CI rebuild tracking |
| `.github/workflows/build-and-push.yml` | CI/CD 5-job parallel build pipeline |
| `docs/architecture/core/docker.md` | Official Docker architecture documentation |
| `docs/prd/03-system-architecture.md` | Architecture rationale |

---

*Отчёт подготовлен: 2026-02-26. Исследование — только чтение, никаких изменений в коде или конфигурации не производилось.*
