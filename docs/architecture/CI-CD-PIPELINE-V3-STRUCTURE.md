# CI/CD Pipeline v3.0 - Structure Plan

**Status:** Planning Document
**Target:** Merge ci-cd-pipeline.md + ci-cd-build-deploy.md
**Estimated Size:** 1500-2000 lines

## Proposed Structure

### Part 1: Overview (200 lines)
- Complete pipeline overview
- Architecture: Registry-First (v9.0)
- Key changes from v8.x → v9.0
- Quick reference table (all workflows)

### Part 2: Testing & Validation Workflows (400 lines)
**Source:** ci-cd-pipeline.md

- Frontend Tests (type-check, unit, build, lint)
- Backend Tests (pytest, bot tests)
- E2E Tests (Playwright: chromium, firefox, webkit)
- API Contract Tests (OpenAPI validation)
- Security Scan (Trivy, Bandit, ESLint)
- Accessibility Tests (axe-core)
- TypeScript Check (non-blocking)
- Coverage thresholds (frontend: 80%, backend: 85%)

### Part 3: Build & Registry Workflows (500 lines)
**Source:** ci-cd-build-deploy.md (Part 1)

- Build and Push Docker Images workflow
- Frontend Build job (cache busting in CI)
- Multi-stage Dockerfiles (5 images)
  - backend (FastAPI + frontend embedded)
  - bot (python-telegram-bot)
  - nginx (reverse proxy)
  - redis (custom config)
  - postgresql (migrations embedded)
- Selective rebuilding (IMAGE_VERSIONS.json)
- Registry tagging strategy (semver only)
- Automatic image cleanup (7 days retention)

### Part 4: Deployment Process (300 lines)
**Source:** ci-cd-build-deploy.md (Part 2)

- Registry-only deployment (pull from ghcr.io)
- Server workflow:  1. Pull images by version tag
  2. docker compose up
  3. Run migrations
  4. Health checks
- Testing deployment (budget-test)
- Production deployment (budget-prod)
- VERSION file management
- Rollback procedures

### Part 5: Complete Flow Diagrams (100 lines)

**Diagram 1: Testing Flow**
```
git push → Testing Workflows (parallel) → Status Checks → Merge
```

**Diagram 2: Build Flow**
```
git push test → CI Build → ghcr.io → Server Pull → Deploy
```

**Diagram 3: Production Release**
```
git tag v9.0.0 → CI Build → ghcr.io → Pull to prod → Migrations → Live
```

### Appendix (200 lines)

A. Workflow Configuration Files
B. Environment Variables
C. Secrets Management
D. Troubleshooting CI Failures
E. Performance Optimization
F. Related Documentation

---

## Content Mapping

### From ci-cd-pipeline.md (562 lines)
**Keep:**
- All workflow descriptions (8 workflows) → Part 2
- Coverage thresholds → Part 2
- Security scanning details (Trivy, Bandit) → Part 2
- Accessibility testing → Part 2
- Troubleshooting sections → Appendix D

**Remove:**
- Outdated "Release Drafter" workflow (marked as deleted)

### From ci-cd-build-deploy.md (1025 lines)
**Keep:**
- v9.0 architecture overview → Part 1
- Build and Push workflow → Part 3
- Multi-stage Dockerfiles → Part 3
- Deployment process → Part 4
- Cache busting (CI implementation) → Part 3
- IMAGE_VERSIONS.json → Part 3
- Troubleshooting deployment → Appendix D

**Integrate from cache-busting-fix.md:**
- Execution order (minify → cache bust → compress) → Part 3
- Validation patterns → Part 3

---

## Integration Strategy

### Step 1: Create Framework
- New file: `ci-cd-complete-pipeline.md`
- Add Part 1 (overview) with v9.0 changes summary

### Step 2: Copy Testing Workflows
- Extract from ci-cd-pipeline.md → Part 2
- Update references to point to new structure

### Step 3: Copy Build Workflows
- Extract from ci-cd-build-deploy.md → Part 3
- Add cache-busting-fix.md content

### Step 4: Copy Deployment
- Extract from ci-cd-build-deploy.md → Part 4

### Step 5: Create Diagrams
- Mermaid flowcharts for complete pipeline

### Step 6: Create Appendix
- Consolidate troubleshooting from both docs
- Add cross-references

### Step 7: Update References
- CLAUDE.md: Update CI/CD reference
- index.yaml: Update quick_links
- README.md: Update architecture links

### Step 8: Archive Old Files
- ci-cd-pipeline.md → docs/archive/ or DELETE
- ci-cd-build-deploy.md → docs/archive/ or DELETE

---

## Implementation Note

Due to time and token budget constraints, this document outlines the STRUCTURE for merging.

**Recommended action:**
1. Use this structure as a guide
2. Implement merge in separate session OR
3. Skip full merge for now, just update index.yaml references to point to ci-cd-build-deploy.md as primary doc (it's newer and more comprehensive for v9.0)

**Quick Win Alternative:**
- Mark ci-cd-pipeline.md as "supplementary" in index.yaml
- Mark ci-cd-build-deploy.md as "primary" for v9.0
- Add note in both docs cross-referencing each other
- Defer full merge to future documentation update
