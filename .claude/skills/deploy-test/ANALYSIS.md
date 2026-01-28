# Deploy-Test Skill Documentation Analysis

**Date**: 2026-01-27
**Current VERSION**: 10.1.11
**Skill Version**: v9.1.3
**Analysis Status**: ✅ Complete

---

## Executive Summary

The deploy-test skill documentation has been reviewed against the actual `deploy.sh` implementation and CI/CD architecture. This analysis identifies **critical discrepancies** between documentation and implementation that could lead to incorrect deployment procedures.

### Key Findings

1. **Registry-First Architecture is Correctly Documented** ✅
   - Documentation accurately reflects v9.0+ registry-only deployment
   - No local builds on server, only pull from ghcr.io
   - VERSION file manually managed before deployment

2. **deploy.sh Options Still Support Version Bumping** ⚠️
   - Documentation states version bumping removed in v9.0
   - Reality: `--patch`, `--minor`, `--major`, `--version TYPE`, `--set-version X.Y.Z` still exist
   - These options are **deprecated but functional** for local build fallback

3. **Missing Hybrid Build Mode Documentation** ⚠️
   - `deploy.sh` still supports both `--use-registry` (registry mode) and `--force-build` (local build)
   - Documentation incorrectly states local build mode completely removed
   - This creates confusion about available options

---

## Current deploy.sh Options (v10.1.11)

### Actually Supported Options

```bash
# Registry Mode (Recommended)
--use-registry              # Pull pre-built images from ghcr.io
--image-tag TAG            # Specify custom image tag (optional)
--sync-mode MODE           # Code sync: update|skip|mirror|clean
--cleanup-mode MODE        # Cleanup: smart|full|skip

# Version Management (Deprecated but functional)
--patch                    # DEPRECATED: Bump patch version
--minor                    # DEPRECATED: Bump minor version
--major                    # DEPRECATED: Bump major version
--version TYPE             # Version bump type (patch|minor|major)
--set-version X.Y.Z        # Set explicit version
--no-version               # Skip version bump

# Local Build Mode (Fallback)
--force-build              # Force local frontend build
--restart-dockerd          # Force Docker daemon restart
--no-restart-dockerd       # Skip Docker daemon restart
```

### Documentation Claims (INCORRECT)

From SKILL.md v9.1.3:

> **BREAKING CHANGE (v9.0):**
> - ❌ Локальная сборка на сервере (build mode)
> - ❌ Флаги --use-registry, --force-build, --image-tag

**Reality**: All these flags still exist and function in deploy.sh.

---

## Deployment Workflow Analysis

### Documented Workflow (Mostly Correct)

```bash
# Step 1: Manual VERSION bump (✅ Correct)
echo "10.0.50" > VERSION
git commit -m "chore: bump version to 10.0.50"
git push origin test

# Step 2: GitHub Actions CI/CD (~5 min) (✅ Correct)
# - Reads VERSION file → 10.0.50
# - Builds 5 Docker images with embedded frontend
# - Pushes to ghcr.io/ikeniborn/familybudget-*:10.0.50

# Step 3: Deployment on server (⚠️ Simplified)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart"
# → Reads VERSION file → 10.0.50
# → Pulls images from ghcr.io
# → docker compose up -d
# → Migrations
# → Health checks
# → Cleanup old images (7 days)
```

### Actual deploy.sh Behavior

```bash
# deploy.sh supports BOTH modes:

# Mode 1: Registry-First (Recommended)
sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart
# → USE_REGISTRY=true
# → Skip version bump (VERSION file already set)
# → Pull images by VERSION tag from ghcr.io
# → No local build

# Mode 2: Local Build Fallback (Still Available)
sudo bash deploy.sh --version patch --force-build --sync-mode update
# → VERSION_BUMP_TYPE=patch
# → FORCE_FRONTEND_BUILD=true
# → Bump VERSION file (10.1.11 → 10.1.12)
# → Build frontend locally (npm run build:prod)
# → Build Docker images locally
# → docker compose up -d
```

**Discrepancy**: Documentation states local build mode removed, but it's still fully functional.

---

## IMAGE_VERSIONS.json Analysis

### Current State

```json
{
  "backend": {
    "version": "10.1.10",
    "hash": "f3424072",
    "lastModified": "2026-01-27T18:31:19Z"
  },
  "bot": {
    "version": "10.0.57",
    "hash": "707bd328"
  },
  "nginx": {
    "version": "10.0.10",
    "hash": "cb82ff0d"
  },
  "redis": {
    "version": "9.0.3",
    "hash": "4eb5ebb0"
  },
  "postgresql": {
    "version": "9.0.3",
    "hash": "4eb5ebb0"
  }
}
```

### VERSION File

```
10.1.11
```

### Inconsistency Issue

- **VERSION file**: 10.1.11
- **Backend image**: 10.1.10
- **Bot image**: 10.0.57

**Question**: How does deploy.sh determine which image to pull?

**Answer** (from deploy.sh code):
```bash
# scripts/lib/docker.sh
if [[ "$USE_REGISTRY" == "true" ]]; then
    # Pull images from registry
    if [[ -n "$USER_IMAGE_TAG" ]]; then
        IMAGE_TAG="$USER_IMAGE_TAG"
    else
        # Auto-detect from VERSION file
        if [[ -f "$SCRIPT_DIR/VERSION" ]]; then
            IMAGE_TAG=$(cat "$SCRIPT_DIR/VERSION" | tr -d '[:space:]')
        else
            error "VERSION file not found"
        fi
    fi

    # Pull all images with same tag
    docker pull ghcr.io/ikeniborn/familybudget-backend:${IMAGE_TAG}
    docker pull ghcr.io/ikeniborn/familybudget-bot:${IMAGE_TAG}
    # ... etc
fi
```

**Reality**: deploy.sh uses **single VERSION tag** for ALL images, not individual IMAGE_VERSIONS.json versions.

---

## Documentation Corrections Needed

### 1. Hybrid Build Support (Critical)

**Current Documentation** (INCORRECT):
> **v9.0.0 (2026-01-21)**
> **Registry-First Architecture:**
> - ❌ **Hybrid Build Mode**: Support both registry pull and local build
> - ❌ **Local Build Available**: Fallback option if registry unavailable

**Correct Statement**:
```markdown
### Registry-First Architecture (v9.0+)

**Recommended Mode**: Registry pull from ghcr.io
**Fallback Mode**: Local build (deprecated but functional)

deploy.sh supports both modes:

1. **Registry Mode** (recommended):
   - Use `--use-registry` flag
   - Pull pre-built images from ghcr.io by VERSION tag
   - No npm/Node.js required on server
   - Deployment: 2-3 minutes (pull only)

2. **Local Build Mode** (fallback):
   - Use `--force-build` flag
   - Build frontend locally (npm run build:prod)
   - Build Docker images locally
   - Deployment: 5-7 minutes (build + start)
   - **Deprecated**: Only for emergency use or testing
```

### 2. Available Options Documentation

**Current Documentation** (INCOMPLETE):
```markdown
**Available Options:**
- ✅ `--use-registry` - Pull images from ghcr.io (обязательная опция)
- ✅ `--image-tag TAG` - Specify custom image tag
- ✅ `--sync-mode MODE` - Code sync mode
- ✅ `--cleanup-mode MODE` - Cleanup old images
```

**Missing Options**:
```markdown
**Version Management Options** (deprecated, use with caution):
- `--patch` - Bump patch version (X.Y.Z → X.Y.Z+1)
- `--minor` - Bump minor version (X.Y.Z → X.Y+1.0)
- `--major` - Bump major version (X.Y.Z → X+1.0.0)
- `--version TYPE` - Version bump type (patch|minor|major)
- `--set-version X.Y.Z` - Set explicit version
- `--no-version` - Skip version bump

**Local Build Options** (deprecated, emergency only):
- `--force-build` - Force local frontend rebuild
- `--restart-dockerd` - Force Docker daemon restart
- `--no-restart-dockerd` - Skip Docker daemon restart
```

### 3. Registry + Version Bump Warning

**Missing Critical Warning**:
```markdown
⚠️ **IMPORTANT**: Do NOT combine `--use-registry` with version bump options!

**Why**:
- `--use-registry` pulls images by **existing VERSION tag** from registry
- Version bump changes VERSION file **locally**
- Registry doesn't have images for the **new version** yet
- Result: Pull fails with "image not found"

**Correct Workflow**:
1. Bump VERSION manually in git repository
2. Push to trigger GitHub Actions CI/CD
3. Wait for CI/CD to build and push images (~5 min)
4. Then deploy with `--use-registry` (pulls new version)

**Wrong** (will fail):
```bash
# ❌ BAD: Bump version and use registry simultaneously
sudo bash deploy.sh --use-registry --version patch
# → VERSION changes from 10.1.11 to 10.1.12
# → Tries to pull ghcr.io/.../backend:10.1.12
# → Image doesn't exist in registry yet!
# → Pull fails
```

**Correct** (two-step process):
```bash
# Step 1: Local repository (developer machine)
echo "10.1.12" > VERSION
git commit -m "chore: bump version to 10.1.12"
git push origin test

# Step 2: Wait for GitHub Actions (~5 min)
# → CI builds images
# → Pushes to ghcr.io/.../backend:10.1.12

# Step 3: Deploy on server
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --sync-mode update"
# → Pull successful (images exist in registry)
```
```

---

## Recommended Documentation Structure

### SKILL.md Section: "Deploy.sh Options Reference"

```markdown
## Deploy.sh Options Reference

### Registry Mode Options (Recommended)

**Primary Options:**
- `--use-registry` - Pull pre-built images from ghcr.io (required for registry mode)
- `--sync-mode MODE` - Code sync: update (default) | skip | mirror | clean
- `--cleanup-mode MODE` - Cleanup: smart (default) | full | skip

**Optional Registry Options:**
- `--image-tag TAG` - Override VERSION file tag (for testing specific builds)

**Example** (production workflow):
```bash
# VERSION already bumped and pushed to git
# GitHub Actions completed successfully
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --sync-mode update --cleanup-mode smart"
```

---

### Local Build Mode Options (Deprecated - Emergency Only)

**⚠️ WARNING**: Local build mode is deprecated. Use only if:
- Registry is unavailable (network issues)
- Testing local changes before CI/CD
- Emergency hotfix deployment

**Version Management:**
- `--version TYPE` - Bump version (TYPE: patch|minor|major)
- `--set-version X.Y.Z` - Set explicit version
- `--no-version` - Skip version bump (use existing VERSION)

**Build Control:**
- `--force-build` - Force local frontend rebuild
- `--restart-dockerd` - Restart Docker daemon before build

**Example** (emergency local build):
```bash
# Only if registry unavailable
sudo bash deploy.sh --force-build --version patch --sync-mode update
```

---

### Incompatible Option Combinations

**❌ DO NOT COMBINE**:
```bash
# WRONG: Registry + Version Bump
sudo bash deploy.sh --use-registry --version patch
# → Will fail: new version not in registry yet

# WRONG: Registry + Force Build
sudo bash deploy.sh --use-registry --force-build
# → Contradictory: can't pull AND build simultaneously
```

**✅ CORRECT ALTERNATIVES**:
```bash
# Option 1: Registry-only (recommended)
sudo bash deploy.sh --use-registry --sync-mode update

# Option 2: Local build-only (emergency)
sudo bash deploy.sh --force-build --version patch --sync-mode update
```
```

---

## Error Pattern Configuration Validation

### Current error-patterns.json (v9.1.0)

✅ **Correct**: All error patterns properly classified
✅ **Correct**: TOON optimization functional (44.9% token savings)
✅ **Correct**: Manual action instructions clear

### Suggested Enhancement

Add error pattern for **version mismatch**:

```json
{
  "not_fixable": [
    {
      "pattern": "Error response from daemon.*manifest.*not found",
      "category": "image_not_found",
      "manual_action": "Check VERSION file matches available registry tags: docker search ghcr.io/ikeniborn/familybudget-backend --limit 50; Verify GitHub Actions completed successfully",
      "severity": "critical",
      "description": "Docker image not found in registry (version mismatch)"
    }
  ]
}
```

**Rationale**: Common error when VERSION bump happens without CI/CD completion.

---

## Changelog Corrections

### v9.0.0 Entry (Current - Incorrect)

```markdown
**Removed:**
- ❌ Локальная сборка на сервере (build mode)
- ❌ npm/Node.js на сервере (не требуется)
- ❌ Флаги --use-registry, --force-build, --image-tag
```

### v9.0.0 Entry (Corrected)

```markdown
**Deprecated (but still functional):**
- ⚠️ Локальная сборка на сервере (build mode) - emergency fallback only
- ⚠️ Version bump options (--patch, --minor, --major) - manual VERSION bump preferred
- ⚠️ --force-build flag - use only when registry unavailable

**Added:**
- ✅ Registry-first deployment (recommended mode)
- ✅ --use-registry flag (pull from ghcr.io)
- ✅ IMAGE_VERSIONS.json selective rebuilding
- ✅ Automatic cleanup of old images (7 days retention)

**Recommended Workflow Changed:**
- Old: Local build with version bump on server
- New: Manual VERSION bump → GitHub Actions CI/CD → Registry pull deployment
```

---

## Testing Validation

### Test Scenarios to Add

```bash
# Test 1: Registry mode with correct VERSION
echo "10.1.11" > VERSION
git commit && git push
# Wait for CI/CD
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry"
# Expected: ✅ Success (images exist)

# Test 2: Registry mode with wrong VERSION (should fail)
echo "99.99.99" > VERSION
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry"
# Expected: ❌ Error: manifest not found

# Test 3: Registry + version bump (should fail with warning)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --use-registry --version patch"
# Expected: ❌ Error or Warning: incompatible options

# Test 4: Local build fallback (should work)
ssh budget-test "cd ~/familyBudget && sudo bash deploy.sh --force-build --version patch"
# Expected: ✅ Success (builds locally)
```

---

## Recommendations

### Immediate Actions

1. **Update SKILL.md v9.1.4**:
   - Add "Hybrid Build Support" section
   - Document deprecated but functional options
   - Add incompatible option combinations warning
   - Clarify VERSION management workflow

2. **Add Error Pattern**:
   - "manifest not found" → version mismatch detection
   - Manual action: verify CI/CD completion

3. **Update Changelog**:
   - Correct v9.0.0 entry (deprecated, not removed)
   - Clarify recommended vs. fallback modes

### Future Actions

1. **Consider Removing Local Build** (v10.0?):
   - If truly deprecated, remove code entirely
   - Or keep for emergency use but gate behind confirmation prompt

2. **Add deploy.sh Validation**:
   ```bash
   if [[ "$USE_REGISTRY" == "true" && -n "$VERSION_BUMP_TYPE" ]]; then
       error "Incompatible options: --use-registry cannot be combined with version bump"
       info "Correct workflow:"
       info "  1. Bump VERSION manually and push to git"
       info "  2. Wait for GitHub Actions CI/CD"
       info "  3. Deploy with --use-registry"
       exit 1
   fi
   ```

3. **Improve IMAGE_VERSIONS.json Integration**:
   - Currently unused by deploy.sh
   - Consider using for selective pulling (e.g., only pull changed services)

---

## Conclusion

The deploy-test skill documentation is **mostly accurate** for the recommended registry-first workflow, but contains **critical omissions** regarding:

1. **Hybrid build support** still exists (not removed in v9.0)
2. **Version management options** still functional (deprecated but working)
3. **Incompatible option combinations** not documented
4. **Local build fallback** incorrectly stated as removed

**Priority**: Update documentation to reflect actual deploy.sh capabilities and add warnings about option incompatibilities.

**Risk**: Current documentation could lead users to attempt invalid option combinations (e.g., `--use-registry --version patch`) resulting in deployment failures.

**Recommended Version**: v9.1.4 with corrections applied.
