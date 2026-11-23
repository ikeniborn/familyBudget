import json
import os
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "deploy/minipc-test"
DIGEST = "sha256:" + "a" * 64


class MiniPcComposeTests(unittest.TestCase):
    def test_renders_isolated_digest_pinned_services(self):
        self.assertTrue((CONFIG / "compose.yaml").is_file())
        standalone = shutil.which("docker-compose")
        if standalone:
            command = [standalone]
        elif subprocess.run(
            ["docker", "compose", "version"], capture_output=True
        ).returncode == 0:
            command = ["docker", "compose"]
        else:
            self.skipTest("Docker Compose v2 is required to render the model")

        environment = {
            "PATH": os.environ["PATH"],
            "TEST_SUBNET": "172.16.20.0/27",
            "POSTGRES_PASSWORD": "synthetic",
            "REDIS_PASSWORD": "synthetic",
            "JWT_SECRET": "synthetic",
            "API_INTERNAL_KEY": "synthetic",
            "TELEGRAM_BOT_TOKEN": "123456:synthetic",
            "ADMIN_TELEGRAM_ID": "1",
        }
        for service in ("backend", "bot", "postgresql", "redis"):
            environment[f"{service.upper()}_IMAGE"] = (
                f"ghcr.io/ikeniborn/familybudget-{service}@{DIGEST}"
            )

        invocation = command + ["-f", str(CONFIG / "compose.yaml"), "config"]
        result = subprocess.run(
            invocation + ["--format", "json"], check=True, capture_output=True,
            text=True, env=environment,
        )
        model = json.loads(result.stdout)
        self.assertEqual(model["name"], "familybudget-test")
        self.assertEqual(model["networks"]["private"]["ipam"]["config"][0]["subnet"],
                         environment["TEST_SUBNET"])
        self.assertTrue(model["networks"]["proxy-net"]["external"])
        for name, service in model["services"].items():
            with self.subTest(service=name):
                self.assertNotIn("ports", service)
                self.assertNotIn("container_name", service)
                self.assertIn("mem_limit", service)
                self.assertIn("cpus", service)
                self.assertTrue(service["image"].endswith(f"@{DIGEST}"))
                self.assertEqual(set(service["networks"]),
                                 {"private", "proxy-net"} if name == "familybudget-test-backend" else {"private"})
        self.assertIn("backend", model["services"]["familybudget-test-backend"]
                      ["networks"]["private"]["aliases"])
        self.assertEqual(model["volumes"]["postgres_data"]["name"],
                         "familybudget-test_postgres_data")
        self.assertIn("max_locks_per_transaction=256", model["services"]["postgres"]["command"])
        environment.pop("TEST_SUBNET")
        result = subprocess.run(invocation + ["--quiet"], capture_output=True, text=True,
                                env=environment)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("TEST_SUBNET", result.stderr)
