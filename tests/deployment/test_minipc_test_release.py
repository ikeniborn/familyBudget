"""Exercise publication races and Mini PC verification with a local Git remote."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "deploy/minipc-test"), str(ROOT / "scripts/ci")]


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name) / "work"
        self.repo.mkdir()
        self.remote = Path(self.tmp.name) / "origin"
        subprocess.run(["git", "init", "-q", "--bare", str(self.remote)], check=True)
        git(self.repo, "init", "-q", "-b", "test")
        git(self.repo, "config", "user.name", "Local CI")
        git(self.repo, "config", "user.email", "ci@example.test")
        git(self.repo, "remote", "add", "origin", str(self.remote))
        self.manifest = {key: {"version": "1.0.0", "digest": "sha256:" + "a" * 64}
                         for key in ("backend", "bot", "redis", "postgresql")}
        (self.repo / "VERSION").write_text("1.0.0\n")
        git(self.repo, "add", "VERSION")
        self.before = self.commit("IMAGE_VERSIONS.json", json.dumps(self.manifest, indent=2) + "\n")
        self.source = self.commit("VERSION", "1.1.0\n")
        self.run = {"event": "push", "head_branch": "test", "head_sha": self.source,
                    "id": 12, "run_attempt": 1, "path": ".github/workflows/build-and-push.yml",
                    "conclusion": "success", "status": "completed"}

    def commit(self, name, content):
        (self.repo / name).write_text(content)
        git(self.repo, "add", name)
        git(self.repo, "commit", "-qm", "test change")
        git(self.repo, "push", "-q", "origin", "test")
        return git(self.repo, "rev-parse", "HEAD")

    def publish(self):
        from publish_test_release import publish

        return publish(self.repo, self.before, self.source, self.manifest, 12, 1)

    def verify(self, snapshot, applied=None, job_name=None):
        from release_metadata import verified_release

        jobs = {"jobs": [{"name": job_name or "Verified test release " + self.published,
                          "conclusion": "success"}]}
        return verified_release(self.repo, snapshot, applied, lambda path: jobs if "/jobs?" in path else self.run)

    def test_reused_images_and_unrelated_followup(self):
        tip = self.commit("README.md", "other")
        self.published = self.publish()
        self.assertEqual(git(self.repo, "rev-parse", self.published + "^"), tip)
        self.assertEqual(git(self.repo, "diff", "--name-only", tip, self.published), "")
        git(self.repo, "pull", "-q", "--ff-only", "origin", "test")
        later = self.commit("README.md", "later")
        release = self.verify(later)
        self.assertEqual(release["source_sha"], self.source)
        self.assertEqual(release["metadata_sha"], self.published)
        self.assertTrue(release["images"]["backend"].endswith("@sha256:" + "a" * 64))
        self.assertIsNone(self.verify(later, self.published))
        self.assertIsNone(self.verify(self.commit("VERSION", "1.2.0\n")))

    def test_superseded_version(self):
        self.commit("VERSION", "1.2.0\n")
        with self.assertRaises(ValueError):
            self.publish()

    def test_concurrent_manifest_change(self):
        self.commit("IMAGE_VERSIONS.json", json.dumps(self.manifest, indent=4))
        with self.assertRaises(ValueError):
            self.publish()

    def test_stale_or_unrelated_source(self):
        git(self.repo, "checkout", "-qb", "other", self.before)
        git(self.repo, "commit", "--allow-empty", "-qm", "off branch")
        self.source = git(self.repo, "rev-parse", "HEAD")
        with self.assertRaises(ValueError):
            self.publish()

    def test_push_without_version_change(self):
        self.before = self.source
        self.source = self.commit("README.md", "same VERSION")
        with self.assertRaises(ValueError):
            self.publish()

    def test_invalid_digest(self):
        self.manifest["backend"]["digest"] = "sha256:123"
        with self.assertRaises(ValueError):
            self.publish()

    def test_require_exact_successful_attempt_and_attested_metadata(self):
        self.published = self.publish()
        for key, value in (("event", "workflow_dispatch"), ("path", "other.yml"),
                           ("conclusion", "failure"), ("run_attempt", 2), ("head_branch", "prod"),
                           ("head_sha", self.before)):
            with self.subTest(key=key):
                old = self.run[key]
                self.run[key] = value
                self.assertIsNone(self.verify(self.published))
                self.run[key] = old
        self.assertIsNone(self.verify(self.published, job_name="Unrelated job"))

    def test_branch_moves_between_fetch_and_push(self):
        run = subprocess.run
        moved = []

        def race(cmd, **kwargs):
            if "--force-with-lease=refs/heads/test:" + self.source in cmd and not moved:
                moved.append(self.commit("README.md", "concurrent commit"))
            return run(cmd, **kwargs)

        with patch("publish_test_release.subprocess.run", side_effect=race):
            self.published = self.publish()
        self.assertEqual(git(self.repo, "rev-parse", self.published + "^"), moved[0])
        self.assertEqual(self.verify(self.published)["metadata_sha"], self.published)

    def test_changed_backend_and_frontend_trigger_image_rebuild(self):
        manifest = json.loads((ROOT / "IMAGE_VERSIONS.json").read_text())
        entry = manifest["backend"]
        self.commit("IMAGE_VERSIONS.json", json.dumps(manifest))
        script = ROOT / "scripts/ci/check_image_changes.sh"

        def decision():
            return subprocess.check_output(["bash", str(script), "backend"], cwd=self.repo, text=True).strip()

        for directory in ("backend", "frontend"):
            path = self.repo / directory
            path.mkdir()
            self.commit(str(path.relative_to(self.repo) / "fixture"), "code")
            self.assertEqual(decision(), "build")
            entry["hash"] = git(self.repo, "log", "-1", "--pretty=format:%h", "--", *entry["paths"])
            self.commit("IMAGE_VERSIONS.json", json.dumps(manifest))
            self.assertEqual(decision(), "skip")
