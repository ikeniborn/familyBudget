---
review:
  spec_hash: a4f9c9e84fc485f6
  last_run: 2026-10-31
  phases:
    structure: { status: passed }
    coverage: { status: passed }
    clarity: { status: passed }
    consistency: { status: passed }
  findings: []
chain:
  intent: docs/superpowers/intents/2026-10-31-proxy-deployment-security-intent.md
---
# Design: proxy-deployment-security

**Date:** 2026-10-31
**Status:** approved
**Intent:** ../intents/2026-10-31-proxy-deployment-security-intent.md

## 1. Scope and requirements
The identical specification copies describe one coordinated change. FamilyTraffic owns proxy protection and installation. FamilyBudget owns service publication. Bases and PR targets are master and test respectively.

| Requirement | Intent | Acceptance |
|---|---|---|
| R1: Preserve no-TLS selection | O1, O7 | Fresh install, upgrade, and repeat generation retain selected listeners 1081/8119. |
| R2: Reconcile firewall | O2 | Eight TCP connections in 30 seconds succeed on each enabled proxy port. Managed LIMIT rules become ALLOW. |
| R3: Preserve authenticated traffic | O3 | Four proxy transports return HTTPS 200 with valid credentials; invalid credentials fail. VLESS and per-user routing remain usable. |
| R4: Attribute failures | O4 | Wrong-password events contain the actual client IP, resistant to public spoofing. |
| R5: Enforce and diagnose bans | O4, O5 | Five wrong-password events in 600 seconds trigger a 3600-second ban on proxy ports. A different-IP valid client remains usable. |
| R6: Close internal-service publication | O6 | Budget 5432, 6379, and backend port bind only to loopback. Host and Docker access work; external probes fail. |
| R7: Preserve fixes across deployment | O7 | Fresh-install, upgrade, repeat-deploy, and rollback tests pass without user-data loss. |

## 2. Evidence and design choice
The FamilyTraffic orchestrator generates nginx before saving initial environment settings. The wrapper reads only the persisted no-TLS flag and otherwise selects false. Fresh-install interactive selection can therefore be lost.

Firewall setup skips a port whenever a matching UFW entry exists. It does not replace an existing LIMIT rule. The shared recent-IP counter rejected ordinary connection bursts on the host.

Xray v24.11.30 returns HTTP 407 without an authentication-rejection event. SOCKS logs broader handshake failures. nginx forwards from loopback. Legacy jails reference obsolete paths and inherit systemd monitoring without a journal filter.

FamilyBudget publishes internal services on wildcard addresses. UFW INPUT checks do not establish Docker isolation.

Alternatives:
1. Stock Xray plus PROXY protocol: cannot satisfy HTTP failure logging.
2. Separate proxy authentication service: duplicates credentials, lifecycle, and routing integration.
3. Recommended: retain nginx and Xray, forward real IP on the private hop, and maintain a minimal authentication-event patch on pinned Xray.

Approval accepts the source-patch maintenance cost. There is no second authentication authority or new public proxy protocol.

## 3. Client address boundary
Enable outbound `proxy_protocol on` only in the four nginx proxy stream servers. Public listeners must not accept client-supplied PROXY metadata. Leave Reality and unrelated transports unchanged.

Bind Xray SOCKS and HTTP receivers to 127.0.0.1:10800 and 127.0.0.1:18118. Set `streamSettings.sockopt.acceptProxyProtocol=true` there. nginx derives source metadata from its TCP peer. HTTP headers, usernames, and payload text cannot determine the ban address.

Local host processes remain trusted. Internal tools must use nginx entry points when they need a normal proxy client interface. Private Xray receivers are not public entry points.

Audit generated routing rules that assumed source 127.0.0.1. Replace only the obsolete generated source condition with the equivalent inbound-tag match. Preserve rule order, per-user assignments, transport settings, and unrelated routes.

## 4. Authentication events and build
Build Xray in CI from commit `98a72b6fb49bcc403c4cae1ff529b9def43e6ad8` (v24.11.30), using a pinned Go builder. Replace the current binary-extraction stage. Store the narrow patch and tests in the Docker build context. Verify the fetched commit and patch application; fail on mismatch. Do not silently use an unpatched image or upgrade Xray as part of this change.

Emit exactly one dedicated security-journal event for a syntactically valid credential mismatch:

`2026-10-31T12:00:00Z FT_AUTH_FAILURE protocol=http src=192.0.2.10`

Use `protocol=socks` for SOCKS. Obtain a validated numeric source IP from the connection/session and omit the source port. Never include usernames, passwords, authorization headers, URLs, or arbitrary request text.

For HTTP, emit at the account-check mismatch. Missing or malformed authentication still returns 407 but does not count as a wrong password. This preserves ordinary challenge-based negotiation.

For SOCKS, propagate a typed/sentinel credential-mismatch error from the account check. Emit once at the server boundary with source context. Do not count EOF, timeout, unsupported authentication methods, malformed handshakes, or destination errors.

Write only these fixed-format events to `/var/log/xray/auth.log`, already covered by the host log-directory mount. Do not mix them with general error or access logs: client-controlled text in those logs must not forge ban events. Keep normal access logging controlled by debug. Use a small dedicated writer that opens the fixed file with append/create and mode 0600 per event, writes one bounded line, and closes it. Format UTC timestamps and validated numeric addresses; exclude all other request data. This allows rename-based rotation without stale file descriptors. Failed writes produce an explicit protection error without credential contents. Provision and check file ownership/permissions before service start; a controlled event check must detect write failure. Commit real journal fixtures and verify rotation, concurrent writes, restart, and log-injection negatives.

A public configuration with empty HTTP accounts or SOCKS without authentication fails preflight. Preserve users and credentials during upgrade. Synchronize accounts before opening listeners; synchronization failure cannot become deployment success.

## 5. Fail2ban policy
Use one managed jail `familytraffic-proxy-auth` for both event types. Set explicit file backend `polling`, `usedns=no`, and `/opt/familytraffic/logs/xray/auth.log`. Anchor the entire line to the dedicated timestamp/event grammar. No general-log prefixes or arbitrary leading text are accepted. Accept only the two defined protocol values and numeric IPs.

Set maxretry=5, findtime=600, bantime=3600. Ignore loopback only. Do not whitelist the observed client IP. Use the host-compatible iptables-multiport action on enabled proxy ports only; exclude SSH, Reality, and database ports.

Reconcile UFW before enabling/reloading the managed jail. Verify ban-rule placement ahead of UFW acceptance. Verify ban/unban after firewall reload and fail2ban restart.

Back up and disable known project-owned vless-http, vless-socks5, and superseded familytraffic jails. Preserve SSH and unrelated custom jails. If ownership or local customization is ambiguous, abort with the conflicting filename instead of overwriting it.

Validate configuration with `fail2ban-client -t`. Inspect effective log monitoring, filter, thresholds, and action ports. Missing logs, wrong backend, unmatched fixtures, or absent jail fail deployment verification.

IP bans affect clients sharing one public NAT address. This design cannot isolate users behind the same IP. Isolation tests use distinct source IPs. A valid client changing IP needs no configuration update; an old ban expires normally.

## 6. FamilyTraffic reconciliation and rollback
Resolve no-TLS once per operation: explicit current choice, including false, overrides persisted state; otherwise use persisted state, then false. Fresh installation must honor the interactive value before a settings file exists.

Pass the same resolved value to nginx, exports, UFW, and jail ports. Preserve Tier 2 and MTProxy configuration during migration. Preserve inodes of existing bind-mounted configuration files.

Replace exact project-managed global LIMIT rules with ALLOW. Preserve operator-specific source restrictions and unrelated firewall entries. Report conflicting rules instead of broadening them. Do not newly open disabled no-TLS ports.

Provide one scoped host reconciliation entry point used by installation and documented deployment/update paths. Do not run the destructive fresh-install routine against existing users. Image-only updates require an explicit host-protection check; they cannot claim a completed host migration by replacing the image alone.

The patched image carries a fixed capability marker covered by build tests. Preflight requires that marker plus a valid staged authentication configuration; binary version alone is insufficient.

Transition order: capture configuration/policy backups and image identity; resolve state; validate staged configuration and patched-image capability; apply compatible nginx/Xray files and image together during a controlled restart; verify authenticated traffic; reconcile UFW; activate and verify fail2ban.

Do not open new public listeners before valid authentication configuration exists. Existing public acceptance must never expose empty accounts. On failure, restore the previous compatible nginx/Xray pair, image, and managed host policy. Preserve users, certificates, routes, and volumes. Report a failed deployment after rollback; do not leave a PROXY-protocol mismatch. A rollback may restore previously ineffective protection; report that degraded state explicitly and retain a failed result. Never report it as a protected success.

## 7. FamilyBudget publication
Publish PostgreSQL as `127.0.0.1:5432:5432`, Redis as `127.0.0.1:6379:6379`, and backend as `127.0.0.1:${BACKEND_PORT:-8000}:8000`. Validate BACKEND_PORT as a numeric TCP port. Keep Docker service names and networks.

Update Compose, installer/deploy validation, and operator guidance together. Validate rendered configuration before recreation and actual HostIp bindings afterward. Reject wildcard, omitted, or non-loopback bindings, including conflicting overrides. Do not treat UFW INPUT status as proof of Docker isolation.

The existing POSTGRES_EXTERNAL_ACCESS=true workflow conflicts with the accepted local-only policy. Fail preflight before container mutation with a migration message. Do not silently preserve external exposure or claim that a UFW source allow rule protects it. Document local and SSH-forwarded administration. Remove generated instructions that recommend these public ports.

Use the existing deployment path with prebuilt images. Preserve volumes and credentials. Keep backend, bot, and reverse-proxy Docker connectivity. Do not change frontend public ports or recreate unrelated services.

Check container health, host-loopback access, backend-to-database/Redis connectivity, and effective mappings after every deploy. External probes are release evidence; unavailable external verification remains pending, rather than being inferred from UFW output.

## 8. Verification matrix
Use isolated environments for authentication-failure and migration tests. Never deliberately ban the active administration source on a shared host. Use distinct offender, valid-client, and changed-client source identities.

| Scenario | Expected result |
|---|---|
| First install with no saved settings and no-TLS true | Both no-TLS listeners and consistent exports, rules, jail ports. |
| Explicit false with saved true | No no-TLS listeners and no newly enabled no-TLS rules. |
| Upgrade and repeated generation | Users, routes, credentials, and transport settings preserved. |
| Existing LIMIT rules | Only managed rules reconciled; eight connections per port succeed. |
| Four valid proxy protocols | Controlled HTTPS target returns 200 with TLS verification. |
| Wrong credentials | HTTP 407 or SOCKS auth failure; no target access. |
| Challenge/malformed request | Correct rejection without a credential-mismatch event. |
| IP forwarding | Event address equals the source seen by nginx. |
| Public spoof/log-injection attempt | PROXY text, forged headers, usernames, URLs, and embedded newlines cannot create a victim-IP event or ban. |
| Five failures from offender | Offender blocked on proxy ports; different-IP client, SSH, and Reality remain usable. |
| Expiry/unban/rotation/restart | Connectivity and log monitoring behave according to policy. |
| Client changes IP | Valid authentication works without allowlist edits. |
| Empty accounts or incompatible image/config | Preflight fails without unauthenticated exposure. |
| Partial migration failure | Previous compatible configuration/image and managed policy restored. |
| Budget fresh/upgrade/repeat | Loopback bindings, healthy containers, local/Docker access, failed external probes. |
| Budget external flag/override conflict | Preflight stops before mutation with a concrete error. |

Run focused shell syntax, BATS, patched upstream Go tests, filter tests, and container integration during iteration. Run relevant regressions and required full suites once on each final unchanged repository state. Record command, scope, exit code, and state fingerprint. Missing infrastructure blocks the corresponding success claim.

## 9. Delivery and approval boundaries
FamilyTraffic changes cover orchestrator, nginx generation, fail2ban setup, deployment/update entry points, Docker build, patch resources, tests, and affected docs. FamilyBudget changes cover Compose, deployment preflight/verification, firewall guidance, tests, and affected docs. No unrelated refactoring.

Deliver separate PRs to master and test. Never build application images on the server or delete volumes. The patched Xray and PROXY-protocol migration require approval of this checked specification. A rollout of the new protection requires a concrete deployment review; earlier host fixes do not approve that new mechanism.

If pinned Xray cannot meet event or attribution requirements, return to the affected chain gate. Record task evidence and retain completion-pending while required wiki delivery remains unavailable. This document describes proposed behavior, not completed implementation.

## 10. Source anchors
- FamilyTraffic `lib/orchestrator.sh`: first-install order, no-TLS wrapper, firewall setup.
- FamilyTraffic `lib/fail2ban_setup.sh`: disabled jails and log assumptions.
- FamilyTraffic `docker/familytraffic/Dockerfile`: current binary extraction.
- FamilyBudget `docker-compose.yml`, `deploy.sh`, `scripts/lib/firewall.sh`: publication and UFW assumptions.
- [Xray HTTP](https://github.com/XTLS/Xray-core/blob/98a72b6fb49bcc403c4cae1ff529b9def43e6ad8/proxy/http/server.go).
- [Xray SOCKS](https://github.com/XTLS/Xray-core/blob/98a72b6fb49bcc403c4cae1ff529b9def43e6ad8/proxy/socks/protocol.go).
- [Xray TCP](https://github.com/XTLS/Xray-core/blob/98a72b6fb49bcc403c4cae1ff529b9def43e6ad8/transport/internet/tcp/hub.go).
- [nginx PROXY protocol](https://nginx.org/en/docs/stream/ngx_stream_proxy_module.html#proxy_protocol).
