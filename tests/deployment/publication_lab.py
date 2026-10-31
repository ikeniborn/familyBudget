#!/usr/bin/env python3
"""Run real service publication checks inside a disposable Docker daemon."""

import copy
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch
import uuid

ROOT = Path(__file__).resolve().parents[2]
LABEL = "familybudget.publication-lab"
SERVICES = ("postgres", "redis", "backend")
INHERITED_SENTINEL = "inherited-real-credential-sentinel"


class LabFailure(RuntimeError):
    pass


def render_environment():
    # Only Docker connection selectors and executable lookup come from the caller.
    env = {key: os.environ[key] for key in ("PATH", "DOCKER_HOST", "DOCKER_CONTEXT") if key in os.environ}
    env.update(POSTGRES_PASSWORD=secrets.token_hex(24), REDIS_PASSWORD=secrets.token_hex(24),
               JWT_SECRET=secrets.token_hex(32), API_INTERNAL_KEY=secrets.token_hex(32),
               POSTGRES_USER="publication_lab", POSTGRES_DB="publication_lab",
               TELEGRAM_BOT_TOKEN="123456789:" + "a" * 35, TELEGRAM_BOT_USERNAME="publication_lab_bot",
               ADMIN_TELEGRAM_ID="123456", LETSENCRYPT_EMAIL="lab@example.invalid",
               DOMAIN="localhost", BACKEND_PORT="18000", BACKUP_DIR="/lab/backups")
    return env


def validate_scope(project, workspace):
    if not re.fullmatch(r"fb-publication-[0-9a-f]{12}", project):
        raise ValueError("require a unique publication-lab project")
    workspace = workspace.resolve()
    if workspace == Path("/opt/budget") or any((workspace / p).exists() for p in (".git", "deploy.sh")):
        raise ValueError("existing application directories are forbidden")


def lab_config(rendered, project, images):
    """Retain selected service definitions; replace only lab identity and storage."""
    config = {"name": project, "services": {}, "networks": {"familybudget": {}}, "volumes": {}}
    for name in SERVICES:
        service = copy.deepcopy(rendered["services"][name])
        service.update(image=images[name], container_name=f"{project}-{name}", restart="no")
        service.setdefault("labels", {})[LABEL] = project
        service["networks"] = {"familybudget": {}}
        for index, mount in enumerate(service.get("volumes", [])):
            if mount["type"] == "bind":
                mount.update(type="volume", source=f"{name}_scratch_{index}")
                mount.pop("bind", None)
            config["volumes"][mount["source"]] = {}
        config["services"][name] = service
    return config


class PublicationLab:
    def __init__(self):
        self.project = f"fb-publication-{uuid.uuid4().hex[:12]}"
        self.temporary = tempfile.TemporaryDirectory(prefix=self.project + "-")
        self.workspace = Path(self.temporary.name)
        validate_scope(self.project, self.workspace)
        self.node = self.project + "-node"
        self.probe = self.project + "-probe"
        self.state_volume = self.project + "-docker-state"
        self.resources = []
        self.evidence = {"project": self.project, "backend_port": 18000, "checks": []}
        self.images = {name: os.environ.get(f"FB_LAB_{name.upper()}_IMAGE", f"familybudget-publication-{name}:ci") for name in SERVICES}
        self.node_image = os.environ.get("FB_LAB_NODE_IMAGE", "familybudget-publication-node:ci")
        self.probe_image = os.environ.get("FB_LAB_PROBE_IMAGE", "python:3.12-alpine")

    def run(self, args, *, timeout=180, check=True, input=None, label="lab command"):
        try:
            result = subprocess.run(args, input=input, capture_output=True, text=True, timeout=timeout, check=False)
        except (OSError, subprocess.TimeoutExpired) as error:
            raise LabFailure(f"{label}: unavailable or timed out ({type(error).__name__})") from error
        if check and result.returncode:
            raise LabFailure(f"{label}: failed with exit {result.returncode}; configuration output withheld")
        return result

    def inner(self, *args, **kwargs):
        return self.run(["docker", "exec", self.node, "docker", *args], **kwargs)

    def compose(self, *args, **kwargs):
        return self.inner("compose", "--project-name", self.project, "-f", "/lab/docker-compose.yml", *args, **kwargs)

    def shell(self, script, *, check=True):
        prefix = 'set -e; export SCRIPT_DIR=/lab DEPLOY_DIR=/lab BACKEND_PORT=18000 COMPOSE_PROJECT_NAME=' + shlex.quote(self.project) + '; source /lab/scripts/lib/utils.sh; source /lab/scripts/lib/firewall.sh; '
        return self.run(["docker", "exec", self.node, "bash", "-c", prefix + script], check=check, label="publication shell check")

    def wait(self, predicate, seconds, label):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            if predicate():
                return
            time.sleep(1)
        raise LabFailure(f"{label}: deadline exceeded ({seconds}s)")

    def bootstrap(self):
        self.run(["docker", "info"], timeout=15, label="required Docker daemon")
        image_ids = {}
        for image in set([*self.images.values(), self.node_image, self.probe_image]):
            result = self.run(["docker", "image", "inspect", "--format", "{{.Id}}", image], label="required prebuilt image")
            image_ids[image] = result.stdout.strip()
        self.evidence["images"] = image_ids
        self.run(["docker", "network", "create", "--label", f"{LABEL}={self.project}", self.project], label="isolated lab bridge")
        self.resources.append(("network", self.project))
        self.run(["docker", "volume", "create", "--label", f"{LABEL}={self.project}", self.state_volume])
        self.resources.append(("volume", self.state_volume))
        self.run(["docker", "run", "-d", "--privileged", "--name", self.node,
                  "--label", f"{LABEL}={self.project}", "--network", self.project,
                  "--mount", f"type=volume,source={self.state_volume},target=/var/lib/docker",
                  "-e", "DOCKER_TLS_CERTDIR=", self.node_image], label="isolated Docker node")
        self.resources.append(("container", self.node))
        self.wait(lambda: self.inner("info", timeout=10, check=False).returncode == 0, 90, "inner Docker/network capability")
        # Never mount the host Docker socket or host application directories.
        self.run(["docker", "exec", self.node, "mkdir", "-p", "/lab/scripts/lib"])
        for relative in ("scripts/lib/utils.sh", "scripts/lib/firewall.sh", "scripts/validate_service_bindings.py"):
            self.run(["docker", "cp", str(ROOT / relative), f"{self.node}:/lab/{relative}"])
        for image in set([*self.images.values(), self.probe_image]):
            self.load_image(image)
        self.run(["docker", "run", "-d", "--name", self.probe, "--network", self.project,
                  "--label", f"{LABEL}={self.project}", self.probe_image,
                  "python3", "-c", "import time; time.sleep(3600)"])
        self.resources.append(("container", self.probe))
        inspection = json.loads(self.run(["docker", "inspect", self.node]).stdout)[0]
        self.node_ip = inspection["NetworkSettings"]["Networks"][self.project]["IPAddress"]
        self.current = self.render()
        self.current["services"]["observer"] = {
            "image": self.probe_image, "container_name": self.project + "-observer",
            "labels": {LABEL: self.project}, "networks": {"familybudget": {}},
            "command": ["python3", "-c", "import time; time.sleep(3600)"]}
        self.write_config(self.current)

    def load_image(self, image):
        save = subprocess.Popen(["docker", "save", image], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        load = subprocess.Popen(["docker", "exec", "-i", self.node, "docker", "load"], stdin=save.stdout,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        save.stdout.close()
        try:
            load_status = load.wait(timeout=240)
            save_status = save.wait(timeout=30)
            if load_status or save_status:
                raise LabFailure("prebuilt image transfer failed")
        finally:
            for process in (save, load):
                if process.poll() is None:
                    process.kill()
                    process.wait()

    def render(self):
        env = render_environment()
        command = ["docker", "compose"]
        if self.run([*command, "version"], check=False).returncode:
            command = ["docker-compose"]
        result = subprocess.run([*command, "--env-file", "/dev/null", "-f", str(ROOT / "docker-compose.yml"), "config", "--format", "json"],
                                env=env, capture_output=True, text=True, timeout=30, check=False)
        if result.returncode:
            raise LabFailure("actual Compose service rendering failed")
        return lab_config(json.loads(result.stdout), self.project, self.images)

    def write_config(self, config):
        path = self.workspace / "lab-compose.json"
        path.write_text(json.dumps(config))
        path.chmod(0o600)
        self.run(["docker", "cp", str(path), f"{self.node}:/lab/docker-compose.yml"])

    def inspect_services(self):
        ids = self.compose("ps", "-q", *SERVICES).stdout.split()
        if not ids:
            return []
        return json.loads(self.inner("inspect", *ids).stdout)

    def assert_healthy(self):
        def healthy():
            items = self.inspect_services()
            return len(items) == 3 and all(c.get("State", {}).get("Health", {}).get("Status") == "healthy" for c in items)
        self.wait(healthy, 150, "all three service healthchecks")

    def start_fresh(self):
        self.shell("validate_internal_service_publication")
        self.compose("up", "-d", "--no-build", "postgres", "redis")
        self.wait(lambda: len(self.inspect_services()) == 2 and all(c.get("State", {}).get("Health", {}).get("Status") == "healthy" for c in self.inspect_services()), 90, "database/Redis readiness")
        self.compose("run", "--rm", "--no-deps", "-T", "backend", "-m", "alembic", "-c", "backend/db/migrations/alembic.ini", "upgrade", "head", label="isolated schema migrations")
        self.compose("up", "-d", "--no-build", "backend", "observer")
        self.assert_healthy()
        self.assert_loopback_and_docker_access()
        self.assert_external_ports(False)
        self.evidence["checks"].append("fresh-health-loopback-docker-external")

    def start_legacy(self):
        legacy = copy.deepcopy(self.current)
        for name in SERVICES:
            for port in legacy["services"][name]["ports"]:
                port["host_ip"] = "0.0.0.0"
        self.write_config(legacy)
        self.compose("up", "-d", "--no-build", "--no-deps", *SERVICES)
        self.assert_healthy()
        self.assert_external_ports(True)
        result = self.shell("verify_internal_service_publication", check=False)
        if result.returncode == 0:
            raise LabFailure("legacy wildcard runtime unexpectedly passed postflight")
        self.evidence["checks"].append("legacy-reachable-and-runtime-rejected")

    def deploy_current(self):
        self.write_config(self.current)
        self.shell("validate_internal_service_publication; mark_internal_publication_recreation; compose_cmd up -d --no-deps postgres redis backend")
        self.assert_healthy()
        self.assert_loopback_and_docker_access()
        self.assert_external_ports(False)

    def assert_loopback_and_docker_access(self):
        self.shell("verify_internal_service_publication")
        # Prove authenticated application-driver access, beyond open TCP sockets.
        program = '''import asyncio,os,asyncpg,redis.asyncio as redis
async def check():
 c=await asyncpg.connect(os.environ['DATABASE_URL'].replace('postgresql+asyncpg://','postgresql://')); assert await c.fetchval('SELECT 1')==1; await c.close()
 r=redis.from_url(os.environ['REDIS_URL']); assert await r.ping(); await r.aclose()
asyncio.run(check())'''
        self.compose("exec", "-T", "backend", "python", "-c", program, label="authenticated Docker database/Redis access")

    def assert_external_ports(self, reachable):
        program = '''import socket,sys
host=sys.argv[1]; expected=sys.argv[2]=='true'
for port in (5432,6379,18000):
 try:
  s=socket.create_connection((host,port),timeout=3); s.close(); actual=True
 except OSError: actual=False
 if actual!=expected: raise SystemExit('external probe mismatch on port '+str(port))
'''
        self.run(["docker", "exec", self.probe, "python3", "-c", program, self.node_ip, str(reachable).lower()], label="different-namespace TCP probes")

    def sql(self, query):
        return self.compose("exec", "-T", "postgres", "psql", "-U", "publication_lab", "-d", "publication_lab", "-v", "ON_ERROR_STOP=1", "-Atc", query, label="lab-only sentinel SQL").stdout.strip()

    def write_sentinel(self):
        self.sql("CREATE TABLE publication_sentinel (value text PRIMARY KEY); INSERT INTO publication_sentinel VALUES ('publication-upgrade')")

    def assert_sentinel(self):
        if self.sql("SELECT value FROM publication_sentinel") != "publication-upgrade":
            raise LabFailure("database sentinel was not preserved")

    def volume_ids(self):
        names = self.inner("volume", "ls", "-q", "--filter", f"label=com.docker.compose.project={self.project}").stdout.split()
        return sorted((v["Name"], v["CreatedAt"]) for v in json.loads(self.inner("volume", "inspect", *names).stdout))

    def container_ids(self):
        return {c["Config"]["Labels"]["com.docker.compose.service"]: c["Id"] for c in self.inspect_services()}

    def observer_id(self):
        return self.compose("ps", "-q", "observer").stdout.strip()

    def assert_negative_preflights(self):
        before, volumes, observer = self.container_ids(), self.volume_ids(), self.observer_id()
        for name in ("external-flag", "public-override", "missing-image"):
            candidate = copy.deepcopy(self.current)
            script = "validate_internal_service_publication"
            if name == "external-flag":
                script = "POSTGRES_EXTERNAL_ACCESS=true validate_internal_service_publication"
            elif name == "public-override":
                candidate["services"]["postgres"]["ports"].append({"host_ip": "0.0.0.0", "published": "15432", "target": 5432, "protocol": "tcp"})
            else:
                candidate["services"]["backend"]["image"] = self.project + "-missing:required"
            self.write_config(candidate)
            if self.shell(script, check=False).returncode == 0:
                raise LabFailure(f"negative preflight unexpectedly passed: {name}")
            if self.container_ids() != before or self.volume_ids() != volumes or self.observer_id() != observer:
                raise LabFailure(f"negative preflight mutated running resources: {name}")
            self.evidence["checks"].append(name + "-rejected-without-mutation")
        self.write_config(self.current)

    def assert_failed_health_and_recovery(self):
        volumes, observer = self.volume_ids(), self.observer_id()
        candidate = copy.deepcopy(self.current)
        # Docker inherits the image grace period when an override specifies zero.
        candidate["services"]["backend"]["healthcheck"] = {
            "test": ["CMD", "/usr/bin/python3.11", "-c", "raise SystemExit(1)"],
            "interval": "1s", "timeout": "1s", "retries": 1, "start_period": "1ms"}
        self.write_config(candidate)
        self.compose("up", "-d", "--no-build", "--no-deps", "backend")
        self.wait(lambda: any(c["Config"]["Labels"]["com.docker.compose.service"] == "backend" and c.get("State", {}).get("Health", {}).get("Status") == "unhealthy" for c in self.inspect_services()), 20, "controlled failed healthcheck")
        if self.shell("verify_internal_service_publication", check=False).returncode == 0:
            raise LabFailure("failed health unexpectedly passed postflight")
        self.deploy_current()
        self.assert_sentinel()
        if self.volume_ids() != volumes or self.observer_id() != observer:
            raise LabFailure("health failure recovery changed storage or unrelated service")
        self.evidence["checks"].append("failed-health-rejected-and-safe-config-recovered")

    def cleanup(self):
        failures = []
        for kind, name in reversed(self.resources):
            result = self.run(["docker", kind, "inspect", name] if kind != "container" else ["docker", "inspect", name], check=False)
            if result.returncode:
                failures.append(name + ": cannot verify cleanup ownership")
                continue
            value = json.loads(result.stdout)[0]
            labels = value.get("Config", {}).get("Labels", {}) if kind == "container" else value.get("Labels", {})
            if labels.get(LABEL) != self.project:
                failures.append(name + ": cleanup ownership mismatch")
                continue
            args = ["docker", "rm", "-f", name] if kind == "container" else ["docker", kind, "rm", name]
            if self.run(args, check=False).returncode:
                failures.append(name + ": cleanup failed")
        self.temporary.cleanup()
        if failures:
            raise LabFailure("; ".join(failures))


class PublicationAcceptanceTests(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(os.environ, {key: INHERITED_SENTINEL for key in (
            "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "ADMIN_PASSWORD", "VAPID_PRIVATE_KEY",
            "TELEGRAM_WEBHOOK_URL", "TELEGRAM_PROXY_URL")})
        environment.start()
        self.addCleanup(environment.stop)

    def test_fresh_upgrade_repeat_and_failure_guards(self):
        lab = PublicationLab()
        try:
            lab.bootstrap()
            if INHERITED_SENTINEL in json.dumps(lab.current):
                raise LabFailure("rendered services inherited caller credentials")
            lab.start_fresh()
            if INHERITED_SENTINEL in json.dumps(lab.inspect_services()):
                raise LabFailure("running services inherited caller credentials")
            lab.evidence["checks"].append("caller-credentials-absent-from-render-and-containers")
            lab.start_legacy()
            lab.write_sentinel()
            volumes, observer = lab.volume_ids(), lab.observer_id()
            lab.deploy_current()
            lab.assert_sentinel()
            self.assertEqual(lab.volume_ids(), volumes)
            self.assertEqual(lab.observer_id(), observer)
            lab.evidence["checks"].append("upgrade-preserved-sentinel-volumes-and-unrelated-service")
            containers = lab.container_ids()
            lab.deploy_current()
            lab.assert_sentinel()
            self.assertEqual(lab.container_ids(), containers)
            self.assertEqual(lab.volume_ids(), volumes)
            lab.evidence.update(volume_identity=volumes, repeat_container_ids=containers,
                                unrelated_container_id=observer, preserved_sentinel="publication-upgrade")
            lab.evidence["checks"].append("repeat-deploy-idempotent")
            lab.assert_negative_preflights()
            lab.assert_failed_health_and_recovery()
            print(json.dumps(lab.evidence, sort_keys=True))
        finally:
            lab.cleanup()


if __name__ == "__main__":
    unittest.main(verbosity=2)
