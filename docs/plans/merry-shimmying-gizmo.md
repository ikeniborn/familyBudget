# Plan: Исправление статуса контейнеров в Pipeline Summary

## Context

В итоговом Pipeline Summary секция **Containers** использует иконку `⏭` (пропущено) для
всех контейнеров, когда pipeline выполняется в режиме "skipped" (VERSION не менялась
в коммите). При этом контейнеры в ghcr.io registry могут быть **полностью актуальны** —
их версия совпадает с текущей VERSION (пересобраны в предыдущем прогоне).

**Пример:**

```
⏭ Pipeline Skipped (no VERSION change)
v11.5.3 · test
...
Containers:
⏭ backend:11.5.3    ← Показывает "пропущено", хотя 11.5.3 == текущей VERSION
⏭ bot:11.4.52
```

Это создаёт ложное впечатление о состоянии деплоя.

## Корневая причина

**Файл:** `.github/workflows/build-and-push.yml`

Функции `c_line()` (строки 812–818) и `c_md()` (строки 879–885) имеют только два
состояния:
- `built == "true"` → `✅ name:ver (new)` — пересобран в этом прогоне
- иначе → `⏭ name:ver` — всё остальное, включая "актуален в registry"

Когда Job `image-build-push` skipped, его outputs `backend_built`, `bot_built` и т.д.
возвращают пустую строку. `built` ≠ `"true"`, и всегда показывается `⏭`.

**Версии** (`VER_*`) уже берутся из ghcr.io registry API правильно — проблема только
в интерпретации "что значит не rebuilt".

## Решение

Добавить **третье состояние** в функции `c_line()` и `c_md()`: сравнивать версию
контейнера из registry с текущей `VERSION` из файла.

| Условие | Telegram | GitHub Markdown |
|---------|----------|-----------------|
| `built == "true"` | `✅ name:ver (new)` | `✅ updated` |
| `built != "true"` && `ver == VERSION` | `✅ name:ver` | `✅ current` |
| `built != "true"` && `ver != VERSION` | `⏭ name:ver` | `⏭ unchanged` |

`VERSION` уже доступна как локальная переменная `VERSION=$(cat VERSION)` в обоих step'ах.

## Изменения

### Файл: `.github/workflows/build-and-push.yml`

#### 1. Функция `c_line()` — строки 812–818 (Telegram message)

```bash
# ДО:
c_line() {
  local name="$1" built="$2" ver="$3"
  if [[ "$built" == "true" ]]; then
    echo "✅ ${name}:${ver} (new)"
  else
    echo "⏭ ${name}:${ver}"
  fi
}

# ПОСЛЕ:
c_line() {
  local name="$1" built="$2" ver="$3"
  if [[ "$built" == "true" ]]; then
    echo "✅ ${name}:${ver} (new)"
  elif [[ "$ver" == "$VERSION" ]]; then
    echo "✅ ${name}:${ver}"
  else
    echo "⏭ ${name}:${ver}"
  fi
}
```

#### 2. Функция `c_md()` — строки 879–885 (GitHub Markdown summary)

```bash
# ДО:
c_md() {
  local name="$1" built="$2" ver="$3"
  if [[ "$built" == "true" ]]; then
    echo "| ${name} | \`${ver}\` | ✅ updated |"
  else
    echo "| ${name} | \`${ver}\` | ⏭ unchanged |"
  fi
}

# ПОСЛЕ:
c_md() {
  local name="$1" built="$2" ver="$3"
  if [[ "$built" == "true" ]]; then
    echo "| ${name} | \`${ver}\` | ✅ updated |"
  elif [[ "$ver" == "$VERSION" ]]; then
    echo "| ${name} | \`${ver}\` | ✅ current |"
  else
    echo "| ${name} | \`${ver}\` | ⏭ unchanged |"
  fi
}
```

## Ожидаемый результат

**При Pipeline Skipped (VERSION не менялась):**
```
⏭ Pipeline Skipped (no VERSION change)
v11.5.3 · test

Containers:
✅ backend:11.5.3    ← актуален в registry
✅ bot:11.4.52
✅ nginx:11.1.30
✅ redis:9.0.3
✅ postgresql:9.0.3
```

**При Pipeline Skipped, но какой-то контейнер устарел:**
```
Containers:
✅ backend:11.5.3
⏭ bot:11.4.51        ← версия в registry < VERSION → нужна пересборка
```

**При полном pipeline run:**
```
Containers:
✅ backend:11.5.4 (new)   ← пересобран в этом прогоне
✅ bot:11.4.52 (new)
✅ nginx:11.1.30           ← не изменился, но актуален
```

## Верификация

1. Пушить commit без изменения VERSION в ветку `test`
2. Дождаться завершения workflow (job summary)
3. Проверить Telegram-сообщение и GitHub Actions summary:
   - Контейнеры с актуальной версией должны показывать `✅`
   - Общий статус по-прежнему `⏭ Pipeline Skipped (no VERSION change)`

## Риски

- **Минимальные** — изменение затрагивает только форматирование строк в summary
- Нет влияния на build/deploy логику
- Нет влияния на условия запуска jobs
