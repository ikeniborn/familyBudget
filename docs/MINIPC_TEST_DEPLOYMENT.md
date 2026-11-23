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
