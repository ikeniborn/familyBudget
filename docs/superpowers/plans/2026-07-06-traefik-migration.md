---
review:
  plan_hash: 4b3da6269eddd0fb
  last_run: 2026-07-06
  phases:
    structure: { status: passed }
    coverage: { status: passed }
    dependencies: { status: passed }
    verifiability: { status: passed }
    consistency: { status: passed }
  findings: []
chain:
  intent: null
  spec: docs/superpowers/specs/2026-06-24-traefik-migration-design.md
---

# Traefik Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the nginx reverse proxy with Traefik v3.3, native ACME HTTP-01 certificates, file-provider routing, and private Prometheus metrics readiness.

**Architecture:** Traefik becomes the only public HTTP/HTTPS entry point and proxies every route to the existing `backend:8000` service. Static Traefik configuration lives in `traefik/traefik.yml` as a runtime-rendered template for the ACME email; dynamic routers and middlewares live in `traefik/conf.d/app.yml.tmpl` and are rendered from `DOMAIN` into a writable runtime directory at container start. Deployment remains registry-first: the server pulls backend/bot/redis/postgresql images and runs the pinned official `traefik:v3.3` image without building a proxy image.

**Tech Stack:** Docker Compose, Traefik v3.3, Bash deployment scripts, GitHub Actions, FastAPI backend, Redis WebSocket fan-out, PostgreSQL.

---

## Source Requirements

| ID | Spec source | Plan coverage |
|----|-------------|---------------|
| R1 | Replace `nginx` with `traefik:v3.3` in `docker-compose.yml` | Tasks 1, 2 |
| R2 | Use native Traefik ACME HTTP challenge on `:80` with `acme.json` | Tasks 1, 2, 6 |
| R3 | Use file-provider routes in `conf.d/*`, no Docker socket | Tasks 1, 2 |
| R4 | Render `DOMAIN` into file-provider config at startup | Task 1 |
| R5 | Enable private Prometheus metrics entryPoint `:8082` on external `monitoring` network | Tasks 1, 2, 6 |
| R6 | Update deploy flow from nginx/certbot to Traefik health checks | Tasks 3, 6 |
| R7 | Remove `familybudget-nginx` image build and IMAGE_VERSIONS tracking | Task 4 |
| R8 | Keep Traefik dashboard disabled | Task 1 |
| R9 | Preserve WebSocket, `/webapp/`, security headers, upload limit, gzip, rollback readiness | Tasks 1, 2, 3, 6 |

## File Structure

| Path | Action | Responsibility |
|------|--------|----------------|
| `traefik/traefik.yml` | Create | Static Traefik config template for entryPoints, rendered ACME email, file provider, metrics, ping health endpoint, logging |
| `traefik/conf.d/app.yml.tmpl` | Create | Dynamic routers, services, middlewares, cache headers, WebSocket transport |
| `traefik/docker-entrypoint.sh` | Create | Validate `DOMAIN` and required env, render static and dynamic config into runtime paths, initialize `/data/acme.json`, start Traefik |
| `docker-compose.yml` | Modify | Replace `nginx` service with `traefik`, add `traefik_acme`, add external `monitoring` network |
| `deploy.sh` | Modify | Rename user-facing full-profile proxy text and stop calling nginx/certbot deploy assumptions |
| `scripts/lib/services.sh` | Modify | Rename selective restart flags and service arrays from nginx to Traefik |
| `scripts/lib/sync.sh` | Modify | Detect `traefik/` changes instead of `nginx/` changes |
| `scripts/lib/docker.sh` | Modify | Rename smart-cleanup proxy container decisions from nginx to Traefik |
| `scripts/lib/registry.sh` | Modify | Remove active nginx registry deploy handling and compare official Traefik as compose-managed service |
| `scripts/lib/status.sh` | Modify | Print HTTP/HTTPS URLs when `traefik` is running |
| `scripts/lib/network.sh` | Modify | Remove certbot-specific port conflict recommendation for nginx/certbot |
| `scripts/lib/firewall.sh` | Modify | Keep ports `80` and `443` open for Traefik HTTP-01 and HTTPS traffic |
| `scripts/lib/ssl.sh` | Modify | Keep legacy functions inert for rollback docs; deploy path must not call standalone certbot |
| `.github/workflows/build-and-push.yml` | Modify | Remove nginx image outputs, metadata, build, IMAGE_VERSIONS updates, registry summary usage |
| `IMAGE_VERSIONS.json` | Modify | Delete the `nginx` image entry |
| `nginx/` | Keep for rollback in this change | Existing image/config stays in git for fast rollback until prod Traefik is confirmed |
| Task log | Modify through `check-chain` | Mark plan stage complete after `/check-chain plan` |
| iwiki domain `familybudget` | Update after implementation | Architecture docs reflect Traefik after behavior changes are implemented |

---

### Task 1: Add Traefik Configuration Files

**Files:**
- Create: `traefik/traefik.yml`
- Create: `traefik/conf.d/app.yml.tmpl`
- Create: `traefik/docker-entrypoint.sh`
- Verify: `docker run --rm traefik:v3.3 version`

- [ ] **Step 1: Create static Traefik config**

Write `traefik/traefik.yml`:

```yaml
api:
  dashboard: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"
  metrics:
    address: ":8082"
  internal:
    address: ":8080"

ping:
  entryPoint: internal

certificatesResolvers:
  letsencrypt:
    acme:
      email: "{{LETSENCRYPT_EMAIL}}"
      storage: /data/acme.json
      httpChallenge:
        entryPoint: web

providers:
  file:
    directory: /rendered-conf.d
    watch: true

metrics:
  prometheus:
    entryPoint: metrics

log:
  level: INFO
```

Run:

```bash
test -f traefik/traefik.yml
grep -q 'dashboard: false' traefik/traefik.yml
grep -q 'address: ":8082"' traefik/traefik.yml
grep -q 'email: "{{LETSENCRYPT_EMAIL}}"' traefik/traefik.yml
grep -q 'directory: /rendered-conf.d' traefik/traefik.yml
```

Expected: all commands exit `0`.

- [ ] **Step 2: Create dynamic route template**

Write `traefik/conf.d/app.yml.tmpl`:

```yaml
http:
  routers:
    app-ws:
      rule: "Host(`{{DOMAIN}}`) && Path(`/api/v1/budget/ws`)"
      entryPoints:
        - websecure
      service: app-ws
      middlewares:
        - security-headers
        - compression
      tls:
        certResolver: letsencrypt
      priority: 100

    webapp:
      rule: "Host(`{{DOMAIN}}`) && PathPrefix(`/webapp/`)"
      entryPoints:
        - websecure
      service: app
      middlewares:
        - telegram-webapp-headers
        - request-body-limit
        - compression
      tls:
        certResolver: letsencrypt
      priority: 90

    shared-static:
      rule: "Host(`{{DOMAIN}}`) && PathPrefix(`/shared/`)"
      entryPoints:
        - websecure
      service: app
      middlewares:
        - security-headers
        - shared-cache
        - compression
      tls:
        certResolver: letsencrypt
      priority: 80

    app:
      rule: "Host(`{{DOMAIN}}`)"
      entryPoints:
        - websecure
      service: app
      middlewares:
        - security-headers
        - request-body-limit
        - compression
      tls:
        certResolver: letsencrypt
      priority: 1

  services:
    app:
      loadBalancer:
        passHostHeader: true
        serversTransport: app-transport
        servers:
          - url: "http://backend:8000"

    app-ws:
      loadBalancer:
        passHostHeader: true
        serversTransport: websocket-transport
        servers:
          - url: "http://backend:8000"

  serversTransports:
    app-transport:
      forwardingTimeouts:
        dialTimeout: "75s"
        responseHeaderTimeout: "300s"
        idleConnTimeout: "300s"

    websocket-transport:
      forwardingTimeouts:
        dialTimeout: "75s"
        responseHeaderTimeout: "86400s"
        idleConnTimeout: "86400s"

  middlewares:
    security-headers:
      headers:
        frameDeny: false
        customFrameOptionsValue: "SAMEORIGIN"
        contentTypeNosniff: true
        browserXssFilter: true

    telegram-webapp-headers:
      headers:
        contentTypeNosniff: true
        browserXssFilter: true
        customResponseHeaders:
          X-Frame-Options: ""
          Content-Security-Policy: "frame-ancestors https://web.telegram.org https://*.telegram.org"
          Access-Control-Allow-Origin: "https://web.telegram.org"
          Access-Control-Allow-Methods: "GET, POST, OPTIONS"
          Access-Control-Allow-Headers: "Content-Type, X-Requested-With"
          Access-Control-Allow-Credentials: "true"
          Cache-Control: "public, must-revalidate"

    shared-cache:
      headers:
        customResponseHeaders:
          Cache-Control: "public, max-age=604800, must-revalidate"

    request-body-limit:
      buffering:
        maxRequestBodyBytes: 20971520

    compression:
      compress: {}
```

Run:

```bash
grep -q 'Path(`/api/v1/budget/ws`)' traefik/conf.d/app.yml.tmpl
grep -q 'responseHeaderTimeout: "86400s"' traefik/conf.d/app.yml.tmpl
grep -q 'maxRequestBodyBytes: 20971520' traefik/conf.d/app.yml.tmpl
grep -q 'frame-ancestors https://web.telegram.org' traefik/conf.d/app.yml.tmpl
```

Expected: all commands exit `0`.

- [ ] **Step 3: Create Traefik entrypoint**

Write `traefik/docker-entrypoint.sh`:

```sh
#!/bin/sh
set -eu

validate_hostname() {
    host=$1
    [ -n "$host" ] || return 1
    [ ${#host} -le 253 ] || return 1
    case "$host" in
        *[!A-Za-z0-9.-]* | .* | *. | *..*)
            return 1
            ;;
    esac

    old_ifs=$IFS
    IFS=.
    set -- $host
    IFS=$old_ifs

    for label do
        [ -n "$label" ] || return 1
        [ ${#label} -le 63 ] || return 1
        case "$label" in
            -* | *-)
                return 1
                ;;
        esac
    done

    return 0
}

if [ -z "${DOMAIN:-}" ]; then
    echo "ERROR: DOMAIN environment variable is not set" >&2
    exit 1
fi

if ! validate_hostname "$DOMAIN"; then
    echo "ERROR: DOMAIN must be a valid hostname" >&2
    exit 1
fi

if [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
    echo "ERROR: LETSENCRYPT_EMAIL environment variable is not set" >&2
    exit 1
fi

case "$LETSENCRYPT_EMAIL" in
    *@*@* | @* | *@ | '')
        echo "ERROR: LETSENCRYPT_EMAIL must be a valid email address" >&2
        exit 1
        ;;
esac

local_part=${LETSENCRYPT_EMAIL%@*}
domain_part=${LETSENCRYPT_EMAIL#*@}

case "$local_part" in
    *[!A-Za-z0-9._%+-]* | '')
        echo "ERROR: LETSENCRYPT_EMAIL must be a valid email address" >&2
        exit 1
        ;;
esac

if ! validate_hostname "$domain_part"; then
    echo "ERROR: LETSENCRYPT_EMAIL must be a valid email address" >&2
    exit 1
fi

mkdir -p /rendered-conf.d /data
touch /data/acme.json
chmod 600 /data/acme.json

sed "s|{{LETSENCRYPT_EMAIL}}|$LETSENCRYPT_EMAIL|g" /traefik.yml > /tmp/traefik.yml

for template in /conf.d/*.tmpl; do
    [ -f "$template" ] || continue
    filename="${template##*/}"
    target="/rendered-conf.d/${filename%.tmpl}"
    sed "s|{{DOMAIN}}|$DOMAIN|g" "$template" > "$target"
done

exec traefik --configFile=/tmp/traefik.yml
```

Run:

```bash
chmod +x traefik/docker-entrypoint.sh
sh -n traefik/docker-entrypoint.sh
grep -q '/tmp/traefik.yml' traefik/docker-entrypoint.sh
grep -q '/rendered-conf.d' traefik/docker-entrypoint.sh
grep -q 'validate_hostname' traefik/docker-entrypoint.sh
grep -q 'local_part=' traefik/docker-entrypoint.sh
```

Expected: `sh -n` exits `0`.

- [ ] **Step 4: Validate Traefik binary availability**

Run:

```bash
docker run --rm traefik:v3.3 version
```

Expected: output contains `Version:      3.3`.

- [ ] **Step 5: Commit config files**

Run:

```bash
git add traefik/traefik.yml traefik/conf.d/app.yml.tmpl traefik/docker-entrypoint.sh
git commit -m "feat: add Traefik reverse proxy config"
```

Expected: commit succeeds.

---

### Task 2: Replace nginx Service in Docker Compose

**Files:**
- Modify: `docker-compose.yml`
- Verify: `docker compose --profile full config`

- [ ] **Step 1: Replace the `nginx` service with `traefik`**

In `docker-compose.yml`, replace the existing `nginx:` service block with:

```yaml
  # Traefik Reverse Proxy (Optional)
  traefik:
    image: traefik:v3.3
    container_name: familybudget-traefik
    restart: always
    depends_on:
      backend:
        condition: service_healthy
    environment:
      - DOMAIN=${DOMAIN}
      - LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL is required}
    volumes:
      - ./traefik/traefik.yml:/traefik.yml:ro
      - ./traefik/conf.d:/conf.d:ro
      - ./traefik/docker-entrypoint.sh:/docker-entrypoint.sh:ro
      - traefik_acme:/data
      - ./logs/traefik:/var/log/traefik
    entrypoint: ["/docker-entrypoint.sh"]
    ports:
      - "${HTTP_PORT:-80}:80"
      - "${HTTPS_PORT:-443}:443"
    networks:
      - familybudget
      - monitoring
    profiles:
      - full
    healthcheck:
      test: ["CMD", "traefik", "healthcheck", "--ping"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          cpus: '${TRAEFIK_CPU_LIMIT:-0.05}'
          memory: 256M
        reservations:
          cpus: '${TRAEFIK_CPU_RESERVATION:-0.01}'
          memory: 64M
```

Run:

```bash
grep -n '^  traefik:' docker-compose.yml
! grep -n '^  nginx:' docker-compose.yml
```

Expected: first command prints the Traefik service line; second command prints nothing and exits `0`.

- [ ] **Step 2: Replace the nginx volume with Traefik ACME storage**

In `docker-compose.yml`, replace:

```yaml
  nginx_cache:
    driver: local
```

with:

```yaml
  traefik_acme:
    driver: local
```

Run:

```bash
grep -n '^  traefik_acme:' docker-compose.yml
! grep -n '^  nginx_cache:' docker-compose.yml
```

Expected: first command prints the Traefik volume line; second command prints nothing and exits `0`.

- [ ] **Step 3: Add the external monitoring network**

In `docker-compose.yml`, extend `networks:` with:

```yaml
  monitoring:
    external: true
```

Run:

```bash
docker compose --profile full config >/tmp/familybudget-compose.yml
grep -q 'familybudget-traefik' /tmp/familybudget-compose.yml
grep -q 'monitoring' /tmp/familybudget-compose.yml
grep -q 'traefik_acme' /tmp/familybudget-compose.yml
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit compose change**

Run:

```bash
git add docker-compose.yml
git commit -m "feat: replace nginx compose service with Traefik"
```

Expected: commit succeeds.

---

### Task 3: Update Deployment Scripts for Traefik

**Files:**
- Modify: `deploy.sh`
- Modify: `scripts/lib/services.sh`
- Modify: `scripts/lib/sync.sh`
- Modify: `scripts/lib/docker.sh`
- Modify: `scripts/lib/registry.sh`
- Modify: `scripts/lib/status.sh`
- Modify: `scripts/lib/network.sh`
- Modify: `scripts/lib/firewall.sh`
- Modify: `scripts/lib/ssl.sh`
- Verify: `bash -n deploy.sh scripts/lib/*.sh`

- [ ] **Step 1: Rename full-profile proxy wording in `deploy.sh`**

In `deploy.sh`, replace user-facing comments and messages that describe full profile as `nginx + bot + certbot` with `traefik + bot`. Replace port-check wording from `nginx` to `Traefik`.

Run:

```bash
grep -n 'full deployment (+ traefik + bot)' deploy.sh
grep -n 'Checking if ports are available for Traefik' deploy.sh
! grep -n 'full deployment (+ nginx + bot + certbot)' deploy.sh
```

Expected: first two commands print matching lines; third command prints nothing and exits `0`.

- [ ] **Step 2: Ensure the external monitoring network exists before full-profile starts**

Add a small helper in `deploy.sh` or `scripts/lib/network.sh`:

```bash
ensure_monitoring_network() {
    if ! docker network inspect monitoring >/dev/null 2>&1; then
        info "Creating external Docker network: monitoring"
        docker network create monitoring >> "$LOG_FILE" 2>&1
        success "External Docker network created: monitoring"
    else
        info "External Docker network already exists: monitoring"
    fi
}
```

Call it after Docker is confirmed running and before any `docker compose --profile full up` path when `DEPLOYMENT_PROFILE=full`.

Run:

```bash
grep -n 'ensure_monitoring_network' deploy.sh scripts/lib/network.sh
grep -n 'docker network create monitoring' deploy.sh scripts/lib/network.sh
```

Expected: both commands print matching lines.

- [ ] **Step 3: Rename selective restart flags in `scripts/lib/services.sh`**

In `scripts/lib/services.sh`, replace `NEEDS_NGINX_RECREATE` with `NEEDS_TRAEFIK_RECREATE`, service `nginx` with `traefik`, and message labels `Nginx` with `Traefik` inside `start_application_services()`.

Run:

```bash
grep -n 'NEEDS_TRAEFIK_RECREATE' scripts/lib/services.sh
grep -n 'services_to_recreate+=("traefik")' scripts/lib/services.sh
grep -n 'Traefik recreate' scripts/lib/services.sh
! grep -n 'NEEDS_NGINX_RECREATE' scripts/lib/services.sh
```

Expected: first three commands print matching lines; fourth command prints nothing and exits `0`.

- [ ] **Step 4: Update sync-change detection**

In `scripts/lib/sync.sh`, replace nginx-specific change categories with Traefik equivalents:

```bash
NEEDS_TRAEFIK_RECREATE=true
```

and classify changes under `traefik/traefik.yml`, `traefik/conf.d/`, and `traefik/docker-entrypoint.sh` as Traefik config changes.

Run:

```bash
grep -n 'NEEDS_TRAEFIK_RECREATE' scripts/lib/sync.sh
grep -n 'traefik/' scripts/lib/sync.sh
! grep -n 'NEEDS_NGINX_RECREATE' scripts/lib/sync.sh
```

Expected: first two commands print matching lines; third command prints nothing and exits `0`.

- [ ] **Step 5: Remove active nginx registry handling**

In `scripts/lib/registry.sh`, remove `nginx` from active registry validation, pull, env generation, and running-vs-pulled comparison. Traefik uses the official `traefik:v3.3` image from `docker-compose.yml`; the deploy helper should set `NEEDS_TRAEFIK_RECREATE=true` when `familybudget-traefik` is missing, unhealthy, or not using `traefik:v3.3`.

Run:

```bash
! grep -n '"nginx"' scripts/lib/registry.sh
! grep -n 'NGINX_VERSION' scripts/lib/registry.sh
grep -n 'familybudget-traefik' scripts/lib/registry.sh
grep -n 'traefik:v3.3' scripts/lib/registry.sh
```

Expected: first two commands print nothing and exit `0`; last two commands print matching lines.

- [ ] **Step 6: Update smart cleanup proxy references**

In `scripts/lib/docker.sh`, rename proxy cleanup variables and containers from nginx to Traefik:

```bash
needs_traefik_restart=false
count_traefik_config=0
familybudget-traefik
```

Traefik config change patterns should include `traefik/traefik.yml`, `traefik/conf.d/*.tmpl`, and `traefik/docker-entrypoint.sh`.

Run:

```bash
grep -n 'familybudget-traefik' scripts/lib/docker.sh
grep -n 'traefik/' scripts/lib/docker.sh
! grep -n 'familybudget-nginx' scripts/lib/docker.sh
```

Expected: first two commands print matching lines; third command prints nothing and exits `0`.

- [ ] **Step 7: Update status output**

In `scripts/lib/status.sh`, replace the nginx URL condition:

```bash
if compose_cmd ps -q nginx >/dev/null 2>&1; then
```

with:

```bash
if compose_cmd ps -q traefik >/dev/null 2>&1; then
```

Run:

```bash
grep -n 'compose_cmd ps -q traefik' scripts/lib/status.sh
! grep -n 'compose_cmd ps -q nginx' scripts/lib/status.sh
```

Expected: first command prints matching line; second command prints nothing and exits `0`.

- [ ] **Step 8: Remove certbot-specific port handling from the active deploy path**

In `scripts/lib/network.sh`, keep generic port conflict detection, but replace the certbot branch with a warning that Traefik needs exclusive access to ports `80` and `443` for HTTP challenge traffic. The active port handler must not stop or disable `certbot.service` automatically.

Run:

```bash
grep -n 'Traefik needs exclusive access' scripts/lib/network.sh
! grep -n 'systemctl stop certbot' scripts/lib/network.sh
! grep -n 'containerized certbot' scripts/lib/network.sh
```

Expected: first command prints matching line; second and third commands print nothing and exit `0`. In non-interactive mode, certbot-specific conflicts must abort with instructions instead of stopping or disabling certbot.

- [ ] **Step 9: Keep ports 80 and 443 open for Traefik**

In `scripts/lib/firewall.sh`, change SSL firewall behavior: Traefik needs port `80` open for HTTP-01 challenge and HTTP-to-HTTPS redirect, and port `443` open for HTTPS. The script must not close port `80` as a certbot-only temporary port.

Run:

```bash
grep -n 'Port 80 (HTTP).*OPEN' scripts/lib/firewall.sh
grep -n 'Traefik HTTP-01' scripts/lib/firewall.sh
! grep -n 'opens only for certbot' scripts/lib/firewall.sh
```

Expected: first two commands print matching lines; third command prints nothing and exits `0`.

- [ ] **Step 10: Keep legacy SSL functions out of deploy execution**

In `deploy.sh`, ensure `setup_ssl_certificates` and `verify_ssl` are not called from `main()`. The `scripts/lib/ssl.sh` file can remain for rollback tooling, but no active deploy step should invoke host certbot.

Run:

```bash
! awk '/main\\(\\)/,/^}/ {print}' deploy.sh | grep -n 'setup_ssl_certificates'
! awk '/main\\(\\)/,/^}/ {print}' deploy.sh | grep -n 'verify_ssl'
```

Expected: both commands print nothing and exit `0`. If `scripts/lib/ssl.sh` remains in the repository for rollback, it must not be sourced by `deploy.sh` during Traefik deployments, or its functions must be explicit no-ops for Traefik deployments.

- [ ] **Step 11: Keep sync-change evidence until analysis**

Ensure `sync_update` and other sync modes do not delete `SYNC_FILES_TEMP` before `analyze_sync_changes` runs. The deploy exit trap can remove `/tmp/sync_changed_files_*` after the analysis phase.

Run:

```bash
grep -n 'SYNC_FILES_TEMP' scripts/lib/sync.sh
! awk '/sync_update\\(\\)/,/^}/ {print}' scripts/lib/sync.sh | grep -n 'rm -f.*SYNC_FILES_TEMP'
```

Expected: first command prints matching lines; second command prints nothing and exits `0`.

- [ ] **Step 12: Recreate Traefik on relevant env changes**

Because `.env` is intentionally excluded from repository sync, add deploy-side conservative handling for full-profile Traefik env values. Changes or presence of `DOMAIN`, `HTTP_PORT`, `HTTPS_PORT`, or `LETSENCRYPT_EMAIL` must be able to force `NEEDS_TRAEFIK_RECREATE=true` so rendered config, ports, and ACME email are refreshed.

Run:

```bash
grep -n 'LETSENCRYPT_EMAIL' scripts/lib/sync.sh deploy.sh scripts/lib/registry.sh
grep -n 'NEEDS_TRAEFIK_RECREATE=true' scripts/lib/sync.sh deploy.sh scripts/lib/registry.sh
```

Expected: both commands print matching lines.

- [ ] **Step 13: Validate shell syntax**

Run:

```bash
bash -n deploy.sh scripts/lib/*.sh scripts/ci/*.sh
```

Expected: command exits `0`.

- [ ] **Step 14: Commit deployment script changes**

Run:

```bash
git add deploy.sh scripts/lib/services.sh scripts/lib/sync.sh scripts/lib/docker.sh scripts/lib/registry.sh scripts/lib/status.sh scripts/lib/network.sh scripts/lib/firewall.sh scripts/lib/ssl.sh
git commit -m "feat: update deploy scripts for Traefik"
```

Expected: commit succeeds.

---

### Task 4: Remove nginx Image Build and Version Tracking

**Files:**
- Modify: `.github/workflows/build-and-push.yml`
- Modify: `IMAGE_VERSIONS.json`
- Modify: `scripts/lib/registry.sh`
- Verify: `jq empty IMAGE_VERSIONS.json`

- [ ] **Step 1: Remove nginx from `IMAGE_VERSIONS.json`**

Delete the top-level `nginx` object from `IMAGE_VERSIONS.json`.

Run:

```bash
jq empty IMAGE_VERSIONS.json
! jq -e '.nginx' IMAGE_VERSIONS.json
```

Expected: first command exits `0`; second command prints `null` or exits non-zero.

- [ ] **Step 2: Remove nginx metadata and build steps from GitHub Actions**

In `.github/workflows/build-and-push.yml`, remove:

```yaml
nginx_built: ${{ steps.changes.outputs.nginx }}
```

and remove all steps named:

```text
Docker meta (nginx)
Build and push nginx
Update nginx version in IMAGE_VERSIONS.json
```

Also remove `nginx/**` from the workflow path filter and remove `familybudget-nginx` from GHCR cleanup and registry summary sections.

Run:

```bash
! grep -n 'familybudget-nginx' .github/workflows/build-and-push.yml
! grep -n 'meta-nginx' .github/workflows/build-and-push.yml
! grep -n 'nginx_built' .github/workflows/build-and-push.yml
```

Expected: all commands print nothing and exit `0`.

- [ ] **Step 3: Remove nginx env generation from registry helper**

In `scripts/lib/registry.sh`, remove `nginx` from the active services arrays and remove generation of `NGINX_VERSION`. Keep `NGINX_VERSION` only in the cleanup regex that strips stale generated variables from an existing deployed `.env`. The helper should still generate `BACKEND_VERSION`, `BOT_VERSION`, `REDIS_VERSION`, and `POSTGRESQL_VERSION`.

Run:

```bash
grep -n 'BACKEND_VERSION=' scripts/lib/registry.sh
grep -n 'POSTGRESQL_VERSION=' scripts/lib/registry.sh
grep -n 'NGINX_VERSION' scripts/lib/registry.sh | grep 'grep -v -E'
! grep -n '"nginx"' scripts/lib/registry.sh
```

Expected: first two commands print matching lines; third command prints only the stale-env cleanup regex line; fourth command prints nothing and exits `0`.

- [ ] **Step 4: Validate YAML and JSON syntax**

Run:

```bash
jq empty IMAGE_VERSIONS.json
python3 - <<'PY'
from pathlib import Path
text = Path('.github/workflows/build-and-push.yml').read_text()
for needle in ['familybudget-nginx', 'meta-nginx', 'Build and push nginx', 'nginx_built']:
    if needle in text:
        raise SystemExit(f'unexpected nginx workflow reference: {needle}')
print('workflow nginx references removed')
PY
```

Expected: `jq` exits `0`, Python prints `workflow nginx references removed`.

- [ ] **Step 5: Commit CI and registry changes**

Run:

```bash
git add .github/workflows/build-and-push.yml IMAGE_VERSIONS.json scripts/lib/registry.sh
git commit -m "ci: remove nginx image build"
```

Expected: commit succeeds.

---

### Task 5: Validate Local Configuration Without Deploying

**Files:**
- Verify: `docker-compose.yml`
- Verify: `traefik/`
- Verify: deployment scripts

- [ ] **Step 1: Render Compose config**

Run:

```bash
docker compose --profile full config >/tmp/familybudget-compose.yml
```

Expected: command exits `0`.

- [ ] **Step 2: Verify Traefik service shape**

Run:

```bash
grep -q 'container_name: familybudget-traefik' /tmp/familybudget-compose.yml
grep -q 'traefik:v3.3' /tmp/familybudget-compose.yml
grep -q 'traefik_acme' /tmp/familybudget-compose.yml
grep -q 'monitoring' /tmp/familybudget-compose.yml
! grep -q 'familybudget-nginx' /tmp/familybudget-compose.yml
```

Expected: all commands exit `0`.

- [ ] **Step 3: Render dynamic config from template**

Run:

```bash
mkdir -p /tmp/familybudget-traefik
DOMAIN=fbd.ikeniborn.ru sh -c 'sed "s|{{DOMAIN}}|$DOMAIN|g" traefik/conf.d/app.yml.tmpl > /tmp/familybudget-traefik/app.yml'
grep -q 'Host(`fbd.ikeniborn.ru`)' /tmp/familybudget-traefik/app.yml
! grep -q '{{DOMAIN}}' /tmp/familybudget-traefik/app.yml
```

Expected: all commands exit `0`.

- [ ] **Step 4: Validate Traefik config in container**

Run:

```bash
docker run --rm -e DOMAIN=fbd.ikeniborn.ru -e LETSENCRYPT_EMAIL=admin@example.com -v "$PWD/traefik/traefik.yml:/traefik.yml:ro" -v "$PWD/traefik/conf.d:/conf.d:ro" -v "$PWD/traefik/docker-entrypoint.sh:/docker-entrypoint.sh:ro" -v traefik_config_check:/data --entrypoint /docker-entrypoint.sh traefik:v3.3 check-config --configFile=/traefik.yml
```

Expected: command exits `0`. If Traefik returns an entrypoint argument error because the entrypoint intentionally ignores appended args, run this fallback and expect exit `0`:

```bash
docker run --rm -e DOMAIN=fbd.ikeniborn.ru -e LETSENCRYPT_EMAIL=admin@ikeniborn.ru -v "$PWD/traefik/traefik.yml:/traefik.yml:ro" -v "$PWD/traefik/conf.d:/conf.d:ro" -v "$PWD/traefik/docker-entrypoint.sh:/docker-entrypoint.sh:ro" -v traefik_config_check:/data --entrypoint sh traefik:v3.3 -c '/docker-entrypoint.sh & pid=$!; sleep 2; kill "$pid" 2>/dev/null || true; test -f /tmp/traefik.yml; test -f /rendered-conf.d/app.yml; traefik check-config --configFile=/tmp/traefik.yml'
```

- [ ] **Step 5: Validate scripts**

Run:

```bash
bash -n deploy.sh scripts/lib/*.sh scripts/ci/*.sh
```

Expected: command exits `0`.

- [ ] **Step 6: Commit validation fixes**

Run:

```bash
git status --short
```

Expected: no uncommitted files from validation except intentional fixes. If fixes were made, commit them:

```bash
git add docker-compose.yml traefik deploy.sh scripts/lib .github/workflows/build-and-push.yml IMAGE_VERSIONS.json
git commit -m "fix: validate Traefik deployment config"
```

Expected: commit succeeds when fixes exist; otherwise no commit is created.

---

### Task 6: Dev Rollout and Operational Verification

**Files:**
- Verify: deployed dev environment `https://fbd.ikeniborn.ru/`
- Verify: server network `monitoring`
- Verify: `/etc/logrotate.d/docker-containers` on `budget-test`
- Update: iwiki domain `familybudget` after behavior is confirmed

- [ ] **Step 1: Ensure monitoring network exists on the server**

Run on the deployment host:

```bash
ssh budget-test 'docker network inspect monitoring >/dev/null 2>&1 || docker network create monitoring'
```

Expected: command exits `0`.

- [ ] **Step 2: Check Docker logrotate trap**

Run:

```bash
ssh budget-test 'test ! -f /etc/logrotate.d/docker-containers'
```

Expected: command exits `0`. If it exits non-zero, disable the trap before deploy:

```bash
ssh budget-test 'sudo mv /etc/logrotate.d/docker-containers /etc/logrotate.d/docker-containers.disabled'
```

Expected: command exits `0`.

- [ ] **Step 3: Deploy to dev**

Run:

```bash
ssh budget-test 'cd /opt/budget && ./deploy.sh --profile full'
```

Expected: deploy finishes successfully and `docker compose ps` shows `traefik` healthy.

- [ ] **Step 4: Verify HTTPS and health**

Run:

```bash
curl -fsS https://fbd.ikeniborn.ru/health
curl -fsSI https://fbd.ikeniborn.ru/ | grep -Ei 'HTTP/|x-frame-options|x-content-type-options|content-encoding'
```

Expected: health request exits `0`; header request shows an HTTP success status and security headers.

- [ ] **Step 5: Verify WebSocket route**

Run:

```bash
npm run test:e2e:chromium -- tests/e2e/websocket.spec.ts
```

Expected: Playwright exits `0`. If the exact spec path does not exist, run the repository's Chromium e2e suite:

```bash
npm run test:e2e:chromium
```

Expected: Playwright exits `0`.

- [ ] **Step 6: Verify Telegram WebApp headers**

Run:

```bash
curl -fsSI https://fbd.ikeniborn.ru/webapp/ | grep -Ei 'content-security-policy|access-control-allow-origin|x-frame-options'
```

Expected: output includes `frame-ancestors https://web.telegram.org https://*.telegram.org` and `Access-Control-Allow-Origin: https://web.telegram.org`.

- [ ] **Step 7: Verify private metrics readiness**

Run:

```bash
ssh budget-test 'docker run --rm --network monitoring curlimages/curl:8.8.0 -fsS http://familybudget-traefik:8082/metrics | head'
```

Expected: output contains Prometheus metric lines beginning with `# HELP` or `traefik_`.

- [ ] **Step 8: Update iwiki after confirmed behavior change**

Use iwiki MCP tools:

```text
wiki_update_page(domain="familybudget", slug="architecture", heading="System Components", new_body=<Traefik system component section>, source="docker-compose.yml")
wiki_update_page(domain="familybudget", slug="architecture", heading="Service Topology", new_body=<Traefik topology section>, source="docker-compose.yml")
wiki_update_page(domain="familybudget", slug="architecture", heading="Request Flow", new_body=<Traefik request flow section>, source="traefik/conf.d/app.yml.tmpl")
wiki_update_page(domain="familybudget", slug="architecture", heading="Deployment & CI/CD", new_body=<Traefik deployment section>, source="deploy.sh")
wiki_lint(domain="familybudget")
```

Expected: `wiki_lint` reports no broken refs, no orphan pages, and no stale pages.

- [ ] **Step 9: Run chain result check**

Run:

```bash
/check-chain result docs/superpowers/plans/2026-07-06-traefik-migration.md
```

Expected: result verdict is `OK`; the task log marks `traefik-migration` as `done`.

- [ ] **Step 10: Commit docs and final verification evidence**

Run:

```bash
git status --short
git add docs/superpowers/plans/2026-07-06-traefik-migration.md docs/superpowers/reports/traefik-migration-results.html
git commit -m "docs: add Traefik migration implementation plan"
```

Expected: commit succeeds after plan/result artifacts are updated.

---

## Rollback Path

If dev deploy fails before prod rollout, restore nginx by reverting the implementation commits that touched `docker-compose.yml`, `traefik/`, `deploy.sh`, `scripts/lib/`, `.github/workflows/build-and-push.yml`, and `IMAGE_VERSIONS.json`. The `nginx/` directory remains present in this migration so rollback can use the existing `familybudget-nginx` image and host `/etc/letsencrypt` certificates.

Verification after rollback:

```bash
docker compose --profile full config >/tmp/familybudget-rollback-compose.yml
grep -q 'familybudget-nginx' /tmp/familybudget-rollback-compose.yml
curl -fsS https://fbd.ikeniborn.ru/health
```

Expected: all commands exit `0`.

## Self-Review

- Spec coverage: R1-R9 map to Tasks 1-6 in the source requirements table.
- Placeholder scan: no placeholder tokens are present in the plan body.
- Dependency order: Traefik files are created before Compose references them; Compose is updated before deploy scripts and CI; local validation runs before dev rollout.
- Verifiability: each task has commands and expected results; rollout has concrete HTTP, WebSocket, header, metrics, and wiki checks.
