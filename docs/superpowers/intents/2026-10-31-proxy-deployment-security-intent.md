---
review:
  intent_hash: 1da7b7b18a8f9ba4
  last_run: 2026-10-31
  phases:
    structure: { status: passed }
    completeness: { status: passed }
    clarity: { status: passed }
    consistency: { status: passed }
    alignment: { status: passed }
  findings: []
workflow:
  route: chain
  continuation: full
---
# Intent: proxy-deployment-security

**Date:** 2026-10-31
**Status:** approved

## Objective
Persist the deployment security fixes discovered on ikeniborndev in FamilyTraffic and FamilyBudget installation and deployment sources. Prevent reinstallations and upgrades from restoring broken proxy listeners, restrictive connection limits, exposed internal services, or misleading fail2ban protection.

## Desired Outcomes
- O1: When no-TLS proxy access is enabled, fresh installations and upgrades expose authenticated HTTP on 8119 and SOCKS5 on 1081. Repeated configuration generation preserves this selection.
- O2: Legitimate clients can open eight consecutive connections within 30 seconds on each proxy port: 1080, 1081, 8118, and 8119. Upgrades reconcile existing restrictive UFW rules.
- O3: HTTP, HTTPS, SOCKS5, and SOCKS5 over TLS transfer an HTTPS request successfully with valid credentials. Invalid credentials cannot obtain proxy access.
- O4: Proxy abuse protection identifies the actual remote client address and handles address changes without a fixed client-IP allowlist. Controlled authentication failures produce evidence usable for targeted blocking without banning loopback or unrelated valid clients.
- O5: Stale fail2ban jails do not claim to protect obsolete deployments. Installation and deployment verification report the effective protection state and detect missing log sources or ineffective filters.
- O6: FamilyBudget ports 5432, 6379, and 8000 reject external connections after installation and deployment. Host-loopback access and backend-to-database and Redis access through Docker remain available.
- O7: Repeated deployment preserves these outcomes. Regression checks detect the observed failures before release.

## Health Metrics
- All four authenticated proxy transports return HTTP 200 for a controlled HTTPS request.
- Eight consecutive TCP connections succeed on each proxy port without a UFW rate-limit rejection.
- VLESS Reality remains usable through public port 443.
- PostgreSQL, Redis, and backend pass their configured healthchecks after deployment.
- Existing database volumes and application data remain intact.
- A valid client remains usable during a controlled failed-authentication test from another client address.
- External TCP checks fail for 5432, 6379, and 8000; local and Docker checks succeed.

## Strategic Context
- Interacts with: FamilyTraffic installer, nginx, Xray, UFW, fail2ban, certificate handling, deployment scripts, and FamilyBudget Docker Compose and deployment scripts.
- Priority trade-off: Preserve security and service correctness before deployment speed. Prefer bounded changes supported by observed failures.
- FamilyTraffic owns proxy and host-protection changes. Its base and PR target are master.
- FamilyBudget owns internal-service publication and deployment changes. Its base and PR target are test.
- Both repositories use topic proxy-deployment-security and separate sibling worktrees. The intent copies describe one coordinated scope.
- The observed client address is not a permanent identity. No fixed allowlist is authorized by that observation.

## Constraints
### Steering
- Use existing installation and deployment mechanisms where they satisfy the outcomes.
- Keep changes limited to the observed deployment failures and the protection needed when removing proxy connection limits.
- Include executable regression evidence and update the affected operational documentation.

### Hard
- Preserve local and Docker access to FamilyBudget services while closing their public host bindings.
- Preserve proxy authentication and TLS certificate verification.
- Do not use a fixed client IP as a required access condition.
- Do not ban loopback or trust client-supplied address metadata at a public boundary.
- Do not delete Docker volumes, expose credentials, or build application images on the server.
- Do not commit or merge directly to protected branches.
- Do not claim effective fail2ban protection without a controlled failure-to-log-to-ban verification.

## Autonomy Zones
- Full: Read repository and host configuration, prepare isolated changes, and run non-destructive local checks within the approved scope.
- Guarded: Modify installation and deployment sources and tests after the selected chain gates pass. Preserve backups and verify bounded runtime changes.
- Proposal-first: Select a new authentication logging or client-address propagation design. Request approval before changing the security contract or deploying a newly designed protection mechanism.
- No autonomy: Delete durable data, weaken authentication or certificate validation, or push directly to protected branches.

## Stop Rules
- Halt if: A proposed change loses durable data, breaks required local or Docker access, or cannot distinguish the real attacker from the forwarding proxy.
- Escalate if: Xray cannot expose reliable HTTP authentication failures, client-address forwarding requires a new trust boundary, or a repository requirement conflicts with the accepted scope.
- Done when: Fresh-install, upgrade, and repeat-deploy checks demonstrate O1 through O7; all health metrics pass; repository changes are reviewable against the selected branches.
- Keep durable lifecycle completion-pending while required wiki evidence cannot be delivered.
