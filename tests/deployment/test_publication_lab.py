"""Protect lab resource scope independently of Docker availability."""

import copy
import json
import os
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import patch

import publication_lab


class LabSafetyTests(unittest.TestCase):
    def test_render_environment_does_not_inherit_real_credentials(self):
        inherited = {key: "real-credential-sentinel" for key in (
            "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "ADMIN_PASSWORD", "VAPID_PRIVATE_KEY",
            "TELEGRAM_WEBHOOK_URL", "TELEGRAM_PROXY_URL", "POSTGRES_PASSWORD", "REDIS_PASSWORD")}
        with patch.dict(os.environ, inherited):
            self.assertTrue(hasattr(publication_lab, "render_environment"))
            environment = publication_lab.render_environment()
        self.assertFalse(any(value == "real-credential-sentinel" for value in environment.values()))
        self.assertEqual(environment["POSTGRES_DB"], "publication_lab")
        self.assertNotIn("ADMIN_PASSWORD", environment)
        self.assertNotIn("S3_SECRET_ACCESS_KEY", environment)

    def test_cleanup_refuses_resource_with_foreign_label(self):
        lab = publication_lab.PublicationLab()
        commands = []
        lab.resources = [("container", "familybudget-postgres")]
        def run(args, **kwargs):
            commands.append(args)
            return subprocess.CompletedProcess(args, 0, json.dumps([{"Config": {"Labels": {}}}]), "")
        lab.run = run
        with self.assertRaises(publication_lab.LabFailure):
            lab.cleanup()
        self.assertFalse(any("rm" in command for command in commands))

    def test_production_project_or_directory_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            for project, workspace in (("familybudget", Path(directory)),
                                       ("fb-publication-0123456789ab", Path("/opt/budget"))):
                with self.assertRaises(ValueError):
                    publication_lab.validate_scope(project, workspace)

    def test_existing_application_directory_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            (workspace / "deploy.sh").write_text("existing application")
            with self.assertRaises(ValueError):
                publication_lab.validate_scope("fb-publication-0123456789ab", workspace)

    def test_config_keeps_real_ports_and_commands_with_independent_storage(self):
        candidate = {"services": {
            "postgres": {"container_name": "familybudget-postgres", "image": "old-db",
                         "ports": [{"host_ip": "127.0.0.1", "published": "5432", "target": 5432}],
                         "command": ["postgres", "-c", "max_locks_per_transaction=256"],
                         "volumes": [{"type": "volume", "source": "postgres_data", "target": "/data"}]},
            "redis": {"image": "old-redis", "ports": [], "volumes": []},
            "backend": {"image": "old-backend", "ports": [], "volumes": []}},
            "volumes": {"postgres_data": {"external": True, "name": "budget_postgres_data"}}}
        original = copy.deepcopy(candidate)
        config = publication_lab.lab_config(candidate, "fb-publication-0123456789ab",
                                            {"postgres": "ci-db", "redis": "ci-redis", "backend": "ci-backend"})
        self.assertEqual(candidate, original)
        self.assertEqual(config["services"]["postgres"]["ports"],
                         [{"host_ip": "127.0.0.1", "published": "5432", "target": 5432}])
        self.assertEqual(config["services"]["postgres"]["command"],
                         ["postgres", "-c", "max_locks_per_transaction=256"])
        self.assertEqual(config["volumes"]["postgres_data"], {})
        self.assertTrue(all(s["container_name"].startswith("fb-publication-") for s in config["services"].values()))


if __name__ == "__main__":
    unittest.main()
