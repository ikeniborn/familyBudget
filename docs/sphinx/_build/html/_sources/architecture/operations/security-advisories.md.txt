# Security Advisories - Family Budget

**Last Updated**: 2026-02-03
**Status**: Active Monitoring
**Next Review**: 2026-03-03 (Weekly)

## Overview

This document tracks known security vulnerabilities in Family Budget dependencies, their risk assessment, and mitigation strategies.

---

## Active Security Exceptions

All exceptions are tracked in `.trivyignore` with detailed risk assessment.

### Critical Severity

#### 1. CVE-2026-24515: libexpat null pointer dereference

**Package:** `libexpat1` v2.5.0-1+deb12u2
**Severity:** CRITICAL
**Status:** ❌ No fix available (pending Debian security update)
**Published:** 2026-01-XX
**CVSS Score:** TBD

**Vulnerability:**
- Null pointer dereference in libexpat XML parsing library
- Potential for Denial of Service (DoS)

**Impact on Family Budget:**
- **Risk Level:** MEDIUM
- **Affected Components:** XML parsing operations (minimal usage)
- **Exploitability:** Requires malicious XML input

**Mitigation:**
- ✅ XML parsing usage minimized in application
- ✅ Input validation on all user-provided data
- ✅ No direct XML file uploads supported

**Monitoring:**
- Check Debian security tracker weekly: https://security-tracker.debian.org/tracker/CVE-2026-24515
- Alert on XML parsing errors in application logs

**Next Review:** 2026-03-03

---

#### 2. CVE-2025-13836: cpython excessive read buffering DoS

**Package:** Python 3.11 stdlib (libpython3.11-minimal, libpython3.11-stdlib, python3.11-minimal) v3.11.2-6+deb12u6
**Severity:** CRITICAL
**Status:** ❌ No fix available (pending Debian security update)
**Published:** 2025-12-XX
**CVSS Score:** TBD

**Vulnerability:**
- Excessive read buffering in `http.client` module
- Memory exhaustion leading to Denial of Service

**Impact on Family Budget:**
- **Risk Level:** HIGH ⚠️
- **Affected Components:** FastAPI HTTP server (uvicorn uses http.client)
- **Exploitability:** HIGH - attackers can send crafted HTTP requests

**Mitigation:**
- ✅ **Rate limiting** via SlowAPI (100 req/min per IP)
- ✅ **Nginx connection limits:**
  - `client_body_timeout 30s`
  - `client_max_body_size 50M`
  - `keepalive_timeout 65s`
- ✅ **Memory monitoring:**
  - psutil alerts for memory usage > 80%
  - Docker container memory limit: 2 GB
- ✅ **WAF rules** (Cloudflare) for anomalous traffic patterns

**Monitoring:**
- Check Debian security tracker **WEEKLY**: https://security-tracker.debian.org/tracker/CVE-2025-13836
- Monitor memory usage spikes in Grafana/Prometheus
- Alert on HTTP 5xx errors increase

**Action Plan:**
1. **Immediate:** Deploy rate limiting updates (DONE)
2. **Short-term:** Upgrade Python 3.11 when Debian releases DSA
3. **Long-term:** Consider Python 3.12+ migration (Q2 2026)

**Next Review:** 2026-03-03 (WEEKLY)

---

### High Severity

#### 3. CVE-2025-15366: cpython IMAP command injection

**Package:** Python 3.11 stdlib
**Severity:** HIGH
**Status:** ❌ No fix available
**Published:** 2025-12-XX

**Vulnerability:**
- Command injection in `imaplib` module

**Impact on Family Budget:**
- **Risk Level:** LOW ✅
- **Affected Components:** NONE (imaplib not used)
- **Exploitability:** N/A

**Mitigation:**
- ✅ Application does NOT use IMAP functionality
- ✅ `imaplib` module never imported

**Next Review:** 2026-04-03 (Quarterly)

---

#### 4. CVE-2025-15367: cpython POP3 command injection

**Package:** Python 3.11 stdlib
**Severity:** HIGH
**Status:** ❌ No fix available
**Published:** 2025-12-XX

**Vulnerability:**
- Command injection in `poplib` module

**Impact on Family Budget:**
- **Risk Level:** LOW ✅
- **Affected Components:** NONE (poplib not used)
- **Exploitability:** N/A

**Mitigation:**
- ✅ Application does NOT use POP3 functionality
- ✅ `poplib` module never imported

**Next Review:** 2026-04-03 (Quarterly)

---

#### 5. CVE-2025-8194: cpython infinite loop in tarfile parsing

**Package:** Python 3.11 stdlib
**Severity:** HIGH
**Status:** ❌ No fix available
**Published:** 2025-08-XX

**Vulnerability:**
- Infinite loop when parsing malicious tarfile
- Leads to CPU exhaustion (DoS)

**Impact on Family Budget:**
- **Risk Level:** LOW ✅
- **Affected Components:** File upload system (restricted file types)
- **Exploitability:** LOW (tar files not accepted)

**Mitigation:**
- ✅ **File type whitelist:** Only `.xlsx`, `.csv`, `.json` uploads accepted
- ✅ **No tar support:** `tarfile` module unused in upload endpoints
- ✅ **File size limit:** 50 MB max upload size
- ✅ **MIME type validation:** Enforced in `backend/app/api/v1/endpoints/import_endpoints.py`

**Code Reference:**
```python
# backend/app/api/v1/endpoints/import_endpoints.py:25
ALLOWED_EXTENSIONS = {".xlsx", ".csv", ".json"}
```

**Next Review:** 2026-04-03 (Quarterly)

---

#### 6. CVE-2026-1299: cpython email header injection

**Package:** Python 3.11 stdlib (email module)
**Severity:** HIGH
**Status:** ❌ No fix available
**Published:** 2026-01-XX

**Vulnerability:**
- Email header injection via unquoted newlines
- Allows spam/phishing through manipulated headers

**Impact on Family Budget:**
- **Risk Level:** MEDIUM ⚠️
- **Affected Components:** Email notifications (limited usage)
- **Exploitability:** MEDIUM (requires user input in email generation)

**Mitigation:**
- ✅ **Email sending via Telegram Bot API** (primary notification channel)
- ✅ **stdlib email module NOT used** for sending (python-telegram-bot used instead)
- ✅ **Input sanitization:** FastAPI Pydantic validation on all user inputs
- ✅ **No direct header control:** Users cannot set custom email headers

**Monitoring:**
- Check Debian security tracker weekly: https://security-tracker.debian.org/tracker/CVE-2026-1299
- Monitor for suspicious email patterns (if email functionality added)

**Next Review:** 2026-03-03 (WEEKLY)

---

## Legacy Vulnerabilities (Pre-2026-02-03)

### CVE-2024-23342: python-ecdsa timing attack
- **Status:** No fix available
- **Risk:** LOW (timing attacks require local access)
- **Next Review:** 2026-05-02 (Quarterly)

### CVE-2023-45853: zlib integer overflow
- **Status:** WILL_NOT_FIX (Debian)
- **Risk:** LOW (vulnerable functions not used)
- **Next Review:** 2026-05-02 (Quarterly)

### CVE-2023-2953: openldap null pointer dereference
- **Status:** No fix available
- **Risk:** LOW (LDAP not used)
- **Next Review:** 2026-05-02 (Quarterly)

### CVE-2025-7458: SQLite integer overflow
- **Status:** Pending fix
- **Risk:** LOW (PostgreSQL primary DB, SQLite transitive only)
- **Next Review:** 2026-03-02 (Monthly)

### CVE-2026-0861: glibc integer overflow
- **Status:** Pending fix (recent CVE)
- **Risk:** MEDIUM
- **Next Review:** 2026-03-02 (Monthly)

### CVE-2026-24882: GnuPG stack buffer overflow
- **Status:** Pending fix (recent CVE)
- **Risk:** LOW (GPG TPM daemon not used)
- **Next Review:** 2026-03-02 (Monthly)

---

## Review Schedule

### Weekly Reviews (Every Monday)
**Focus:** HIGH/CRITICAL vulnerabilities with active exploitation risk

**CVEs to check:**
- CVE-2025-13836 (http.client DoS) - **TOP PRIORITY**
- CVE-2026-24515 (libexpat)
- CVE-2026-1299 (email injection)

**Actions:**
1. Check Debian security tracker for DSA (Debian Security Advisory)
2. Review application logs for anomalies:
   - Memory usage spikes
   - HTTP 5xx errors
   - XML parsing errors
3. Verify rate limiting effectiveness (SlowAPI logs)

### Monthly Reviews (First Monday of Month)
**Focus:** Recent CVEs awaiting patches

**CVEs to check:**
- CVE-2025-7458 (SQLite)
- CVE-2026-0861 (glibc)
- CVE-2026-24882 (GnuPG)

**Actions:**
1. Check for Debian security updates
2. Review application dependency versions
3. Plan upgrade timeline if patches available

### Quarterly Reviews (First Monday of Quarter)
**Focus:** Low-risk CVEs and dependency alternatives

**CVEs to check:**
- CVE-2024-23342 (ecdsa)
- CVE-2023-45853 (zlib)
- CVE-2023-2953 (openldap)
- CVE-2025-15366 (IMAP)
- CVE-2025-15367 (POP3)
- CVE-2025-8194 (tarfile)

**Actions:**
1. Re-assess risk levels based on code changes
2. Consider dependency alternatives:
   - python-jose alternatives (if ecdsa not fixed)
   - Python 3.12+ migration feasibility
3. Update security documentation

---

## Incident Response Plan

### If Critical Vulnerability Exploited

**1. Detection:**
- Monitoring alerts (Grafana/Prometheus)
- Increased HTTP 5xx errors
- Memory/CPU exhaustion
- User reports

**2. Immediate Actions:**
1. Enable aggressive rate limiting (10 req/min)
2. Block suspicious IP addresses (Cloudflare WAF)
3. Scale up resources if DoS attack
4. Notify team via Telegram alerts

**3. Investigation:**
1. Analyze application logs (`/opt/budget/logs/app.log`)
2. Review Nginx access logs for attack patterns
3. Check Docker container metrics (memory/CPU)
4. Identify attack vector

**4. Mitigation:**
1. Apply temporary WAF rules
2. Deploy hotfix if code change needed
3. Upgrade packages if emergency patch available
4. Document incident in this file

**5. Post-Incident:**
1. Update `.trivyignore` with new learnings
2. Improve monitoring/alerting rules
3. Schedule retrospective meeting
4. Update security documentation

---

## Upgrade Strategy

### Short-Term (2-4 weeks)
**Goal:** Apply security patches when available

**Actions:**
1. Monitor Debian security tracker daily for DSA
2. Test patches in development environment
3. Deploy to test environment first
4. Roll out to production after 48h soak time

**Deployment Process:**
```bash
# When Debian releases security update
docker build --no-cache -f backend/Dockerfile .
docker tag <image> ghcr.io/ikeniborn/familybudget-backend:<new-version>
docker push ghcr.io/ikeniborn/familybudget-backend:<new-version>

# Update VERSION file and deploy via CI/CD
```

### Medium-Term (1-3 months)
**Goal:** Reduce attack surface

**Potential Actions:**
1. **Python 3.12 migration:**
   - Newer Python versions often get patches faster
   - Better performance and security features
   - Requires compatibility testing

2. **Base image alternatives:**
   - Consider `python:3.11-alpine` (different package ecosystem)
   - Evaluate `gcr.io/distroless/python3-debian12` updates
   - Trade-offs: size vs security updates frequency

3. **Dependency audit:**
   - Remove unused dependencies
   - Evaluate alternative libraries for high-risk packages

### Long-Term (3-6 months)
**Goal:** Architectural improvements

**Potential Actions:**
1. **Container security hardening:**
   - Read-only root filesystem
   - Capability dropping
   - Seccomp profiles

2. **WAF enhancement:**
   - Custom rules for detected attack patterns
   - ML-based anomaly detection

3. **Zero-trust architecture:**
   - Service mesh (Istio/Linkerd)
   - mTLS between services
   - Network policies

---

## Compliance & Reporting

### Internal Stakeholders
- **Team notifications:** Via Telegram bot alerts
- **Monthly security report:** First Monday of month
- **Quarterly review:** Security metrics dashboard

### External Compliance
- **GDPR:** Vulnerability management part of security measures
- **PCI-DSS:** Not applicable (no credit card processing)
- **ISO 27001:** Aligns with vulnerability management requirements

---

## Related Documentation

- **Trivy Exceptions:** `.trivyignore` (root directory)
- **Docker Security:** [docker.md](../core/docker.md)
- **Deployment:** [ci-cd-build-deploy.md](ci-cd-build-deploy.md)
- **Disaster Recovery:** [disaster-recovery.md](disaster-recovery.md)

---

## Contact & Escalation

**Security Contact:** ikeniborn (GitHub)
**Escalation Path:**
1. Application alerts → Telegram notifications
2. Critical issues → Immediate team notification
3. Zero-day exploits → Emergency deployment procedure

**External Resources:**
- Debian Security Tracker: https://security-tracker.debian.org/
- Python Security: https://www.python.org/news/security/
- NVD Database: https://nvd.nist.gov/

---

**Maintainer:** Family Budget Team
**Version:** 1.0
**Last Updated:** 2026-02-03
