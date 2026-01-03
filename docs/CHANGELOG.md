# Documentation Changelog

All notable changes to documentation in this project.

---

## [Documentation Consolidation] - 2025-01-03

### Added

#### Development Build Rules
- **`docs/architecture/build-system.md`** - New section "Development vs Production Build Requirements"
  - Clarified: Minification NOT required during development
  - Only syntax checks mandatory during dev cycle
  - When minification IS required (commits, PRs, deployment)
  - Development workflow examples with ✅/❌ indicators
  - Rationale: Saves 30-60s per build cycle during development

- **`docs/architecture/build-system.md`** - New section "Cache Busting"
  - PLACEHOLDER token validation process
  - Execution order (AFTER minification, not before)
  - Troubleshooting guide for cache busting errors
  - Quote compatibility (single vs double quotes)
  - Validation commands for deployment

- **`CLAUDE.md`** - New section "Build Requirements"
  - **CRITICAL RULE:** Minification is NOT required during development
  - Quick development workflow (edit → syntax check → test → commit → then minify)
  - When minification IS required list
  - Build commands reference
  - Cross-reference to build-system.md

#### PLACEHOLDER Token Troubleshooting
- Complete troubleshooting section for cache busting issues:
  - Error: PLACEHOLDER token corrupted or missing
  - Error: sed pattern failed to replace PLACEHOLDER
  - Error: File permissions prevent replacement
  - Error: Missing sed/perl
  - Validation commands for pre/post-deployment checks

### Changed

#### PRD README - Version Update
- **`docs/prd/README.md`**
  - Updated application version: v5.1.x → v6.8.0+
  - Updated last modification date: 2025-12-06 → 2025-01-03
  - Reflects current stable release version

#### Cache Busting Documentation
- Merged content from `docs/architecture/cache-busting-fix.md` into `docs/architecture/build-system.md`
  - Added overview section on cache busting system
  - Added PLACEHOLDER token validation details
  - Added execution order explanation (critical: AFTER minification)
  - Added comprehensive troubleshooting guide
  - Added related files section

### Fixed

#### File Permissions
- Changed 28 markdown files from mode 600 → 644
  - Enables proper git tracking and collaborative editing
  - Fixed permissions on:
    - `/docs/architecture/*.md` (multiple files)
    - `/docs/deployment/*.md`
    - `/docs/changelog/*.md`
    - Root files: `CLAUDE.md`, `START.md`, `README.md`

### Deferred (Complex Tasks)

The following consolidation tasks were analyzed but deferred due to complexity:

#### Category Selection Fixes (3 files, ~1,750 lines total)
- `docs/architecture/frontend/category-selection-fix.md` (639 lines, English, v6.7.0-6.7.1)
- `docs/architecture/category-selection-fix.md` (654 lines, Russian, v6.6.1-6.7.1)
- `docs/architecture/modal-hints-fix.md` (461 lines, Russian, v6.7.0)

**Status:** Requires careful merge due to:
- Multiple version iterations (v6.6.1 → v6.7.0 → v6.7.1)
- Language differences (English vs Russian)
- Overlapping content but different perspectives
- Technical details about isInitialFiltering, mode parameter, clearSelection() method

**Action:** Keep all 3 files for now, add cross-references

#### Caching Strategy (2 files, ~1,490 lines total)
- `docs/prd/14-caching-strategy.md` (860 lines, product-focused)
- `docs/architecture/caching-strategy.md` (631 lines, technical implementation)

**Status:** Requires careful merge due to:
- Different audience (product vs engineering)
- Substantial overlap (~60%)
- Product context needed alongside technical details

**Action:** Add cross-references, plan future consolidation

#### Recurring Plans Fixes
- `docs/architecture/recurring-plans-fixes.md` - Temporary fix documentation

**Status:** Contains TODO markers for Phase 4 features
**Action:** Resolve TODOs first, then merge into main recurring-plans.md

### Summary Statistics

**Before consolidation:**
- 51 markdown files
- 2.4 MB total size
- 28 files with incorrect permissions (600)
- 6 duplicate/overlapping documents identified
- PRD outdated (v5.1.x references)
- No development build rules documented

**After this update:**
- 51 markdown files (no deletions yet - complex merges deferred)
- ~2.4 MB (minor additions)
- 0 files with incorrect permissions
- Development build rules added (2 locations)
- Cache busting fully documented
- PRD current (v6.8.0+ references)

**Improvement summary:**
- ✅ Fixed all permission issues (100% of 28 files)
- ✅ Added critical development workflow documentation
- ✅ Consolidated cache busting documentation
- ✅ Updated version references
- ⏳ Deferred complex merges (category selection, caching strategy, recurring plans)

### Files Modified

**Added:**
- `docs/CHANGELOG.md` (this file) - Documentation change tracking

**Modified:**
- `docs/architecture/build-system.md` - Added 2 new sections (~240 lines)
- `CLAUDE.md` - Replaced "Build System" section with "Build Requirements" (~40 lines)
- `docs/prd/README.md` - Updated version references (2 lines)
- 28 markdown files - Fixed permissions (600 → 644)

**No deletions yet** - Complex merges deferred for careful review

---

## Previous Changes

Documentation history before 2025-01-03 tracked in git commit messages and individual file headers.

---

## Changelog Guidelines

This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

**Categories:**
- **Added** - New documentation sections or files
- **Changed** - Updates to existing documentation
- **Deprecated** - Soon-to-be removed documentation
- **Removed** - Deleted documentation files
- **Fixed** - Corrections to documentation errors
- **Security** - Security-related documentation updates

**Version Format:** Documentation updates use descriptive names (e.g., "Documentation Consolidation") rather than semantic versions.
