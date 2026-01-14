# Версионирование приложения Family Budget

## Обзор

Family Budget использует две независимые системы версионирования:
1. **Semantic Versioning (SemVer)** - для версии приложения (VERSION файл)
2. **Timestamp-based Cache Versioning** - для версии frontend кеша (CACHE_VERSION)

## Semantic Versioning

### Формат: X.Y.Z (например: 6.6.0)

- **X (major)** - Breaking changes, несовместимые изменения API
- **Y (minor)** - Новые функции, обратно совместимые
- **Z (patch)** - Bug fixes, обратно совместимые

### Single Source of Truth

**VERSION файл** - единственный источник истины для версии приложения.

При каждом деплое автоматически синхронизируются:
- `package.json` → версия обновляется из VERSION файла
- `.env` → переменная VERSION обновляется
- `.npm-isolated/package.json` → версия синхронизируется

## CLI интерфейс

### Новый синтаксис (v7.0+)

```bash
# Без изменения версии (default)
./deploy.sh

# Bump версии
./deploy.sh --version patch   # 6.6.0 → 6.6.1
./deploy.sh --version minor   # 6.6.0 → 6.7.0
./deploy.sh --version major   # 6.6.0 → 7.0.0

# Явное указание версии
./deploy.sh --set-version 7.1.0
```

### Устаревший синтаксис (deprecated)

```bash
# DEPRECATED: работает с warning
./deploy.sh --patch
./deploy.sh --minor
./deploy.sh --major
./deploy.sh --version 7.1.0  # используйте --set-version
```

### Deploy-test / Deploy-prod Skills

```bash
# Без изменения версии (default)
./deploy-test.sh

# С изменением версии
./deploy-test.sh --version patch
./deploy-prod.sh --version minor
./deploy-prod.sh --version major
```

## Cache Versioning

### Формат: v{YYYYMMDD_HHMM} (например: v20260114_1450)

Генерируется автоматически при каждом деплое:
```bash
CACHE_VERSION="v$(date -u +"%Y%m%d_%H%M")"
```

Используется для:
- Service Worker cache invalidation
- Static assets cache busting (?v=20260114_1450)

## Автоматическая синхронизация

### При деплое происходит:

1. **Sync code** → копирование кода в /opt/budget
2. **VERSION → package.json sync** → если VERSION (6.6.0) ≠ package.json (5.3.0)
3. **package.json → .npm-isolated sync** → если package.json изменился
4. **Version bump** (если указан --version TYPE)
   - Обновляется VERSION файл
   - Обновляется package.json
   - Синхронизируется .npm-isolated/package.json
   - Обновляется .env

### Проверка синхронизации

```bash
# Проверить текущие версии
cat VERSION
grep version package.json
grep VERSION .env
grep version .npm-isolated/package.json
```

Все 4 файла должны иметь одинаковую версию.

## Troubleshooting

### VERSION ≠ package.json после деплоя

**Причина:** Старая версия Family Budget (<v7.0) без автосинхронизации.

**Решение:** Запустить деплой еще раз - автоматическая синхронизация исправит mismatch.

```bash
./deploy.sh  # без опций - только sync
```

### .npm-isolated/package.json не обновляется

**Причина:** deploy.sh v6.x не синхронизирует .npm-isolated после version bump.

**Решение:** Обновить deploy.sh до v7.0+.

### Версия в UI не обновляется

**Причина:** Используется CACHE_VERSION (timestamp), а не VERSION (semantic).

**Норма:** CACHE_VERSION обновляется при каждом деплое независимо от semantic version.

## Validation and Error Handling

### Backup/Restore Mechanism

При обновлении версий:
1. Создается backup файла перед модификацией
2. Выполняется обновление (sed/echo)
3. Проверяется успешность обновления (grep + compare)
4. При ошибке восстанавливается backup автоматически

### Error Detection

- Все ошибки обновления файлов логируются с warnings
- Deployment останавливается если критические файлы (VERSION, package.json) не обновились
- Verification после каждого обновления предотвращает silent failures

## См. также

- [Build System](build-system.md) - Build pipeline и cache версионирование
- [PWA](pwa.md) - Service Worker и cache management
- [Deployment Guide](guides/deployment-troubleshooting.md) - Troubleshooting
