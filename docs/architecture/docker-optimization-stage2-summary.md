# Docker Optimization - Этап 2: Security & Metadata - Summary

**Дата:** 2026-01-26
**Статус:** ✅ Завершен
**Следующий этап:** Этап 3 (Frontend Optimization - Optional)

---

## Выполненные изменения

### 2.1 OCI Labels (OpenContainer Initiative Metadata)

OCI labels добавлены в оба образа согласно спецификации [opencontainers.org](https://github.com/opencontainers/image-spec/blob/main/annotations.md).

#### Backend Dockerfile

**Файл:** `backend/Dockerfile`
**Изменения:** После строки 107 (USER appuser), перед EXPOSE 8000

**Добавленные labels:**

**Static metadata:**
```dockerfile
LABEL org.opencontainers.image.title="Family Budget Backend" \
      org.opencontainers.image.description="FastAPI backend with embedded frontend (PWA + HTMX + Tailwind + DaisyUI)" \
      org.opencontainers.image.vendor="Family Budget Team" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/ikeniborn/familybudget" \
      org.opencontainers.image.documentation="https://github.com/ikeniborn/familybudget/blob/main/docs/architecture/docker.md"
```

**Dynamic metadata** (via build args):
```dockerfile
ARG VERSION
ARG GIT_COMMIT
ARG BUILD_DATE
LABEL org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.created="${BUILD_DATE}"
```

---

#### Bot Dockerfile

**Файл:** `bot/Dockerfile`
**Изменения:** После health check (строка 59), перед CMD

**Добавленные labels:**

**Static metadata:**
```dockerfile
LABEL org.opencontainers.image.title="Family Budget Bot" \
      org.opencontainers.image.description="Telegram bot (python-telegram-bot 21.10)" \
      org.opencontainers.image.vendor="Family Budget Team" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/ikeniborn/familybudget"
```

**Dynamic metadata** (via build args):
```dockerfile
ARG VERSION
ARG GIT_COMMIT
ARG BUILD_DATE
LABEL org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.created="${BUILD_DATE}"
```

---

### 2.2 GitHub Actions - Build Args

**Файл:** `.github/workflows/build-and-push.yml`

#### Build Date Generation

**Добавлен step** после cache busting (после строки 503):
```yaml
- name: Set build date
  id: build-date
  run: echo "date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" >> $GITHUB_OUTPUT
```

Генерирует ISO 8601 timestamp в UTC для reproducible builds.

---

#### Backend Build Args

**Обновлены build-args** (строки 518-522):
```yaml
build-args: |
  VERSION=${{ steps.version.outputs.VERSION }}
  PYTHON_VERSION=3.11
  CACHE_VERSION=${{ env.CACHE_VERSION }}
  GIT_COMMIT=${{ github.sha }}              # NEW
  BUILD_DATE=${{ steps.build-date.outputs.date }}  # NEW
```

---

#### Bot Build Args

**Обновлены build-args** (строки 537-541):
```yaml
build-args: |
  VERSION=${{ steps.version.outputs.VERSION }}
  PYTHON_VERSION=3.11
  GIT_COMMIT=${{ github.sha }}              # NEW
  BUILD_DATE=${{ steps.build-date.outputs.date }}  # NEW
```

---

### 2.3 Enhanced Trivy Security Scanning

**Файл:** `.github/workflows/build-and-push.yml`

#### Backend Scanner Improvements

**Обновлен Trivy scanner** (строки 660-667):
```yaml
- name: Run Trivy scanner (backend)
  if: needs.image-build-push.outputs.backend_built == 'true'
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ghcr.io/${{ github.repository_owner }}/familybudget-backend:${{ steps.tag.outputs.TAG }}
    format: 'sarif'
    output: 'trivy-backend.sarif'
    severity: 'CRITICAL,HIGH,MEDIUM'  # NEW: Added MEDIUM
    vuln-type: 'os,library'           # NEW: Explicit types
    exit-code: '0'                     # NEW: Report only, don't fail build
```

**Добавлен vulnerability summary step:**
```yaml
- name: Generate vulnerability summary (backend)
  if: needs.image-build-push.outputs.backend_built == 'true'
  run: |
    echo "## 🔒 Security Scan: Backend" >> $GITHUB_STEP_SUMMARY
    docker run --rm aquasec/trivy:latest image \
      --severity CRITICAL,HIGH \
      --format table \
      ghcr.io/${{ github.repository_owner }}/familybudget-backend:${{ steps.tag.outputs.TAG }} \
      >> $GITHUB_STEP_SUMMARY || true
  continue-on-error: true
```

---

#### Bot Scanner Improvements

**Обновлен Trivy scanner** (строки 690-697):
```yaml
- name: Run Trivy scanner (bot)
  if: needs.image-build-push.outputs.bot_built == 'true'
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ghcr.io/${{ github.repository_owner }}/familybudget-bot:${{ steps.tag.outputs.TAG }}
    format: 'sarif'
    output: 'trivy-bot.sarif'
    severity: 'CRITICAL,HIGH,MEDIUM'  # NEW: Added MEDIUM
    vuln-type: 'os,library'           # NEW: Explicit types
    exit-code: '0'                     # NEW: Report only
```

**Добавлен vulnerability summary step:**
```yaml
- name: Generate vulnerability summary (bot)
  if: needs.image-build-push.outputs.bot_built == 'true'
  run: |
    echo "## 🔒 Security Scan: Bot" >> $GITHUB_STEP_SUMMARY
    docker run --rm aquasec/trivy:latest image \
      --severity CRITICAL,HIGH \
      --format table \
      ghcr.io/${{ github.repository_owner }}/familybudget-bot:${{ steps.tag.outputs.TAG }} \
      >> $GITHUB_STEP_SUMMARY || true
  continue-on-error: true
```

---

## Expected Results

### OCI Labels Benefits

**Metadata Visibility:**
- ✅ Inspect image metadata: `docker inspect ghcr.io/.../backend:10.0.50`
- ✅ Registry UI shows labels in ghcr.io
- ✅ Security scanning tools (Trivy, Snyk) read metadata
- ✅ Version tracking without pulling image

**Example inspection:**
```bash
docker inspect ghcr.io/ikeniborn/familybudget-backend:10.0.50 | jq '.[0].Config.Labels'

{
  "org.opencontainers.image.title": "Family Budget Backend",
  "org.opencontainers.image.version": "10.0.50",
  "org.opencontainers.image.revision": "af29ea0a...",
  "org.opencontainers.image.created": "2026-01-26T15:30:00Z",
  "org.opencontainers.image.source": "https://github.com/ikeniborn/familybudget"
}
```

---

### Trivy Scanning Improvements

**Before:**
- Scans only CRITICAL,HIGH severity
- No summary in workflow logs
- SARIF reports uploaded to GitHub Security

**After:**
- ✅ Scans CRITICAL,HIGH,MEDIUM severity (more comprehensive)
- ✅ Vulnerability summary table in GitHub Actions Summary tab
- ✅ SARIF reports uploaded (same as before)
- ✅ Build doesn't fail on vulnerabilities (exit-code: '0')
- ✅ Explicit vuln-type: 'os,library' for clarity

**Workflow Output:**
```
## 🔒 Security Scan: Backend

┌───────────────┬─────────────────┬──────────┬─────────┬────────────────┐
│    Library    │  Vulnerability  │ Severity │ Status  │     Title      │
├───────────────┼─────────────────┼──────────┼─────────┼────────────────┤
│ libssl3       │ CVE-2024-xxxxx  │ HIGH     │ fixed   │ OpenSSL issue  │
└───────────────┴─────────────────┴──────────┴─────────┴────────────────┘
```

**GitHub Security Tab:**
- Code scanning alerts for CRITICAL,HIGH,MEDIUM vulnerabilities
- Categorized by image: 'backend-image', 'bot-image'

---

## Security Impact

### Metadata Traceability
- ✅ Every image tagged with git commit SHA
- ✅ Build timestamp for audit trails
- ✅ Version matches git tags (semver)
- ✅ Easy rollback: inspect image labels → identify exact code version

### Enhanced Vulnerability Detection
- ✅ MEDIUM severity CVEs now detected (previously missed)
- ✅ Quick visibility: summary table in workflow run
- ✅ Detailed reports: SARIF files in GitHub Security
- ✅ Non-blocking: vulnerabilities reported but build succeeds

---

## Validation

### OCI Labels Validation

**After CI/CD build:**
```bash
# Check backend labels
docker inspect ghcr.io/ikeniborn/familybudget-backend:10.0.50 | \
  jq '.[0].Config.Labels | keys | select(. | contains(["org.opencontainers.image"]))'

# Verify all required fields present
docker inspect ghcr.io/ikeniborn/familybudget-backend:10.0.50 | \
  jq '.[0].Config.Labels."org.opencontainers.image.version"'
# Expected: "10.0.50"

docker inspect ghcr.io/ikeniborn/familybudget-backend:10.0.50 | \
  jq '.[0].Config.Labels."org.opencontainers.image.revision"'
# Expected: "af29ea0a..." (git commit SHA)
```

---

### Trivy Scanning Validation

**Check GitHub Actions workflow run:**
1. Navigate to Actions → Latest workflow run
2. Check job: "security-scan"
3. Verify vulnerability summary appears in Summary tab
4. Check GitHub Security → Code scanning alerts
5. Verify SARIF reports uploaded (backend-image, bot-image categories)

**Expected output in Summary:**
- 🔒 Security Scan: Backend
- 🔒 Security Scan: Bot
- Tables with CRITICAL,HIGH vulnerabilities (if any)

---

## Risk Assessment

### Breaking Changes
❌ **None** - All changes are backward compatible:
- OCI labels: metadata only, doesn't affect runtime
- Trivy scanning: same reports, additional summary
- Build args: new args don't break existing Dockerfiles

### Failure Scenarios

**Scenario 1:** Build date generation fails
- **Impact:** Minimal - BUILD_DATE will be empty string
- **Mitigation:** Step has no error handling, but empty label is valid

**Scenario 2:** Trivy summary generation fails
- **Impact:** None - `continue-on-error: true`
- **Mitigation:** SARIF reports still uploaded

**Scenario 3:** Docker pull fails in Trivy summary step
- **Impact:** None - `|| true` ensures success
- **Mitigation:** Summary step optional, main scan succeeds

---

## Next Steps: Этап 3 (Optional)

### Frontend Asset Optimization

**Goal:** Reduce frontend bundle size via Vite optimization
**Expected impact:** -5-15 MB от frontend assets
**Risk:** Low (Vite already does tree shaking by default)

**Tasks:**
1. Review existing `vite.config.ts`
2. Add/verify terser minification with `drop_console: true`
3. Enable manual chunks for vendor code (htmx, choices, echarts)
4. Test bundle size before/after

**Files to modify:**
- `vite.config.ts` (or create if missing)
- Rebuild with `npm run build:prod`
- Measure: `ls -lh frontend/web/static/js/dist/`

---

## Rollback Plan

Если Этап 2 вызовет проблемы:

```bash
# Step 1: Revert changes
git revert <commit-hash-stage2>
git push origin test

# Step 2: Re-trigger CI/CD
# GitHub Actions пересоберет образы без OCI labels

# Step 3: Deploy reverted version
ssh budget-test
cd /opt/budget
./deploy.sh
```

**Recovery time:** 5-10 минут

---

## Checklist для CI/CD Testing

После merge в test branch:

- [ ] Backend образ содержит OCI labels
- [ ] Bot образ содержит OCI labels
- [ ] Build date генерируется корректно
- [ ] GIT_COMMIT передается как build arg
- [ ] Trivy сканирует CRITICAL,HIGH,MEDIUM
- [ ] Vulnerability summary появляется в Actions Summary
- [ ] SARIF reports загружаются в GitHub Security
- [ ] Build не падает на vulnerabilities (exit-code: 0)
- [ ] Образы работают корректно (health checks pass)

---

## References

- **OCI Image Spec:** https://github.com/opencontainers/image-spec/blob/main/annotations.md
- **Trivy Documentation:** https://aquasecurity.github.io/trivy/
- **GitHub Actions Summary:** https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary
- **Plan:** `docker-optimization-plan.md` (Этап 2)
- **Stage 1 Summary:** `docker-optimization-stage1-summary.md`
