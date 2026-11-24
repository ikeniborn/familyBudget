---
review:
  plan_hash: "f4259ad4b7fb4a27"
  last_run: 2026-11-23
  phases:
    structure: { status: passed }
    coverage: { status: passed }
    dependencies: { status: passed }
    verifiability: { status: passed }
    consistency: { status: passed }
  findings: []
chain:
  intent: docs/superpowers/intents/2026-11-23-local-test-ci-deployment-intent.md
  spec: docs/superpowers/specs/2026-11-23-local-test-ci-deployment-design.md
---
# Shared FamilyBudget test deployment implementation plan

> Use superpowers:executing-plans for parent execution after plan approval. Record observed results separately from expected outcomes.

**Goal:** Serve a shared HTTPS test environment on Mini PC and deploy verified GHCR images on eligible VERSION changes.

**Architecture:** GitHub Actions publishes release metadata to test. A local systemd timer verifies the successful run and applies its digest-pinned images to a dedicated Compose project. The existing Traefik publishes fbd.

**Tech stack:** GitHub Actions, GHCR, Git, Python 3, Compose v2, PostgreSQL, systemd, Traefik.

**Spec:** `docs/superpowers/specs/2026-11-23-local-test-ci-deployment-design.md`.

## Global constraints

Use synthetic data, a separate test bot, and isolated volumes. Preserve other Mini PC services and production delivery. Stop on overlapping networks, missing test credentials, or failed local health. Enable automatic delivery only after manual acceptance.

### Task 1: Prepare an isolated runtime and baseline

Files: create `deploy/minipc-test/compose.yaml`, `deploy/minipc-test/env.example`, and `tests/deployment/test_minipc_test_compose.py`.

- [ ] Check listeners, Docker and LAN and VPN routes, disk, memory, and existing service probes. Record six HTTP and TLS results and Traefik restart state before any host write. HUMAN CHECKPOINT if no non-overlapping subnet can be reserved.
- [ ] Add failing tests for unique resources, exact image references, private DB and Redis, and backend-only proxy-net membership. Run the focused test module and verify that missing configuration fails.
- [ ] Define the Compose model and test environment template. Configure PostgreSQL lock limits, private volumes, user-defined subnet, resource limits, and unique backend network alias. Run `docker-compose config --quiet` with synthetic settings and the focused tests. Expect exit 0.
- [ ] Deploy the isolated app on Mini PC with agreed test secrets and known GHCR digests. Run migrations from the backend container and query Alembic and container-local /health. Expect migration head, healthy application, and zero host-published application ports.

### Task 2: Activate ingress and accept browser and Telegram flows

Files: create `deploy/minipc-test/traefik/fbd.yml` and `docs/MINIPC_TEST_DEPLOYMENT.md`.

- [ ] Validate exact host, unique router, existing entry points and TLS resolver, and backend reachability from the proxy network. Install only the fbd dynamic file after local acceptance. Expect trusted TLS and HTTP health on fbd.
- [ ] Repeat all six existing-service probes and compare the Traefik start timestamp and restart count. Roll back the dynamic file if any pre-existing result regresses. Expect baseline equivalence.
- [ ] HUMAN CHECKPOINT. Supply a dedicated test bot and test account and configure the fbd Mini App URL. Register a passkey, sign out, sign in again, and test Mini App authentication on a phone. Record each successful outcome without tokens or account data.

### Task 3: Publish and verify Git release metadata

Files: modify `.github/workflows/build-and-push.yml`. Create `scripts/ci/publish_test_release.py`, `deploy/minipc-test/release_metadata.py`, and `tests/deployment/test_minipc_test_release.py`.

- [ ] Add failing fixtures for no VERSION change, failed CI, wrong workflow or attempt, stale source, concurrent branch movement, malformed digest, and valid digest-pinned releases. Verify the intended failures before implementing.
- [ ] Finalize digest fields and CI provenance after successful image checks for eligible pushes. Retain the four service keys and version fields. Use tested SHA and expected branch-tip checks and the spec's VERSION and manifest comparison before updating test. Cover image reuse and concurrent pushes with local Git fixtures.
- [ ] Verify metadata against the pinned fetched test snapshot and successful workflow attempt. Reject stale or conflicting manifests without running branch code. Run `python3 -m unittest discover -s tests/deployment -p test_minipc_test_release.py`. Expect exit 0.

### Task 4: Apply, test, and recover releases locally

Files: create `deploy/minipc-test/apply_release.py`, `deploy/minipc-test/systemd/familybudget-test-deploy.service`, `deploy/minipc-test/systemd/familybudget-test-deploy.timer`, and `tests/deployment/test_minipc_test_recovery.py`. Extend the Mini PC deployment guide.

- [ ] Add failing tests for duplicate release, pull failure, migration failure, failed health, and failed restore. Verify that no failing candidate becomes the applied release.
- [ ] Implement one-at-a-time deployment, pre-pull, quiesced DB backup validation, migrations, HTTP health, and atomic applied-release recording. Retain previous image references locally. Verify failure recovery with an isolated Compose project and synthetic data.
- [ ] Execute local frontend tests with the intended test configuration and backend integration tests with disposable PostgreSQL. Record commands, repository revision, and exit status. Expect test success and evidence that the shared test database was excluded from the integration test configuration.
- [ ] Verify systemd units with `systemd-analyze verify` and run the deployment suite. Keep the timer disabled until manual acceptance. Expect valid units and passing deployment tests.

### Task 5: Switch automatic delivery and reconcile the result

- [ ] HUMAN CHECKPOINT. Confirm the working legacy fallback, accepted fbd browser flows, service baselines, and rollback evidence. Enable the Mini PC timer and retire legacy test SSH delivery using the approved cutover. Preserve production delivery.
- [ ] Verify a successful VERSION-changing push deploys the recorded digest set. Verify a non-version push preserves the applied release. Confirm repeat polling performs no second deployment.
- [ ] Repeat the six service probes and check Traefik start and restart state. Record release source SHA, image digests, migration head, observed health, and test statuses. Run final relevant regression checks and check-chain result against this plan.
