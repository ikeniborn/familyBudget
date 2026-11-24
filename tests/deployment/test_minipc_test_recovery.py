"""Test release transaction boundaries independently of GitHub and the shared stand."""
import ipaddress
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(HERE / "deploy/minipc-test"))
import apply_release as deploy  # noqa: E402


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.runtime = Mock()
        self.old = {"images": {"backend": "old"}}
        self.new = {"metadata_sha": "a" * 40, "images": {"backend": "new"}}
        self.runtime.baseline.return_value = self.old["images"]
        self.tx = deploy.Deployment(Path(self.tmp.name), self.runtime)

    def test_duplicate_skips_all_runtime_changes(self):
        self.tx.apply(self.new)
        self.runtime.reset_mock()
        self.tx.apply(self.new)
        self.assertEqual(self.runtime.mock_calls, [])

    def test_pull_failure_keeps_current_running(self):
        self.runtime.pull.side_effect = RuntimeError("pull failed")
        with self.assertRaisesRegex(RuntimeError, "pull failed"):
            self.tx.apply(self.new)
        self.runtime.stop.assert_not_called()
        self.assertNotEqual(self.tx.read()["current"], self.new)

    def test_migration_and_health_failures_restore_previous_images_and_database(self):
        for step in ("migrate", "check_backend"):
            with self.subTest(step=step), tempfile.TemporaryDirectory() as tmp:
                runtime = Mock()
                runtime.baseline.return_value = self.old["images"]
                getattr(runtime, step).side_effect = [RuntimeError(step), None]
                tx = deploy.Deployment(Path(tmp), runtime)
                with self.assertRaisesRegex(RuntimeError, step):
                    tx.apply(self.new)
                runtime.restore.assert_called_once()
                runtime.activate.assert_called_once_with(self.old["images"])
                self.assertEqual(tx.read()["current"], self.old)
                self.assertEqual(tx.read()["failed"], self.new["metadata_sha"])

    def test_failed_restore_leaves_writers_stopped_and_requires_recovery(self):
        self.runtime.migrate.side_effect = RuntimeError("migration")
        self.runtime.restore.side_effect = RuntimeError("bad restore")
        with self.assertRaisesRegex(RuntimeError, "bad restore"):
            self.tx.apply(self.new)
        self.assertEqual(self.tx.read()["phase"], "blocked")
        self.runtime.activate.assert_not_called()
        self.runtime.reset_mock()
        with self.assertRaisesRegex(RuntimeError, "Manual recovery"):
            self.tx.resume()
        self.runtime.restore.assert_not_called()

    def test_interrupted_migration_rolls_back_on_next_poll(self):
        self.runtime.migrate.side_effect = KeyboardInterrupt()
        with self.assertRaises(KeyboardInterrupt):
            self.tx.apply(self.new)
        self.tx.resume()
        self.runtime.restore.assert_called_once()
        self.assertEqual(self.tx.read()["current"], self.old)

    def test_post_commit_recovery_never_rewinds_accepted_writes(self):
        self.runtime.activate.side_effect = [RuntimeError("network unavailable"), None]
        with self.assertRaisesRegex(RuntimeError, "network unavailable"):
            self.tx.apply(self.new)
        self.tx.resume()
        self.runtime.restore.assert_not_called()
        self.assertEqual(self.tx.read()["current"], self.new)
        self.assertEqual(self.tx.read()["previous"], self.old)

    def test_new_host_boot_starts_the_committed_release_without_migrating(self):
        self.tx.apply(self.new)
        self.runtime.reset_mock()
        self.tx.boot_id = "new-boot"
        self.tx.resume()
        self.runtime.activate.assert_called_once_with(self.new["images"])
        self.runtime.restore.assert_not_called()
        self.runtime.migrate.assert_not_called()
        self.runtime.reset_mock()
        self.tx.resume()
        self.runtime.activate.assert_not_called()

    def test_poller_uses_one_fetched_snapshot_and_skips_absent_release(self):
        root = Path(self.tmp.name)
        (root / "source.git").mkdir()
        tx = Mock()
        tx.read.return_value = {"current": {"metadata_sha": "b" * 40}}
        fetched = "c" * 40
        with patch.object(deploy, "run", side_effect=[None, Mock(stdout=fetched + "\n")]) as git, \
                patch.object(subprocess, "run", return_value=Mock(returncode=3)) as verifier:
            deploy.poll(root, tx, False)
        self.assertEqual(len(git.call_args_list), 2)
        self.assertIn("refs/heads/test:refs/remotes/origin/test", git.call_args_list[0].args)
        cli = verifier.call_args.args[0]
        self.assertEqual(cli[-4:], ["--snapshot", fetched, "--applied", "b" * 40])
        tx.apply.assert_not_called()

    def test_backup_failure_never_runs_migration_or_restore(self):
        self.runtime.backup.side_effect = RuntimeError("truncated")
        with self.assertRaisesRegex(RuntimeError, "truncated"):
            self.tx.apply(self.new)
        self.runtime.restore.assert_not_called()
        self.runtime.migrate.assert_not_called()
        self.runtime.activate.assert_called_once_with(self.old["images"])


@unittest.skipUnless(os.environ.get("MINIPC_RECOVERY_DOCKER") == "1",
                     "Set MINIPC_RECOVERY_DOCKER=1 to run the isolated Docker recovery drill")
class DockerRecoveryTest(unittest.TestCase):
    def test_failed_migration_restores_rows_removes_new_objects_and_serves_previous_image(self):
        import uuid

        # Pinned public GHCR baseline, independent credentials, network, database and volumes.
        digests = {
            "backend": "402b251624b6e664c19b727ba413e2879573f16e91294a3fc8e0f5c189993974",
            "bot": "f58c024ac2efd46bff8af872b8601d334f959df9eb22a0cc95aa05bcc663423d",
            "redis": "b76f40bb70dc704d5aadad8c25ae0484f8999453fae8e29a5bd0888421b6ede0",
            "postgresql": "753727d9a22ab80feafb6f0035115e816c1edf91f4e0bce907d7670d61a646ee",
        }
        old = {k: f"ghcr.io/ikeniborn/familybudget-{k}@sha256:{v}" for k, v in digests.items()}
        new = dict(old, backend="ghcr.io/ikeniborn/familybudget-backend@sha256:"
                                "aa2d83e2880c650e5bca36bf8d516982dbdb7beaba63ac32d78209ed286e896a")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            name = "fb-release-qa-" + uuid.uuid4().hex[:10]
            runtime = deploy.Runtime(root, project=name, ingress=name + "-ingress")
            runtime.state.mkdir()
            (root / ".env").write_text("".join(f"{k.upper()}_IMAGE={v}\n" for k, v in old.items()))
            # Explicit test images can be pulled once before an offline drill.
            for image in set(old.values()) | set(new.values()):
                try:
                    deploy.run("docker", "image", "inspect", "--format", "{{.Id}}", image, capture_output=True)
                except subprocess.CalledProcessError:
                    deploy.run("docker", "pull", image)
            runtime.pull = lambda images: None
            (root / "compose.telegram-proxy.yaml").write_text("services: {}\n")
            (root / "health").write_text("ok")
            (root / "bot_check.py").write_text("pass")
            # On hosts with exhausted auto-address pools, use an operator-checked test-only CIDR.
            pool = os.environ.get("MINIPC_RECOVERY_TEST_CIDR")
            private_ipam = ingress_ipam = ""
            if pool:
                private, ingress = ipaddress.ip_network(pool).subnets(prefixlen_diff=1)
                private_ipam = f"    ipam: {{config: [{{subnet: {private}}}]}}"
                ingress_ipam = f"    ipam: {{config: [{{subnet: {ingress}}}]}}"
            (root / "compose.yaml").write_text(f"""services:
  postgres:
    image: ${{POSTGRESQL_IMAGE}}
    environment: {{POSTGRES_DB: familybudget, POSTGRES_USER: familybudget, POSTGRES_PASSWORD: qa}}
    volumes: [data:/var/lib/postgresql/data]
    networks: [private]
    healthcheck:
      test: [CMD, pg_isready, -h, '127.0.0.1', -U, familybudget]
      interval: 1s
      retries: 30
  redis:
    image: ${{REDIS_IMAGE}}
    networks: [private]
    healthcheck:
      test: [CMD, redis-cli, ping]
      interval: 1s
  familybudget-test-backend:
    image: ${{BACKEND_IMAGE}}
    stop_grace_period: 1s
    command: [-m, http.server, '8000', --directory, /qa]
    volumes: [./health:/qa/health:ro]
    networks: [private, ingress]
    healthcheck:
      test: [CMD, /usr/bin/python3.11, /app/healthcheck.py]
      interval: 1s
  bot:
    image: ${{BOT_IMAGE}}
    stop_grace_period: 1s
    command: [-c, 'import time; time.sleep(600)']
    volumes: [./bot_check.py:/app/healthcheck.py:ro]
    networks: [private]
    healthcheck:
      test: [CMD, /usr/bin/python3.11, /app/healthcheck.py]
      interval: 1s
volumes:
  data:
networks:
  private:
{private_ipam}
  ingress:
    name: {name}-ingress
{ingress_ipam}
""")
            def sql(statement):
                return runtime.compose("exec", "-T", "postgres", "psql", "-XAt", "-v", "ON_ERROR_STOP=1",
                                       "-U", "familybudget", "-d", "familybudget", "-c", statement,
                                       text=True, capture_output=True).stdout.strip()

            try:
                runtime.compose("up", "-d", "--wait", "--wait-timeout", "120")
                sql("CREATE TABLE seed (n integer); INSERT INTO seed VALUES (19)")
                def bad_migration(images):
                    sql("UPDATE seed SET n=42; CREATE TABLE bad_new_object(n integer)")
                    raise RuntimeError("injected migration failure")
                runtime.migrate = bad_migration
                tx = deploy.Deployment(runtime.state, runtime)
                with self.assertRaisesRegex(RuntimeError, "injected migration"):
                    tx.apply({"metadata_sha": "1" * 40, "images": new})
                self.assertEqual(sql("SELECT n FROM seed"), "19")
                self.assertEqual(sql("SELECT to_regclass('bad_new_object') IS NULL"), "t")
                self.assertEqual(runtime.baseline(), old)
                self.assertEqual(tx.read()["current"]["images"], old)
                runtime.compose("exec", "-T", deploy.BACKEND, "/usr/bin/python3.11", "/app/healthcheck.py")
                # A later metadata release may reuse the same backend digest. The
                # previous activation attached ingress outside of Compose.
                runtime.migrate = lambda images: sql("UPDATE seed SET n=53")
                check = runtime.check_backend
                def bad_health(images):
                    check(images)
                    networks = deploy.run("docker", "inspect", "-f", "{{json .NetworkSettings.Networks}}",
                                          runtime.container(deploy.BACKEND), text=True, capture_output=True).stdout
                    self.assertNotIn(runtime.ingress, json.loads(networks))
                    runtime.check_backend = check
                    raise RuntimeError("injected HTTP health failure")
                runtime.check_backend = bad_health
                with self.assertRaisesRegex(RuntimeError, "injected HTTP health failure"):
                    tx.apply({"metadata_sha": "2" * 40, "images": old})
                self.assertEqual(sql("SELECT n FROM seed"), "19")
                self.assertEqual(runtime.baseline(), old)
                # Successful release must survive ordinary operator recreation from .env.
                tx.apply({"metadata_sha": "3" * 40, "images": new})
                runtime.compose("up", "-d", "--force-recreate", "--no-deps", "--wait", deploy.BACKEND)
                self.assertEqual(runtime.baseline(), new)
                self.assertEqual(sql("SELECT n FROM seed"), "53")
            finally:
                runtime.compose("down", "-v")
