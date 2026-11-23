---
review:
  intent_hash: "4b30757874e2cc0c"
  last_run: 2026-11-23
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
# Intent: Shared FamilyBudget test deployment on Mini PC

**Date:** 2026-11-23
**Status:** approved

## Objective

Give testers a shared HTTPS FamilyBudget environment on Mini PC for manual checks, WebAuthn, and Telegram, while protecting the services already running there.

## Desired Outcomes

- Testers can open https://fbd.ikeniborn.ru with a trusted certificate and use a test account.
- A tester can register a test passkey, sign out, and sign back in with it. A tester can open the Mini App from a dedicated test Telegram bot on a phone and authenticate.
- After manual acceptance, a successful push to the test branch that changes VERSION results in a Mini PC deployment of the corresponding verified GHCR images. A push without a VERSION change leaves the deployed release unchanged.
- A successful deployment passes an HTTP health check on Mini PC. Local backend integration tests use a disposable PostgreSQL instance. Frontend tests run locally against their intended test configuration.

## Health Metrics

- Repeat the same Homepass, Grafana, Jellyfin, MinIO, Nextcloud, and iwiki probes before and after publishing the route. Preserve each expected HTTP status and TLS result.
- Compare Traefik container start time and restart count before and after route activation. Preserve both.
- Confirm PostgreSQL and Redis have no host-published ports. Confirm fbd uses test-only volumes, credentials, and accounts.

## Strategic Context

- Interacts with: existing Mini PC Traefik, Docker, LAN and VPN networks, GitHub Actions, GHCR, browser passkeys, the test Telegram bot, and testers.
- Priority trade-off: trust over speed. Use GHCR builds for the initial rollout to limit load on the shared host.

## Constraints

### Steering

- Verify migrations and container-local HTTP health before publishing the HTTPS route. Verify HTTPS and manual flows before switching automatic delivery.
- Check available CPU, memory, and disk before deployment. Use resource limits and run one test deployment at a time.

### Hard

- Use a dedicated Compose project, directory, and volumes. Reserve a subnet that does not overlap with Docker, LAN, or VPN routes.
- Use the existing Traefik entry points and TLS resolver with an exact fbd hostname rule. Keep production release delivery and existing routes intact.
- Use a dedicated test Telegram bot and synthetic data. Keep production credentials and data out of the test environment.

## Autonomy Zones

- Full autonomy: read-only inventory, configuration validation, and health probes.
- Guarded: start the isolated staging services, publish the fbd route after local acceptance, and roll back fbd if an existing service regresses.
- Proposal-first: changes to shared Docker networks, global proxy configuration, firewall rules, or production delivery.
- No autonomy: transfer of production credentials or live database data into fbd.

## Stop Rules

- Halt if a port or subnet overlaps, a test credential is unavailable, or local health checks fail.
- Roll back the fbd route or test release if an existing service fails its baseline probe. Escalate if the rollback does not restore the baseline.
- Done when: fbd serves trusted HTTPS, passkey and Telegram sign-in work on test accounts, a VERSION-changing push updates the deployed release, a push without that change leaves it unchanged, and existing service probes match baseline.
