---
name: doc-sync
description: Автоматическая синхронизация кода и документации с обнаружением устаревших файлов и генерацией updates
version: 1.0.0
author: Family Budget Team
tags: [documentation, sync, validation, automation, yaml, ast-parsing]
dependencies: [git-workflow, context-awareness, thinking-framework]
architecture_refs:
  - $ref: ../../docs/architecture/README.md
  - $ref: ../../docs/architecture/guides/change-checklist.yaml
  - $ref: ../_shared/architecture-refs.yaml
user-invocable: true
context: fork
---

# Doc-Sync - Documentation Synchronization Skill

Автоматизирует синхронизацию кода и документации в проекте Family Budget с обнаружением устаревших файлов, валидацией соответствия code ↔ docs и генерацией обновлений.

---

## When to Use

**PHASE 5C (Documentation + Summary)** - после git commit, перед завершением задачи.

**Используйте doc-sync когда:**
- ✅ Завершили feature/fix с изменениями в коде
- ✅ Изменили API endpoints, database schema, frontend components
- ✅ Хотите проверить соответствие code ↔ docs

**НЕ используйте когда:**
- ❌ Trivial changes (typo fix, comment update)
- ❌ Только изменения в документации (без code changes)
- ❌ Work in progress (код не готов к документированию)

**Workflow integration:**
```
PHASE 5A: Git commit → PHASE 5C: @skill:doc-sync → User approval → Commit docs → PR
```

---

## Quick Reference

### Core Pipeline

1. **Git Diff Analysis** → Определение изменённых компонентов
2. **Code-to-Docs Mapping** → Поиск связанной документации через architecture_refs
3. **Signature Extraction** → AST parsing (FastAPI, SQLAlchemy, TypeScript)
4. **Staleness Detection** → Missing/mismatch/outdated/deprecated
5. **YAML Auto-Update** → Генерация snippets из templates
6. **User Approval** → Preview + approve/reject
7. **Changelog Generation** → Обновление docs/architecture/README.md

**Details:** См. `@doc:core-functionality`

---

### Commands

| Command | Mode | Purpose |
|---------|------|---------|
| `@skill:doc-sync` | Full sync | Полная синхронизация с updates |
| `@skill:doc-sync --check` | Dry-run | Preview без изменений |
| `@skill:doc-sync --validate` | Full scan | Проверка всего codebase |

**Details:** См. `@doc:commands`

---

### Component Patterns

**Supported components:**
- API endpoints (`backend/app/api/v1/endpoints/*.py`)
- Database models (`backend/app/models/*.py`)
- Frontend modules (`frontend/web/static/js/**/*.ts`)
- Jinja2 templates (`frontend/web/templates/**/*.html`)

**Extraction methods:**
- FastAPI: LSP (primary, 98% accuracy) + AST fallback
- SQLAlchemy: LSP (primary, 98% accuracy) + AST fallback
- TypeScript: LSP (primary, 98% accuracy) + Regex fallback

**LSP Integration (v1.1+):**
- Uses Language Server Protocol for accurate extraction
- Full type resolution, docstrings, cross-file references
- Fallback to AST/Regex when LSP unavailable
- See `@doc:lsp-integration` for details

**Full patterns:** См. `config/component-patterns.json`

---

### Staleness Criteria

| Type | Severity | Description |
|------|----------|-------------|
| Missing component | HIGH | Компонент в коде, но нет в docs |
| Signature mismatch | MEDIUM | Параметры не совпадают |
| Outdated timestamp | LOW | Code modified > 7 days after docs |
| Deprecated component | MEDIUM | Компонент в docs, удалён из кода |

**Detection logic:** См. `@doc:staleness-detection`

---

## Documentation

**Navigation layer** - все детали в отдельных файлах.

### Core Documentation

| Document | Purpose | Reference |
|----------|---------|-----------|
| **Core Functionality** | 7 pipeline stages | `@doc:core-functionality` |
| **Commands** | Detailed command usage | `@doc:commands` |
| **Staleness Detection** | Detection algorithms | `@doc:staleness-detection` |
| **LSP Integration** | LSP-based extraction (v1.1+) | `@doc:lsp-integration` |
| **Implementation Guide** | 6 implementation phases | `@doc:implementation` |

**Location:** `docs/` directory

---

### Templates

| Template | Purpose | Reference |
|----------|---------|-----------|
| **endpoint-update** | API endpoint YAML generation | `@template:endpoint-update` |
| **table-update** | Database table YAML generation | `@template:table-update` |
| **changelog-entry** | Changelog markdown generation | `@template:changelog-entry` |

**Location:** `templates/` directory

---

### Examples

| Example | Scenario | Reference |
|---------|----------|-----------|
| **Endpoint Sync** | Sync API endpoint documentation | `@example:endpoint-sync` |
| **Database Sync** | Sync database schema documentation | `@example:database-sync` |

**Location:** `examples/` directory

---

### Schemas

| Schema | Purpose | Reference |
|--------|---------|-----------|
| **sync-output** | JSON Schema для output validation | `@schema:sync-output` |

**Location:** `schemas/` directory

---

### Rules

| Document | Purpose | Reference |
|----------|---------|-----------|
| **Best Practices** | Documentation quality guidelines | `@rules:best-practices` |

**Location:** `rules/` directory

---

## Safety Rules

**What NOT to do:**
- ❌ NEVER modify code files (только docs)
- ❌ NEVER delete documentation without user confirmation
- ❌ NEVER commit without user approval (preview first)
- ❌ NEVER overwrite manual descriptions with auto-generated text

**Safeguards:**
- ✅ Preview mode by default (user approval required)
- ✅ Backup original YAML before modification
- ✅ Rollback on parse errors

---

## Integration

**Workflow Position:**
```
PHASE 5A: Code commit
   ↓
PHASE 5C: @skill:doc-sync → Generate updates
   ↓
User approval → Apply updates → Commit docs
   ↓
PHASE 5B: @skill:pr-automation → Create PR
```

**Input Dependencies:**
- `git-workflow` - Git diff context, commit messages
- `context-awareness` - Project structure, language detection

**Output Consumers:**
- `git-workflow` - Commit docs updates
- `pr-automation` - Include docs changes in PR
- `User` - Review and approve updates

---

## Version History

### v1.1.0 (2026-02-09) - LSP Integration

**New Features:**
- ✅ LSP-based signature extraction (98% accuracy)
- ✅ Hybrid approach: LSP primary + AST/Regex fallback
- ✅ Full type resolution (Literal, Union, Dict, etc.)
- ✅ Docstring extraction with parameter descriptions
- ✅ Cross-file type references
- ✅ LSP server caching (5s → 1s after first run)

**Supported LSP servers:**
- pyright-lsp (Python: FastAPI, SQLAlchemy, Pydantic)
- typescript-lsp/vtsls (TypeScript/JavaScript)

**Configuration:**
- `config/lsp-config.json` - LSP server settings
- Feature flag: `enable_lsp` (default: true)

**Documentation:**
- `docs/lsp-integration.md` - Full LSP guide
- `examples/lsp-extraction.md` - Real-world comparison

### v1.0.0 (2026-02-09)

**Features:**
- ✅ Git diff analysis → component detection
- ✅ Code-to-docs mapping via architecture_refs
- ✅ AST parsing (FastAPI, SQLAlchemy, TypeScript)
- ✅ YAML auto-update with preview
- ✅ Changelog generation
- ✅ Three modes: sync, check, validate

**Roadmap:**
- 🔜 v1.2: LSP workspace symbol search
- 🔜 v1.3: Automatic LSP server installation
- 🔜 v2.0: TOON format support, Go/Rust LSP

---

**Author:** Family Budget Team
**Support:** См. `examples/` для real-world scenarios, `rules/best-practices.md` для best practices
