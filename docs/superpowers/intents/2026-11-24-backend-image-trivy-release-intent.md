---
review:
  intent_hash: "0795b40287458060"
  last_run: 2026-11-24
  phases:
    structure: { status: passed }
    completeness: { status: passed }
    clarity: { status: passed }
    consistency: { status: passed }
    alignment: { status: passed }
  findings: []
workflow:
  route: chain
  continuation: execute
---
# Intent: Backend image Trivy release

**Date:** 2026-11-24
**Status:** approved

## Objective

Deliver the bank CSV and two-factor setup fixes already merged into test. The backend image for 0.8.80 failed the release scan. Operators need a verified image for the shared fbd stand on Mini PC.

## Desired Outcomes

- The existing CI security gate reports zero blocking HIGH or CRITICAL findings for the release candidate. The published manifest identifies the scanned backend digest.
- After a VERSION-changing merge into test, the Mini PC applies that release to fbd. Its health endpoint reports the new version, and the database reaches the migration head for the release.
- The normal authentication flow accepts unexpired access, refresh and WebSocket tokens issued before the update for their intended uses. Signature, expiry and token-type checks retain their existing behavior.
- The release serves a scannable QR code on both TOTP setup pages. A bank CSV preview flags a matching fact by operation date and whole-ruble amount. Repeating a confirmed import creates zero extra facts.

## Health Metrics

- The release manifest, running backend image and HTTPS version identify the same release.
- The six other Mini PC HTTPS probes return their baseline statuses. The shared Traefik start time and restart count match baseline across deployment.
- An isolated database upgrades from the previous fbd revision and retains its existing facts. The previous release remains recoverable under the Mini PC deployment procedure.

## Strategic Context

- Interacts with: backend runtime, JWT consumers, Alembic, GitHub Actions, GHCR and the Mini PC release poller.
- Priority trade-off: preserve authentication, stored data and existing services before release speed.

## Constraints

### Steering

- Exercise compatibility using synthetic credentials and an isolated database. Check the actual built image and use read-only probes for shared-service health.

### Hard

- Keep the existing Trivy rules, ignore list, scan coverage and release publication checks.
- Deliver through a separate worktree and pull request from origin/test into test. Trigger deployment by changing VERSION.
- Deploy only to fbd on Mini PC. Preserve the shared proxy, other services, existing user credentials and budget data.

## Autonomy Zones

- Full autonomy: inspect dependencies, inspect image contents and run isolated verification.
- Guarded: replace affected backend dependencies and runtime components. Merge and deliver the verified release through the approved test pipeline.
- Proposal-first: changes to the token contract, data model, target environment or rollback guarantees.
- No autonomy: weaken the Trivy policy, rotate live credentials, or alter unrelated Mini PC services.

## Stop Rules

- Halt if: the release scan fails, the digest cannot be verified, or deployment could overwrite unrelated services or data.
- Escalate if: a compatible image requires a change to authentication semantics, deployment scope or recovery guarantees.
- Done when: CI publishes the passing digest, fbd runs that release, and the authentication, import, QR, migration and neighboring-service checks meet the criteria above.
