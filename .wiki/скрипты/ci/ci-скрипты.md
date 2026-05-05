---
wiki_sources:
  - "scripts/ci/cache_busting_ci.sh"
  - "scripts/ci/check_image_changes.sh"
  - "scripts/ci/update_image_version.sh"
  - "scripts/ci/validate_build_artifacts.sh"
wiki_updated: 2026-05-06
wiki_status: developing
tags:
  - bash
  - ci-cd
  - docker
  - cache-busting
aliases:
  - "scripts/ci"
  - "CI скрипты"
  - "IMAGE_VERSIONS"
---

# CI-скрипты

Bash-скрипты для GitHub Actions CI/CD pipeline: управление версиями образов, cache busting и валидация артефактов сборки.

## Основные характеристики

### check_image_changes.sh — определение необходимости пересборки

Анализирует `IMAGE_VERSIONS.json` для определения, нужно ли пересобирать конкретный Docker-образ:

```bash
bash scripts/ci/check_image_changes.sh <image_name>
# Выводит "rebuild" или "skip"
```

Использует `jq` для чтения paths из `IMAGE_VERSIONS.json` и `git log` для определения наличия изменений в этих путях.

### update_image_version.sh — обновление версии образа

Обновляет version и git hash для одного образа в `IMAGE_VERSIONS.json` после успешной сборки:

```bash
bash scripts/ci/update_image_version.sh <image_name> <new_version>
```

**Логика:**
1. Читает paths для образа из `IMAGE_VERSIONS.json`
2. Вычисляет текущий git hash последнего коммита для этих paths
3. Записывает новую версию + hash в JSON

### cache_busting_ci.sh — обновление версий в шаблонах

CI-совместимый cache busting: заменяет `?v=PLACEHOLDER` на `?v=<version>` во всех template-файлах:

```bash
bash scripts/ci/cache_busting_ci.sh <version>
# version: X.Y.Z (semantic) или v{timestamp} (legacy)
```

**Валидация формата версии:**
- Semantic versioning: `^[0-9]+\.[0-9]+\.[0-9]+$` (напр., `10.0.23`)
- Legacy формат: `^v[0-9a-f_]+$` (напр., `v20260201_123456`)

### validate_build_artifacts.sh — валидация артефактов

Консолидированная валидация после сборки (заменяет разрозненные проверки из `build-and-push.yml`):

```bash
bash scripts/ci/validate_build_artifacts.sh <CACHE_VERSION> [--strict-sw]
# --strict-sw: провалить если Service Worker не прошёл валидацию
```

**Проверки:**
1. Нет незамененных `?v=PLACEHOLDER` в шаблонах
2. Минифицированные файлы существуют и не пусты
3. Service Worker регистрирует правильную версию кеша (необязательно строго)

**Коды завершения:** `0` — всё ОК, `1` — провал.

## Связанные концепции

- [[ci-cd-pipeline]]
- [[cache-busting]]
- [[семантическое-версионирование]]
