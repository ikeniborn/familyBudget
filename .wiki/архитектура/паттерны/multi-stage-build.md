---
wiki_sources: ["docs/architecture/core/docker.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["Docker", "CI/CD"]
aliases: ["Multi-Stage Dockerfile", "Multi-Stage Builds"]
---

# Multi-Stage Build

Паттерн сборки Docker-образов в несколько последовательных стадий, при котором промежуточные стадии (builder stages) отбрасываются, а в финальный образ копируются только необходимые артефакты. Снижает итоговый размер образа и убирает build-инструменты из production-среды.

## Основные характеристики

### Backend Dockerfile (3 стадии)

```
Stage 1: python-builder (~300 MB, отбрасывается)
  → устанавливает Python-зависимости в /opt/venv

Stage 2: frontend-builder (~500 MB, отбрасывается)
  → npm ci + npm run build:prod → минифицированные JS/CSS

Stage 3: runtime (~400 MB, ИТОГОВЫЙ)
  → COPY /opt/venv из stage 1
  → COPY frontend/ из stage 2
  → gcr.io/distroless/python3-debian12 (v11.3+)
```

### Оптимизация кеша слоёв (v11.3)

COPY-инструкции упорядочены от редко меняющихся к часто меняющимся:

```dockerfile
# Зависимости (меняются редко — лучший cache)
COPY package*.json ./
RUN npm ci

# Конфигурация (меняется редко)
COPY build-all.js config/ sw.js manifest.json ./

# Исходный код (меняется часто)
COPY frontend/ scripts/ ./

# Версия (меняется при каждом релизе — ставится последней)
COPY VERSION ./
```

До оптимизации: bump VERSION → инвалидация npm ci (~4 мин rebuild).
После: bump VERSION → npm ci берётся из кеша (~2 мин rebuild, **40-50% быстрее**).

### Distroless Runtime (v11.3)

В v11.3 runtime images мигрированы с `python:3.11-slim` на `gcr.io/distroless/python3-debian12`:

| Свойство | До (slim) | После (distroless) |
|----------|-----------|-------------------|
| Backend | ~500 MB | ~400 MB |
| Bot | ~400 MB | ~320 MB |
| Shell доступ | Есть | ❌ Нет |
| Attack surface | Выше | Ниже (нет apt, shell) |

Для отладки без shell используется `docker cp` и `docker logs`.

## Применение в контексте Family Budget

Паттерн применён ко всем 5 кастомным образам. Особенность backend-образа — embedded frontend: Vite-сборка выполняется в stage 2 и копируется в итоговый образ, что исключает bind-монтирование кода на сервере.

## Связанные концепции

- [[registry-first]]
- [[семантическое-версионирование]]
