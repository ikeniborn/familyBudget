---
review:
  spec_hash: 2c54e277b1f6c7ea
  last_run: 2026-06-24
  phases:
    structure:   { status: passed }
    coverage:    { status: passed }
    clarity:     { status: passed }
    consistency: { status: passed }
  findings:
    - { id: F-001, phase: clarity, severity: WARNING, section: "Risks & mitigations", section_hash: d25e253246583a04, text: "logrotate SIGHUP risk mitigation 'confirm' had no DoD", verdict: fixed, verdict_at: 2026-06-24 }
    - { id: F-002, phase: clarity, severity: WARNING, section: "deploy.sh & CI changes", section_hash: d60f295bd60521b4, text: "cache-busting 'verify during impl' had no acceptance criterion", verdict: fixed, verdict_at: 2026-06-24 }
    - { id: F-003, phase: clarity, severity: INFO, section: "Dynamic config", section_hash: 5a932be9bcfce7a6, text: "WebSocket timeout 'long' was unquantified; pinned to 86400s", verdict: fixed, verdict_at: 2026-06-24 }
    - { id: F-004, phase: clarity, severity: INFO, section: "Static config", section_hash: 9b41f3e443f04c06, text: "LETSENCRYPT_EMAIL new-vs-existing unstated; clarified as reused", verdict: fixed, verdict_at: 2026-06-24 }
chain:
  intent: null
---

# Design: nginx → Traefik migration + Prometheus metrics readiness

**Date:** 2026-06-24
**Branch:** `dev/traefik-migration` (base `test`, PR → `test`)
**Status:** Design — pending implementation plan

## Goal

Replace the nginx reverse proxy with Traefik v3 to:

1. Simplify routing maintenance and align with the existing minipc homelab (which
   already runs Traefik v3.3 + Prometheus + Grafana).
2. Make Traefik **ready** to expose Prometheus metrics for the central Grafana.

**Hard constraints (must not break):**

- HTTPS access to the app.
- Let's Encrypt certificate issuance **and** renewal.
- The `deploy.sh` deployment flow.

## Context (current state)

- Single `nginx` service in `docker-compose.yml` (profile `full`), bind-mounts
  `/etc/letsencrypt:ro` from the host.
- Certificates: host `certbot --standalone` HTTP-01. Issuance **stops nginx**
  (port 80 conflict); renewal via cron `0 0,12 * * *` + deploy-hook
  `docker exec familybudget-nginx nginx -s reload` (`scripts/ssl_certificate_manager.sh`).
- nginx config baked into a custom image (`ghcr.io/.../familybudget-nginx`);
  `nginx/docker-entrypoint.sh` renders `conf.d/*.template` by substituting
  `{{DOMAIN}}` and picks the HTTP-only or HTTPS template based on cert presence.
- One upstream: `backend:8000`.
- `deploy.sh` — phased startup (postgres → redis → backend → migrations → bot/nginx),
  registry-first (images pulled from ghcr per `IMAGE_VERSIONS.json`), profiles
  `basic`/`full`.
- **No Prometheus/Grafana in this repo.** No `/metrics` on the backend.
- Two environments: prod `fb.ikeniborn.ru`, dev `fbd.ikeniborn.ru`; `DOMAIN` from `.env`.

### Existing monitoring (external, minipc homelab)

The budget server (`ikenibornbudget`) already participates in push-monitoring:

```
node-exporter + prometheus-agent (on ikenibornbudget)
  → remote_write → https://prometheus.ikeniborn.ru/api/v1/write (BasicAuth)
  → central Prometheus → Grafana (grafana.ikeniborn.ru)
```

This is **push** (prometheus-agent + remote_write), not pull. The agent runs in
its own compose (`/opt/monitoring-agent`) on an internal bridge with no host
ports. Existing node metrics do **not** flow through `familybudget-nginx`, so
replacing nginx does not affect them.

minipc Traefik reference patterns (followed here for consistency):
`httpChallenge` on `web:80`, **file-provider** (`/conf.d`, watch — no docker.sock),
metrics entryPoint `:8082`, dashboard `insecure: false`.

## Scope

### In scope (this repo, familyBudget)

- Replace the `nginx` service with `traefik` (official `traefik:v3.3` image).
- Traefik **native ACME** (httpChallenge), storage `acme.json`.
- **file-provider** dynamic routes; `DOMAIN` substituted by a Traefik
  `docker-entrypoint.sh` (`sed`, same approach as the current nginx entrypoint).
- Port all current nginx routes/headers to Traefik dynamic config.
- Enable Prometheus metrics entryPoint `:8082` + network readiness for a future scrape.
- `deploy.sh` updates: `nginx` → `traefik`, remove standalone-certbot calls,
  Traefik health check.
- CI: drop the `familybudget-nginx` image build.
- No Traefik dashboard.

### Out of scope (done later, by the user, in the minipc repo)

- The `traefik` scrape job in `prometheus-agent.yml` + remote_write wiring.
  This repo only makes Traefik **ready** (metrics entryPoint up + reachable on
  the `monitoring` network).
- Backend application instrumentation (`/metrics` on FastAPI).
- Traefik native ACME as a *replacement* of the certbot pipeline on the host
  beyond what is needed here (certbot is retired only after prod is confirmed).

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Native Traefik ACME (not "keep certbot + file provider") | User choice. Single source of truth for certs long-term; renewal becomes automatic, dropping the fragile `docker exec ... -s reload` hook. |
| 2 | **httpChallenge** on `:80` (not TLS-ALPN, not DNS-01) | Matches minipc reference. Traefik answers `/.well-known/acme-challenge` on the already-open `:80`; nothing is stopped during issuance or renewal. |
| 3 | **file-provider** routes in `conf.d/*` (not docker labels) | Matches minipc. Routes live in git and are reviewable; Traefik needs no access to `docker.sock` (smaller attack surface). |
| 4 | `DOMAIN` via entrypoint `sed` on `conf.d/*.tmpl` | Same mechanism as current nginx; one image serves both `fb`/`fbd` environments with explicit `Host()` matchers (needed for per-domain ACME). |
| 5 | Metrics entryPoint `:8082`, **not** published to the host | Scraped privately by the local prometheus-agent over a shared `monitoring` network. No public metrics exposure. |
| 6 | **No dashboard** (`api.dashboard: false`) | Less exposure, fewer domains/certs. State observed via logs/metrics. |
| 7 | Keep `/etc/letsencrypt` + certbot during rollout | Fallback for an instant revert to nginx. certbot cron retired only after prod is confirmed on Traefik. |
| 8 | Official `traefik:v3.3` image, pinned tag | No custom image to build/scan; drops the `familybudget-nginx` CI build. |

## Target architecture

```
traefik (traefik:v3.3)
├── networks:
│   ├── familybudget   → backend:8000
│   └── monitoring     (external) → reachable by the future prometheus-agent
├── ports: 80, 443            # :8082 NOT host-published — only on the monitoring network
├── volumes:
│   ├── ./traefik/traefik.yml:/traefik.yml:ro        # static config
│   ├── ./traefik/conf.d:/conf.d:ro                  # dynamic routes, rendered by entrypoint
│   └── traefik_acme:/data                            # acme.json (chmod 600 on start)
└── entrypoint: render conf.d/*.tmpl by $DOMAIN, chmod acme.json, exec traefik
```

postgres / redis / backend / bot are unchanged. `monitoring` is an external
docker network created in this repo (empty placeholder); the agent joins it later.

### Static config (`traefik/traefik.yml`)

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

certificatesResolvers:
  letsencrypt:
    acme:
      email: ${LETSENCRYPT_EMAIL}   # already defined in .env.example — reused, not new
      storage: /data/acme.json
      httpChallenge:
        entryPoint: web
      # caServer: https://acme-staging-v02.api.letsencrypt.org/directory
      #   ↑ enabled on dev during debugging, removed before prod ACME

providers:
  file:
    directory: /conf.d
    watch: true

metrics:
  prometheus:
    entryPoint: metrics

log:
  level: INFO
```

### Dynamic config (`traefik/conf.d/app.yml.tmpl`)

One backend load-balancer `backend:8000`. nginx behaviours ported to middlewares:

| nginx (current) | Traefik equivalent |
|---|---|
| `/api/v1/budget/ws` 24h timeout, no buffering, access_log off | dedicated router → backend; WebSocket native; **86400s (24h)** read/write timeout via `serversTransport.forwardingTimeouts` (matches nginx `proxy_read/send_timeout 86400s`); buffering off |
| `/webapp/` CSP `frame-ancestors ...telegram...`, CORS, `X-Frame-Options ""` | path-scoped `headers` middleware (Telegram embed headers) |
| global security headers (`X-Frame-Options SAMEORIGIN`, `X-Content-Type-Options nosniff`, `X-XSS-Protection`) | global `headers` middleware |
| `gzip` | `compress` middleware |
| `client_max_body_size 20M` | `buffering.maxRequestBodyBytes` middleware |
| HTTP→HTTPS redirect | `web` entryPoint redirection to `websecure` |
| `/shared/`, `/webapp/` cache `expires` | cache headers already set by backend / `headers` middleware where needed |

Static assets (`sw`, `/static`, `/shared`, `/webapp`, `manifest.json`) are already
served by the backend; Traefik just proxies them. Routes use explicit
`Host(\`{{DOMAIN}}\`)` matchers, substituted at start.

## Metrics readiness

- `metrics` entryPoint `:8082` + `metrics.prometheus` enabled in static config.
- Traefik joins the external `monitoring` network → reachable at `traefik:8082`
  by the future prometheus-agent. `:8082` is not host-published.
- **Done here:** entryPoint up + network membership.
  **Done later (minipc repo):** a `traefik` scrape job + remote_write.

## deploy.sh & CI changes

- Replace the `nginx` service with `traefik` in phased startup
  (`start_application_services`).
- Health check Traefik (`traefik healthcheck` against the ping endpoint) instead
  of `nginx -t`.
- Remove standalone-certbot orchestration from the deploy path
  (`setup_ssl_certificates`, `verify_ssl`) — Traefik handles ACME itself.
- Keep `configure_firewall_for_ssl` semantics so `:80`/`:443` stay open for the
  httpChallenge.
- CI `build-and-push`: drop the `familybudget-nginx` image build. Traefik uses a
  pinned official tag, not tracked in `IMAGE_VERSIONS.json`.
- Cache-busting/template-registration scripts: no new app templates with
  `?v=PLACEHOLDER` are introduced. **DoD:** `git diff --stat` for the migration
  touches no file under `frontend/web/templates/`; therefore
  `scripts/ci/cache_busting_ci.sh` and `scripts/lib/cache_busting.sh` need no edits.
  If that assumption breaks, register the new template in both scripts.

## Rollout & rollback

1. **dev (`fbd`) — staging ACME.** Verify issuance, HTTPS access, WebSocket,
   `/webapp/` embed headers, gzip, body-size limit, and `:8082` reachability on
   the `monitoring` network.
2. **dev (`fbd`) — production ACME.** Verify a real, trusted certificate.
3. **prod (`fb`) — production ACME.**
4. **Rollback:** restore the `nginx` service (image still in ghcr,
   `/etc/letsencrypt` untouched) → `deploy.sh`. Trivial because the cert pipeline
   was left intact.
5. Retire certbot cron + `ssl_certificate_manager.sh` standalone path **only
   after** prod is confirmed healthy on Traefik (separate follow-up commit).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Burn Let's Encrypt rate limit (5 certs/week/domain) while debugging | staging ACME on dev first |
| `acme.json` rejected for wrong permissions | entrypoint `chmod 600` before exec |
| WebSocket / `/webapp` headers lost in translation | per-route port + e2e checks on dev (`test:e2e:chromium`) |
| Loss of access during cutover | dev-first rollout; nginx rollback ready |
| Nightly `docker kill -s HUP` logrotate trap (seen on minipc) signals containers | **DoD:** run `test -f /etc/logrotate.d/docker-containers` on the budget server. If present, disable it (`mv … .disabled`) per the minipc runbook. Traefik treats SIGHUP as a config reload (survives), so this is precautionary, not blocking |
| Metrics network not present at start | create external `monitoring` network in deploy before `up` |

## Follow-ups (not in this spec)

- minipc repo: `traefik` scrape job + remote_write.
- Update `docs/wiki/` (architecture / deployment pages) via `iwiki:iwiki-ingest`
  after implementation (per project CLAUDE.md).
- Retire certbot/cron + `ssl_certificate_manager.sh` once prod is stable on Traefik.
