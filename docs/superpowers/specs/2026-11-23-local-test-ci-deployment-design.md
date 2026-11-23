---
review:
  spec_hash: "d16b9a836f7e3902"
  last_run: 2026-11-23
  phases:
    structure: { status: passed }
    coverage: { status: passed }
    clarity: { status: passed }
    consistency: { status: passed }
  findings: []
chain:
  intent: docs/superpowers/intents/2026-11-23-local-test-ci-deployment-intent.md
---
# Shared FamilyBudget test deployment on Mini PC

## Acceptance (from intent)

- Testers can open https://fbd.ikeniborn.ru with a trusted certificate and use a test account.
- A tester can register a test passkey, sign out, and sign back in with it. A tester can open the Mini App from a dedicated test Telegram bot on a phone and authenticate.
- After manual acceptance, a successful push to the test branch that changes VERSION results in a Mini PC deployment of the corresponding verified GHCR images. A push without a VERSION change leaves the deployed release unchanged.
- A successful deployment passes an HTTP health check on Mini PC. Local backend integration tests use a disposable PostgreSQL instance. Frontend tests run locally against their intended test configuration.

Done when: fbd serves trusted HTTPS, passkey and Telegram sign-in work on test accounts, a VERSION-changing push updates the deployed release, a push without that change leaves it unchanged, and existing service probes match baseline.

## Release source and CI

Use IMAGE_VERSIONS.json from the latest fetched origin/test. Resolve origin/test to a commit once per poll and use that snapshot for all eligibility reads. Keep the four existing top-level service keys and version fields so current consumers can read the file. Record each service image digest alongside its version.

After checks pass on a VERSION-changing push, publish the release metadata as a metadata-only commit on test. Record the tested source SHA, Actions run ID, run attempt, and VERSION in the metadata commit trailers. Publish with a compare-and-swap update of the expected branch head. If test has advanced, permit publication only when the tested source SHA is an ancestor of that head and both VERSION and the prior IMAGE_VERSIONS.json are unchanged. If either file changed, stop publication and let the eligible newer run publish the next release. A VERSION-changing run can publish this commit when it reuses all four images.

The Mini PC verifies a successful push run of the expected workflow and attempt on test. It checks the recorded source SHA and VERSION against the commit, and verifies that the metadata-only commit is in the fetched history. Later non-release commits may follow it. Deploy the latest verified metadata whose manifest and VERSION still match the fetched files. Skip deployments while a newer VERSION is present without matching successful metadata. Skip the currently applied release and older releases. Consume GHCR references by recorded digest. Do not run branch scripts on Mini PC.

## Mini PC runtime and ingress

Use a separate Compose project and directory, private PostgreSQL and Redis, newly allocated volumes, and test credentials. Reserve a subnet after checking current Docker networks and LAN and VPN routes. Use resource limits, no host-published backend, database, or Redis ports, and one deployment at a time. Connect only the backend to the shared proxy-net with a unique alias for routing.

Start from the GHCR images. Run migrations with the repository PostgreSQL lock setting. Verify container-local health before publishing the route. Add one Traefik file for the exact fbd hostname and the existing certificate resolver. Keep shared static configuration, public entry points, and the production delivery path intact.

Use the fbd origin and relying-party ID for WebAuthn. Configure the dedicated test bot to open the fbd Mini App. Keep test sign-in independent of production accounts and tokens. Use synthetic data for the public staging application and disposable data for integration tests.

## Rollout and recovery

Capture the Homepass, Grafana, Jellyfin, MinIO, Nextcloud, and iwiki probe baselines, including expected HTTP and TLS results. Record Traefik start time and restart count. Repeat these checks after route activation. Make the public route, test bot, and manual passkey and Telegram acceptance a checkpoint before enabling automatic delivery.

Prepare the candidate images before touching the current release. Serialize deployment and recovery, stop application writes for the database backup, and validate the backup before migrations. Keep the current and previous applied manifests and image sets locally. Mark the candidate applied only after migration and HTTP health pass. On failure, restore the last healthy image set and restore the matching database backup if migrations ran. Keep the affected test services stopped and escalate if restoration or health verification fails.

If an existing service probe regresses after route activation, remove the fbd route and recheck the baseline. Roll back only fbd resources. The production workflow and its deployment target stay intact. Switch off the legacy test SSH delivery after the new test delivery passes acceptance.

## Verification

- A passing VERSION-changing run deploys its recorded digest set. A failed, superseded, or manually dispatched run cannot deploy. A push without a VERSION change cannot replace the applied release.
- Simulate two adjacent pushes. With a newer VERSION or changed manifest, the old run must fail publication. With an unrelated follow-up commit, it may publish metadata still bound to the tested source. The Mini PC never combines images from separate runs.
- Force migration and health failures in a disposable environment. Verify that the previous images and matching database state can serve health again. Verify that the failure stays visible and the failed candidate is not applied.
- On Mini PC, confirm database and Redis port isolation, migrations, health, frontend tests under the intended configuration, and backend tests against disposable PostgreSQL.
- Verify the public certificate, passkey registration and repeated login, and phone-based Telegram Mini App authentication. Compare the existing service probes and Traefik state with the baseline.
