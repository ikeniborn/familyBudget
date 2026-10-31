---
review:
  plan_hash: e5d7ff8bb5411f68
  last_run: 2026-10-31
  phases:
    structure: { status: passed }
    coverage: { status: passed }
    dependencies: { status: passed }
    verifiability: { status: passed }
    consistency: { status: passed }
  findings: []
chain:
  intent: docs/superpowers/intents/2026-10-31-proxy-deployment-security-intent.md
  spec: docs/superpowers/specs/2026-10-31-proxy-deployment-security-design.md

result_check:
  verdict: needs_work
  source: plan
  plan_hash: e5d7ff8bb5411f68
  last_run: 2026-10-31
  reviewed: true
  docs_checked: true
---
# FamilyBudget Internal Service Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Follow the project's delegation and approval rules.

**Status:** approved
**Spec:** ../specs/2026-10-31-proxy-deployment-security-design.md
**Intent:** ../intents/2026-10-31-proxy-deployment-security-intent.md

**Goal:** Make local-only service publication persistent across setup and deployment without breaking host or Docker connectivity.

**Architecture:** Compose explicitly publishes internal services on host loopback. A focused validator checks rendered configuration before mutation and running container bindings afterward. Deployment rejects the legacy external-publication mode and reports actual health/connectivity evidence.

**Tech Stack:** Docker Compose, Bash, Python standard library unittest, existing pytest/Vitest/CI checks.

## Global Constraints
- Publish 5432 and 6379 on 127.0.0.1; publish backend on 127.0.0.1 with numeric BACKEND_PORT, default 8000.
- Preserve PostgreSQL/Redis volumes, credentials, Docker service names, and networks.
- Preserve backend, bot, and reverse-proxy Docker access. Do not change public frontend ports.
- Do not build application images on the server or run tests against shared application databases.
- Reject POSTGRES_EXTERNAL_ACCESS=true before container mutation; do not silently expose services.
- UFW INPUT rules are not proof of Docker publication safety.
- Use branch dev-proxy-deployment-security and PR target test.
- HUMAN CHECKPOINT: implement only after checked-plan approval; production rollout follows a concrete reviewed deployment proposal.

## Coverage and dependencies
| Task | Requirement | Deliverable | Dependencies |
|---|---|---|---|
| FB1 | R6 | Loopback Compose and publication validator | None |
| FB2 | R6, R7 | Setup/deploy migration, safe preflight and postflight | FB1 |
| FB3 | R6, R7 | Isolated real-container acceptance and CI | FB1-FB2 |
| FB4 | R1-R7 | Final review and coordinated delivery | FB3 plus FamilyTraffic evidence |

FamilyTraffic owns R1-R5 and the common host-protection design. Its separate plan is in the FamilyTraffic worktree. This plan changes no FamilyTraffic code or shared-host firewall rules. FT7 and FB4 consume FT6 and FB3 acceptance evidence, not each other's final verdict. The parent closes the combined intent only after both local reconciliations pass.

## FB1. Validate and enforce loopback publication
**Files:** modify `docker-compose.yml`; create `scripts/validate_service_bindings.py`, `tests/deployment/test_service_bindings.py`.

**Interface:** `validate_service_bindings.py compose` reads rendered Compose JSON from stdin; `... runtime` reads Docker inspect JSON array. Both accept `--backend-port PORT`, default 8000, and return 0 only for the three expected loopback publications. Missing services/mappings, nonnumeric/out-of-range ports, wildcard HostIp, duplicated public mappings, and non-loopback IPv6 bindings return 1. Report only service/port/address and reason; never dump configuration or environment values.

- [ ] Add stdlib unittest fixtures for all three services, remapped valid backend port, wildcard/empty/IPv6 wildcard addresses, missing mappings, custom public override, invalid port, and duplicate unsafe mappings.

```python
def test_wildcard_database_binding_fails(self):
    candidate = self.valid_compose()
    candidate["services"]["postgres"]["ports"][0]["host_ip"] = "0.0.0.0"
    result = self.run_validator("compose", candidate)
    self.assertEqual(result.returncode, 1)
    self.assertIn("postgres", result.stderr)
```

Implement `valid_compose` and `run_validator` in this test file using JSON fixtures and subprocess. Keep this suite outside the application pytest fixture lifecycle.

- [ ] Run failing tests before implementing the validator.

```bash
python3 -m unittest discover -s tests/deployment -p 'test_service_bindings.py' -v
```

- [ ] Set exact loopback mappings in Compose. Validate rendered JSON using the active Compose implementation, including any selected overrides. Add runtime JSON handling using actual Docker HostIp/HostPort fields; require both intended mapping and absence of extra public mappings.

```yaml
ports:
  - "127.0.0.1:5432:5432"
```

Use corresponding 6379 and backend mappings in their service blocks. Do not change volume declarations or unrelated services.

- [ ] Add fixtures captured from redacted Compose output and runtime inspect. Run focused tests and Python syntax checks; expect all invalid publications to fail.

```bash
python3 -m py_compile scripts/validate_service_bindings.py
python3 -m unittest discover -s tests/deployment -p 'test_service_bindings.py' -v
```

- [ ] Commit `fix: bind internal service publications to loopback`.

## FB2. Integrate setup and deployment preflight/postflight
**Files:** modify `setup.sh`, `deploy.sh`, `scripts/lib/firewall.sh`, `scripts/lib/config.sh`, `install.sh` only where its setup/deploy entry point needs propagation; create `tests/deployment/test_publication_workflow.py`, `docs/security-service-publication.md`.

**Interfaces:** shell `validate_internal_service_publication` calls the FB1 validator on rendered Compose before any recreation. `verify_internal_service_publication` checks actual inspect JSON after service health. Both return nonzero on failure. Bash callers enable pipefail or capture each subprocess status explicitly so rendering failures cannot become success.

- [ ] Add a PATH-recording subprocess harness for Bash workflow tests. Model docker compose config, inspect, up, and health commands with redacted fixtures. Assert an external-mode flag, invalid backend port, or public override stops before up/down/recreate.

```python
def test_external_mode_stops_before_mutation(self):
    result, commands = self.run_preflight(POSTGRES_EXTERNAL_ACCESS="true")
    self.assertNotEqual(result.returncode, 0)
    self.assertFalse(any(" compose up" in item or " compose down" in item for item in commands))
```

The harness invokes sourced functions using temporary fixtures; it never executes the full destructive deploy script against the workstation.

- [ ] Remove the setup prompt and generated guidance offering direct external PostgreSQL access. Preserve reading legacy configuration only to emit an explicit migration failure when true. Explain setting false and using SSH forwarding; do not silently mutate that user's configuration.
- [ ] Replace PostgreSQL UFW-based safety claims with rendered/runtime publication checks. Do not delete unrelated operator rules. Stop creating PostgreSQL public allow rules. Preserve SSL/SSH firewall behavior.
- [ ] Insert preflight before deploy's service mutations and postflight after existing health checks. Include all actual deploy branches, not only full recreate. Check loopback TCP for 5432/6379/backend and backend health using the configured backend port. Confirm backend can connect through postgres/redis Docker service names.
- [ ] Ensure this path uses existing prebuilt images and does not trigger server builds. Remove setup recommendations to build application images on the server within the affected workflow. Fail with a missing-image diagnostic rather than silently building.
- [ ] Document migration, Docker/UFW distinction, local access, SSH forwarding, preserved Docker connectivity, and the need for external release probes. Keep existing credentials and volume lifecycle unchanged.
- [ ] Run focused workflow and validator tests; expect invalid input to fail before mutation and unsafe runtime mappings to fail postflight.

```bash
bash -n setup.sh deploy.sh install.sh scripts/lib/firewall.sh scripts/lib/config.sh
python3 -m unittest discover -s tests/deployment -v
```

- [ ] Commit `fix: verify internal service isolation during deployment`.

## FB3. Exercise real container lifecycle and wire CI
**Files:** create `tests/deployment/run_publication_lab.sh`, `tests/deployment/publication_lab.py`; modify `.github/workflows/pr-checks.yml`; extend `docs/security-service-publication.md`.

**Harness contract:** `run_publication_lab.sh` uses a unique disposable Compose project, temporary credentials, independent volumes, and prebuilt CI images. The runner rejects production container names and existing application directories. It binds test publication ports on a disposable test node, probes them from a different network namespace, and removes only resources labeled with its unique project ID. No shared databases or real credentials.

- [ ] Implement controlled snapshots for fresh config, legacy wildcard config, upgrade to loopback, and second unchanged deploy. The test follows the actual selected Compose service definitions rather than a separately maintained simplified policy.
- [ ] Verify all three services healthy, host TCP access, backend database/Redis Docker connectivity, and failed external TCP access. Record database sentinel preservation before/after recreation using a dedicated lab database; verify volume identity survives. Include configured nondefault backend port.

```python
def test_upgrade_preserves_data_and_closes_public_ports(self):
    self.lab.start_legacy()
    self.lab.write_sentinel("publication-upgrade")
    self.lab.deploy_current()
    self.lab.assert_healthy()
    self.lab.assert_loopback_and_docker_access()
    self.lab.assert_external_ports_closed()
    self.lab.assert_sentinel("publication-upgrade")
    self.lab.deploy_current()
    self.lab.assert_same_volume_ids()
```

Implement the lab methods in `publication_lab.py` with bounded waits and subprocess status checking. Missing Docker/network capability yields a required-check failure with a reason, never a passing skip.

- [ ] Add negative runs for external flag, conflicting override, missing image, failed health, and unsafe runtime mapping. Assert no volume deletion or unrelated service recreation.
- [ ] Run deployment unittest and actual lifecycle lab in CI for Compose/setup/deploy/validator changes. Use a dedicated runner namespace and CI-built images; never run this suite via SSH on ikeniborndev.

```bash
python3 -m unittest discover -s tests/deployment -v
bash tests/deployment/run_publication_lab.sh
```

- [ ] Commit `test: verify internal service isolation across deployments`.

## FB4. Final verification and delivery
- [ ] Run syntax, focused deployment checks, and real lifecycle lab first. Run existing backend integration checks with a disposable PostgreSQL service as defined in PR CI. Do not use the stale paths in tests/run-tests.sh as an assumed working command.
- [ ] Run the required full backend suite against an isolated test database and frontend suite once on the final unchanged state. Provision dependencies from existing requirements and package lock. Record prerequisites and failures; do not run database-cleaning fixtures against shared data.

```bash
python3 -m unittest discover -s tests/deployment -v
bash tests/deployment/run_publication_lab.sh
python3 -m pytest tests/ -v --tb=short
npm run test:coverage
```

The pytest command requires explicit disposable DATABASE_URL and applicable existing test configuration. Provision the database through the CI service pattern, apply migrations, and set max_locks_per_transaction=256 for partition DDL. Never substitute the shared-server URL. Existing E2E checks requiring a deployed app remain an explicit delivery check, not an inferred pass.

- [ ] Review all changed source, tests, docs, and CI paths. Obtain separate final integration review for migration/data-preservation evidence. Verify each R6/R7 acceptance row and the companion FT6 acceptance evidence.
- [ ] Run check-chain result against this plan. Prepare a PR to test linked to the FamilyTraffic master PR. Preserve repository versioning and CI conventions; identify any VERSION bump's deployment trigger before proposing publication.
- [ ] HUMAN CHECKPOINT: present the exact image identities, config changes, downtime/rollback path, and external verification method before any new rollout. Existing live loopback changes are evidence, not authorization for an unrelated release.
- [ ] Keep the durable task completion-pending until wiki delivery/lint succeeds. This plan contains expected results only; implementation has not started.
