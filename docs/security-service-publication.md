# Internal service publication

PostgreSQL publishes `127.0.0.1:5432:5432`. Redis publishes `127.0.0.1:6379:6379`.
The backend publishes `127.0.0.1:${BACKEND_PORT:-8000}:8000`.
Set `BACKEND_PORT` to a numeric TCP port from 1 through 65535.
Docker peers retain the `postgres`, `redis`, and `backend` service names and existing networks.
Public frontend ports, credentials, and volume declarations remain unchanged.

## Migration

1. Back up the deployment configuration and record the current image identities.
2. If `.env` contains `POSTGRES_EXTERNAL_ACCESS=true`, change it explicitly to `false`.
3. Replace direct remote database administration with SSH forwarding.
4. Review the rendered Compose configuration, including selected overrides.
5. Deploy prebuilt CI images through the existing deployment script.
6. Verify runtime mappings, health, loopback access, and Docker connectivity.
7. Run external TCP probes from a different host before declaring release acceptance.

Setup and deployment reject the legacy external-access flag before container mutation.
They do not silently rewrite an existing external-access setting.
Deployment requests recreation of internal services when existing bindings violate the policy.
The migration preserves their attached volumes. A second unchanged deployment requests no
additional publication-related recreation. Existing operator-selected cleanup and global
restart modes retain their original behavior; select the established data-preserving mode.
This change does not authorize volume deletion.

## Local and remote administration

On the server, connect database tools to `127.0.0.1:5432`.
For remote administration, create an SSH tunnel:

```bash
ssh -N -L 15432:127.0.0.1:5432 your-server
```

Connect the database client to `127.0.0.1:15432` with the existing credentials.
For the basic deployment profile, access the backend on server loopback or forward its
configured port through SSH. Public frontend access continues through the full profile.

## Deployment checks

`validate_internal_service_publication` validates the actual rendered Compose JSON.
It rejects missing, additional, wildcard, or non-loopback mappings, invalid backend ports,
build overrides, renderer errors, and missing prebuilt images. Image availability is checked
after the normal registry pull and before repair, cleanup, or container recreation.
An earlier configuration-only check runs immediately after code synchronization.

The Compose wrapper honors `COMPOSE_FILE` and `COMPOSE_PATH_SEPARATOR`. Without an explicit
selection, it uses `docker-compose.yml` and the first existing standard override file.
Rendering and startup use the same selection. Startup adds `--no-build`.
Setup does not build application images on the server.

After service health checks, `verify_internal_service_publication` checks Docker inspect
bindings, all three health statuses, TCP access to each host-loopback port, the backend
health endpoint on the configured port, and backend TCP access through `postgres` and `redis`.
A failed check returns a failed deployment. Both detached and foreground modes complete
the phased startup and verification. Foreground mode then follows service logs;
stopping log streaming leaves services running.

Docker port forwarding can bypass UFW INPUT rules. UFW output is not evidence that a
published database port is isolated. Deployment no longer flushes the shared `DOCKER-USER`
chain or creates/deletes PostgreSQL UFW rules. Existing operator rules are preserved.
SSL and SSH firewall behavior remains separate from publication validation.

## Release and rollback evidence

Before rollout, review the exact image identities, Compose diff, expected internal-service
restart window, backups, and rollback commands. Do not build images on the target server.
Reattach the existing volumes when restoring compatible images and configuration.
Restoring an old wildcard Compose configuration restores exposure; report that degraded
state and keep the release failed. Do not claim successful isolation after such a rollback.

An external host must fail to connect to server ports 5432, 6379, and the configured backend
port. Host and Docker probes must succeed independently. Missing external verification
remains pending; passing local checks cannot substitute for it.

## Focused verification

Run the isolated shell and validator fixtures without application database fixtures:

```bash
python3 -m unittest discover -s tests/deployment -v
bash -n setup.sh deploy.sh install.sh scripts/lib/firewall.sh scripts/lib/config.sh scripts/lib/utils.sh
```

The recorded runtime JSON fixture came from disposable Alpine containers, with backend
publication remapped to 18000. It verifies Docker inspect parsing, not application health
or external network isolation. The lifecycle acceptance lab supplies that separate evidence.
