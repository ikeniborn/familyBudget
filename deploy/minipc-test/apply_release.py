"""Poll a fixed test snapshot and apply a verified release to the dedicated Mini PC stack."""

import argparse
import fcntl
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

STACK = Path("/opt/familybudget-test")
BACKEND = "familybudget-test-backend"
SERVICES = {"backend": BACKEND, "bot": "bot", "postgresql": "postgres", "redis": "redis"}
REPO = "https://github.com/ikeniborn/familyBudget.git"


def atomic_write(path, data):
    """Durably replace a private file, including its directory entry."""
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temp:
        try:
            temp.write(data)
            temp.flush()
            os.fsync(temp.fileno())
            os.replace(temp.name, path)
            sync_dir(path.parent)
        finally:
            Path(temp.name).unlink(missing_ok=True)


def sync_dir(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


class Runtime:
    def __init__(self, root, project="familybudget-test", ingress="proxy-net"):
        self.root = root
        self.project = project
        self.ingress = ingress
        self.state = root / "release-state"

    def compose(self, *args, images=None, private=False, **kwargs):
        cmd = ["docker-compose", "--project-directory", str(self.root), "-p", self.project,
               "--env-file", str(self.root / ".env"), "-f", str(self.root / "compose.yaml"),
               "-f", str(self.root / "compose.telegram-proxy.yaml")]
        if private:
            cmd.extend(["-f", str(self.state / "private.yaml")])
        env = os.environ.copy()
        for key in SERVICES:
            env.pop(key.upper() + "_IMAGE", None)
        env.update({key.upper() + "_IMAGE": ref for key, ref in (images or {}).items()})
        return run(*cmd, *args, env=env, **kwargs)

    def container(self, service):
        return self.compose("ps", "-q", service, capture_output=True, text=True).stdout.strip()

    def baseline(self):
        """Trust the first baseline only after checking all four running, pinned images."""
        images = {}
        for key, service in SERVICES.items():
            container = self.container(service)
            ref, health = run("docker", "inspect", "-f", "{{.Config.Image}} {{.State.Health.Status}}",
                              container, capture_output=True, text=True).stdout.split()
            if health != "healthy" or not re.fullmatch(
                rf"ghcr\.io/ikeniborn/familybudget-{key}@sha256:[0-9a-f]{{64}}", ref
            ):
                raise RuntimeError(f"{service} requires a healthy, digest-pinned baseline")
            images[key] = ref
        return images

    def pull(self, images):
        for image in images.values():
            run("docker", "pull", image)

    def stop(self):
        self.compose("stop", "bot", BACKEND)
        # A killed Compose client can leave its one-off migration running.
        name = self.project + "-release-migrate"
        found = run("docker", "ps", "-aq", "--filter", f"name=^/{name}$",
                    capture_output=True, text=True).stdout.strip()
        if found:
            labels = json.loads(run("docker", "inspect", "-f", "{{json .Config.Labels}}",
                                    found, capture_output=True, text=True).stdout)
            if (labels.get("com.docker.compose.project") != self.project or
                    labels.get("com.docker.compose.service") != BACKEND):
                raise RuntimeError("Migration container name belongs to a different workload")
            run("docker", "rm", "-f", found)

    def backup(self, target, images):
        partial = target.with_suffix(".partial")
        with partial.open("wb") as stream:
            self.compose("exec", "-T", "postgres", "pg_dump", "-U", "familybudget",
                         "-d", "familybudget", "-Fc", stdout=stream)
            stream.flush()
            os.fsync(stream.fileno())
        # Decode the complete archive without network connectivity or a running database.
        with partial.open("rb") as stream:
            run("docker", "run", "--rm", "-i", "--network", "none", "--entrypoint", "pg_restore",
                images["postgresql"], "--file=/dev/null", stdin=stream)
        os.replace(partial, target)
        sync_dir(target.parent)

    def storage(self, images):
        self.compose("up", "-d", "--wait", "--wait-timeout", "150", "--no-deps",
                     "postgres", "redis", images=images)

    def migrate(self, images):
        self.compose("run", "-T", "--rm", "--no-deps", "--name", self.project + "-release-migrate",
                     BACKEND, "-m", "alembic", "-c", "backend/db/migrations/alembic.ini",
                     "upgrade", "head", images=images)

    def restore(self, target):
        # Recreate this database so that new objects absent from the dump also disappear.
        with target.open("rb") as stream:
            self.compose("exec", "-T", "postgres", "pg_restore", "--exit-on-error",
                         "--clean", "--if-exists", "--create", "-U", "familybudget",
                         "-d", "postgres", stdin=stream)

    def check_backend(self, images):
        override = f"services:\n  {BACKEND}:\n    networks: !override\n      private:\n        aliases: [backend]\n"
        atomic_write(self.state / "private.yaml", override.encode())
        # Docker retains manually attached networks on a stopped container.
        # Rebuild the quiesced backend even when both release digests match.
        self.compose("rm", "--stop", "--force", BACKEND)
        self.compose("up", "-d", "--wait", "--wait-timeout", "180", "--no-deps", BACKEND,
                     images=images, private=True)
        self.compose("exec", "-T", BACKEND, "/usr/bin/python3.11", "/app/healthcheck.py", images=images)
        self.compose("run", "-T", "--rm", "--no-deps", "bot", "/app/healthcheck.py", images=images)

    def activate(self, images):
        # Ordinary manual Compose operations must also use the newly applied digests.
        env_path = self.root / ".env"
        env = env_path.read_bytes()
        for key, ref in images.items():
            name = key.upper().encode() + b"_IMAGE"
            env, count = re.subn(rb"(?m)^" + name + rb"=[^\r\n]*",
                                 name + b"=" + ref.encode(), env)
            if count != 1:
                raise RuntimeError("Expected exactly one " + name.decode() + " in .env")
        atomic_write(env_path, env)
        # Recover a stopped committed backend after a machine reboot.
        self.storage(images)
        self.compose("up", "-d", "--wait", "--wait-timeout", "180", "--no-deps", BACKEND,
                     images=images, private=True)
        container = self.container(BACKEND)
        networks = json.loads(run("docker", "inspect", "-f", "{{json .NetworkSettings.Networks}}",
                                  container, capture_output=True, text=True).stdout)
        if self.ingress not in networks:
            run("docker", "network", "connect", "--alias", BACKEND, self.ingress, container)
        self.compose("up", "-d", "--wait", "--wait-timeout", "150", "--no-deps", "bot", images=images)


class Deployment:
    def __init__(self, directory, runtime):
        self.directory = directory
        self.path = directory / "release.json"
        self.runtime = runtime
        self.boot_id = Path("/proc/sys/kernel/random/boot_id").read_text().strip()

    def read(self):
        return (json.loads(self.path.read_text()) if self.path.exists()
                else {"current": None, "previous": None, "phase": "idle"})

    def save(self, state, **updates):
        state.update(updates)
        atomic_write(self.path, (json.dumps(state, indent=2) + "\n").encode())

    def activate(self, state):
        self.runtime.activate(state["current"]["images"])
        self.save(state, phase="idle", candidate=None, needs_restore=False, boot_id=self.boot_id)

    def recover(self, state):
        old = state["current"]["images"]
        try:
            self.runtime.stop()
            self.runtime.storage(old)
            if state["needs_restore"]:
                self.runtime.restore(self.directory / "rollback.dump")
            self.runtime.check_backend(old)
        except Exception:
            self.save(state, phase="blocked")
            self.runtime.stop()
            raise
        self.save(state, phase="activate", needs_restore=False, failed=state["candidate"]["metadata_sha"])
        self.activate(state)

    def resume(self, manual=False):
        state = self.read()
        if state["phase"] == "idle":
            if state["current"] and state.get("boot_id") != self.boot_id:
                self.save(state, phase="activate")
                self.activate(state)
            return
        if state["phase"] == "activate":
            self.activate(state)
        elif state["phase"] == "pending" or (manual and state["phase"] == "blocked"):
            self.recover(state)
        else:
            raise RuntimeError("Manual recovery required; writers remain stopped")

    def apply(self, release, retry=False):
        state = self.read()
        if state["phase"] != "idle":
            raise RuntimeError("Pending recovery must finish before another deploy")
        if state["current"] and release["metadata_sha"] == state["current"].get("metadata_sha"):
            return
        if not retry and state.get("failed") == release["metadata_sha"]:
            raise RuntimeError("Candidate previously failed; inspect the journal before retrying")
        old = {"images": self.runtime.baseline()}
        if state["current"] and state["current"]["images"] != old["images"]:
            raise RuntimeError("Running images differ from the recorded release")
        self.runtime.pull(release["images"])
        old = state["current"] or old
        self.save(state, current=old, candidate=release, phase="pending", needs_restore=False)
        try:
            self.runtime.stop()
            self.runtime.backup(self.directory / "rollback.dump", old["images"])
            self.runtime.storage(release["images"])
            self.save(state, needs_restore=True)
            self.runtime.migrate(release["images"])
            self.runtime.check_backend(release["images"])
        except Exception:
            self.recover(state)
            raise
        # The HTTP check passed on a private network. Persist this decision before
        # admitting traffic. Retries beyond this point must preserve subsequent writes.
        self.save(state, current=release, previous=old, phase="activate", needs_restore=False, failed=None)
        self.activate(state)


def poll(directory, tx, retry):
    mirror = directory / "source.git"
    if not mirror.exists():
        run("git", "init", "--bare", str(mirror))
    run("git", "-C", str(mirror), "fetch", "--no-tags", REPO, "refs/heads/test:refs/remotes/origin/test")
    snapshot = run("git", "-C", str(mirror), "rev-parse", "refs/remotes/origin/test^{commit}", text=True, capture_output=True).stdout.strip()
    args = [sys.executable, str(Path(__file__).with_name("release_metadata.py")),
            "--repo", str(mirror), "--snapshot", snapshot]
    applied = (tx.read()["current"] or {}).get("metadata_sha")
    if applied:
        args.extend(["--applied", applied])
    result = subprocess.run(args, stdout=subprocess.PIPE, text=True)
    if result.returncode == 3:
        return
    result.check_returncode()
    tx.apply(json.loads(result.stdout), retry=retry)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--recover", action="store_true", help="Retry a failed restore and stop after recovery")
    cli.add_argument("--retry", action="store_true", help="Poll and retry a previously rolled-back candidate")
    args = cli.parse_args()
    os.umask(0o077)
    runtime = Runtime(STACK)
    runtime.state.mkdir(mode=0o700, exist_ok=True)
    with (runtime.state / "deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        tx = Deployment(runtime.state, runtime)
        tx.resume(manual=args.recover)
        if not args.recover:
            poll(runtime.state, tx, args.retry)


if __name__ == "__main__":
    main()
