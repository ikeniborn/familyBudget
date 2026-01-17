# Changelog

Все заметные изменения в проекте Family Budget будут документированы в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
и этот проект придерживается [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed - BREAKING

- **CLI версионирования изменен** (v7.0)
  - `--patch/--minor/--major` → `--version TYPE` (старые флаги deprecated с warning)
  - `--version X.Y.Z` → `--set-version X.Y.Z` (старая опция deprecated с warning)
  - **Default behavior:** версия НЕ меняется если `--version` не указан
    - До v7.0: `./deploy.sh` → auto minor bump (6.6.0 → 6.7.0)
    - С v7.0: `./deploy.sh` → no change (6.6.0 → 6.6.0)
  - VERSION файл теперь single source of truth для всех версий

### Added

- **Новая опция `--version TYPE`** где TYPE = patch|minor|major
  ```bash
  ./deploy.sh --version patch  # 6.6.0 → 6.6.1
  ./deploy.sh --version minor  # 6.6.0 → 6.7.0
  ./deploy.sh --version major  # 6.6.0 → 7.0.0
  ```
- **Новая опция `--set-version X.Y.Z`** для явного указания версии
  ```bash
  ./deploy.sh --set-version 7.0.0
  ```
- **Автоматическая синхронизация VERSION → package.json** при mismatch
  - Исправляет существующий mismatch (VERSION 6.6.0 ≠ package.json 5.3.0)
  - Выполняется автоматически при первом деплое v7.0+
- **Синхронизация .npm-isolated/package.json** после version bump
  - Все 4 файла теперь синхронизируются: VERSION, package.json, .env, .npm-isolated/package.json
- **Validation и error handling** для version updates:
  - Backup/restore механизм для безопасного обновления
  - Verification после каждого обновления
  - Fail-fast при ошибках обновления
- **deploy-test.sh и deploy-prod.sh** поддерживают `--version TYPE`
  ```bash
  ./deploy-test.sh --version patch
  ./deploy-prod.sh --version minor
  ```
- **Новая документация:** `docs/architecture/versioning.md`
  - Полное описание системы версионирования
  - Примеры использования CLI
  - Troubleshooting guide

### Fixed

- **VERSION (6.6.0) и package.json (5.3.0) mismatch** исправляется автоматически
- **.npm-isolated/package.json** теперь синхронизируется после version bump
  - Исправлена проблема когда .npm-isolated имел старую версию после деплоя
- **Ошибки update_package_json()** теперь обрабатываются корректно
  - Backup/restore при ошибках sed
  - Verification предотвращает silent failures
- **deploy-test.sh и deploy-prod.sh** больше не имеют hardcoded `--patch`
  - Явное управление версионированием через `--version TYPE`

### Deprecated

- `--patch`, `--minor`, `--major` (используйте `--version TYPE`)
  - Работают с deprecation warning для обратной совместимости
- `--version X.Y.Z` (используйте `--set-version X.Y.Z`)
  - Работает с deprecation warning для обратной совместимости

### Migration Guide

**Если вы используете deploy.sh напрямую:**
```bash
# Старый способ (v6.x):
./deploy.sh --patch

# Новый способ (v7.0+):
./deploy.sh --version patch
```

**Если вы используете deploy-test.sh или deploy-prod.sh:**
```bash
# Старое поведение (v6.x):
./deploy-test.sh  # всегда --patch

# Новое поведение (v7.0+):
./deploy-test.sh  # БЕЗ изменения версии (explicit required)
./deploy-test.sh --version patch  # для patch bump
```

**CI/CD pipelines:**
- Обновите скрипты для использования `--version TYPE`
- Explicit версионирование теперь обязательно

### Notes

- Первый деплой с v7.0+ автоматически исправит mismatch VERSION ≠ package.json
- Все deprecated опции работают до удаления в v8.0
- VERSION файл - теперь единственный source of truth (package.json следует за ним)

## [6.6.0] - 2026-01-XX

*Previous changelog entries...*

---

**Full Changelog:** https://github.com/your-org/familyBudget/compare/v6.6.0...HEAD
