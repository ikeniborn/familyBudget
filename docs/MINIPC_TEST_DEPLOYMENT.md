# Mini PC FamilyBudget test environment

The test environment uses the `familybudget-test` Compose project. Its PostgreSQL
and Redis services stay in the project network. The backend has the
`familybudget-test-backend` alias on the existing Traefik `proxy-net`. Compose
publishes no host ports. The fixed public origin is `https://fbd.ikeniborn.ru`.

## Prepare the isolated runtime

1. Check current Docker, LAN, and VPN routes before assigning the test subnet.
2. Record the HTTP status and TLS result for Homepass, Grafana, Jellyfin, MinIO,
   Nextcloud, and iwiki. Record Traefik's start time and restart count.
3. Copy the Compose file and environment template to `/opt/familybudget-test`.
4. Fill the environment file with the approved digest-pinned images and dedicated
   test credentials. Protect the file with mode `0600`.
5. Run the following commands from that directory. Use `docker compose` on hosts
   where Compose is installed as a Docker CLI plugin.

```bash
docker-compose config --quiet
docker-compose up -d --wait postgres redis
docker-compose run -T --rm --no-deps familybudget-test-backend -m alembic -c backend/db/migrations/alembic.ini upgrade head
docker-compose up -d --wait familybudget-test-backend
docker-compose exec -T familybudget-test-backend python /app/healthcheck.py
```

The database and Redis volumes persist. Backend logs, uploads, and the in-container
backup path are temporary. Keep deployment recovery backups outside the containers.

## Activate the route

1. Confirm backend health before installing `deploy/minipc-test/traefik/fbd.yml`
   in the existing Traefik file-provider directory.
2. Confirm that the fbd certificate is trusted and that `/health` returns
   HTTP 200. Repeat the existing-service checks and compare Traefik state.
3. Configure the dedicated Telegram test bot for the fbd Mini App. Start the bot
   service after its credentials and Mini App URL are ready. On Mini PC, install
   the Telegram proxy override beside the base Compose file. Pass both files
   when starting the bot.

```bash
docker-compose -f compose.yaml -f compose.telegram-proxy.yaml up -d --no-deps bot
```

The override grants only the bot access to the existing outbound proxy bridge.
The bot sends Telegram API traffic through that proxy. The private project
network retains its default gateway.
Use test accounts to verify passkey registration, sign-out, passkey sign-in,
and Mini App authentication from a phone.

If activation regresses an existing service, remove the fbd dynamic file and
repeat the baseline probes. If required, stop only the `familybudget-test`
Compose project. Preserve its volumes for diagnosis and recovery.

## Install the release poller

Use the same unprivileged host account that owns the stack, can run Docker, and
has read access to Actions run and attempt information through the GitHub CLI.
The host needs Python 3, Git, gh, Docker, a systemd user manager, and Compose
with support for the `!override` tag. The recovery drill ran on Compose 2.36.2. Confirm that all four running services use the expected image
digests and report healthy. Keep one explicit assignment per image in the
private `.env` file.

Install scripts from the reviewed checkout. Run these commands at the repository
root. Update the trusted copies explicitly when the deployment code changes.
The poller fetches Git objects into a bare repository and reads release metadata.
It never checks out or executes application scripts from that repository.

```bash
install -d -m 0700 /opt/familybudget-test/bin
install -m 0600 deploy/minipc-test/apply_release.py deploy/minipc-test/release_metadata.py /opt/familybudget-test/bin/
install -d -m 0700 ~/.config/systemd/user
install -m 0600 deploy/minipc-test/systemd/familybudget-test-deploy.service deploy/minipc-test/systemd/familybudget-test-deploy.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemd-analyze --user verify ~/.config/systemd/user/familybudget-test-deploy.service ~/.config/systemd/user/familybudget-test-deploy.timer
```

After the passkey and Telegram checks, existing-service probe comparison,
and recovery drill succeed, enable the timer. Use a persistent user manager
on hosts where releases must be checked while the operator is logged out.

```bash
systemctl --user enable --now familybudget-test-deploy.timer
systemctl --user list-timers familybudget-test-deploy.timer
journalctl --user -u familybudget-test-deploy.service -n 80 --no-pager
```

## Apply and recover a release

A local file lock serializes polling, apply and recovery. Coordinate manual
Compose changes with the poller. Each poll fetches one test SHA. The verifier
checks its source, version, four image digests, and successful Actions attempt.
The host pulls candidate images before stopping writers.

During rollout the bot and public backend stop. PostgreSQL produces a custom
archive of the dedicated test database. A network-isolated pg_restore process
decodes the complete archive before migration. Keep space available in
`/opt/familybudget-test/release-state` for the current and next backup.
Backend uploads use tmpfs; finish any staged file parsing before a release.

The candidate backend passes its HTTP health check on the private network. The
bot image passes its local check. The journal records this release and its
previous image set before admitting test traffic. Activation persists all four
image assignments in the stack's `.env`, reconnects the backend to ingress, and
starts the bot with its existing proxy override. A post-commit interruption
resumes activation, preserving writes made after traffic resumed. After a host
reboot, the first poll starts the recorded release before fetching new metadata.

A pre-commit failure restores the previous images. When a migration may have
run, recovery recreates the dedicated test database from the validated dump,
then verifies the restored backend before reopening the route. An interrupted
poll resumes its journal before checking GitHub. After a successful rollback
the same failed metadata SHA stays quarantined. An unsuccessful restore leaves
application writers stopped and the durable phase set to `blocked`.

Read `release-state/release.json` and the unit journal on the host. After fixing
the cause of a failed restore, run the first command below to retry recovery.
After addressing the cause of a rolled-back candidate, use the second command
to retry the currently verified release.

```bash
python3 /opt/familybudget-test/bin/apply_release.py --recover
python3 /opt/familybudget-test/bin/apply_release.py --retry
```

The recovery drill uses a temporary, uniquely named Compose project, synthetic
records, a private database, and its own ingress network. Set
`MINIPC_RECOVERY_TEST_CIDR` to an available CIDR if Docker's automatic subnet
pools are exhausted. Check current Docker, LAN and VPN routes before choosing it.
Run the drill from the repository root.

```bash
MINIPC_RECOVERY_DOCKER=1 python3 -m unittest discover -s tests/deployment -p test_minipc_test_recovery.py
```
