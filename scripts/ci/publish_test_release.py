"""Publish a checked manifest using a compare-and-swap update of refs/heads/test."""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "deploy/minipc-test"))
from release_metadata import MANIFEST, git, validate_manifest, validate_source  # noqa: E402


def publish(repo, before, source, manifest, run_id, attempt):
    validate_manifest(manifest)
    if run_id < 1 or attempt < 1:
        raise ValueError("Missing workflow provenance")
    content = json.dumps(manifest, indent=2) + "\n"
    blob = git(repo, "hash-object", "-w", "--stdin", data=content)
    for _ in range(3):
        git(repo, "fetch", "--quiet", "origin", "refs/heads/test")
        parent = git(repo, "rev-parse", "FETCH_HEAD")
        version = validate_source(repo, before, source, parent)
        # Start from the fetched tree so unrelated concurrent commits survive unchanged.
        with tempfile.TemporaryDirectory() as directory:
            env = {**os.environ, "GIT_INDEX_FILE": str(Path(directory) / "index")}
            cmd = ["git", "-C", str(repo)]
            subprocess.run(cmd + ["read-tree", parent], env=env, check=True)
            subprocess.run(cmd + ["update-index", "--add", "--cacheinfo", f"100644,{blob},{MANIFEST}"],
                           env=env, check=True)
            tree = subprocess.check_output(cmd + ["write-tree"], env=env, text=True).strip()
        message = (f"chore(ci): publish test release {version}\n\nTest-Release-Source: {source}\n"
                   f"Test-Release-Before: {before}\nTest-Release-Version: {version}\n"
                   f"Test-Release-Run: {run_id}\nTest-Release-Attempt: {attempt}\n")
        metadata = git(repo, "commit-tree", tree, "-p", parent, data=message)
        push = subprocess.run(cmd + ["push", f"--force-with-lease=refs/heads/test:{parent}",
                                     "origin", f"{metadata}:refs/heads/test"])
        if push.returncode == 0:
            return metadata
        if git(repo, "ls-remote", "origin", "refs/heads/test").split()[0] == parent:
            push.check_returncode()
    raise RuntimeError("Test branch kept advancing during release publication")


if __name__ == "__main__":
    if os.environ["GITHUB_EVENT_NAME"] != "push" or os.environ["GITHUB_REF"] != "refs/heads/test":
        raise SystemExit("Only pushes to test can publish a test release")
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    print(publish(Path.cwd(), event["before"], os.environ["GITHUB_SHA"], json.loads(os.environ["TEST_MANIFEST"]),
                  int(os.environ["GITHUB_RUN_ID"]), int(os.environ["GITHUB_RUN_ATTEMPT"])))
