"""Read a pinned test snapshot and verify its release against GitHub Actions."""

import argparse
import json
import re
import subprocess
from pathlib import Path

SERVICES = ("backend", "bot", "redis", "postgresql")
REPOSITORY = "ikeniborn/familyBudget"
WORKFLOW = ".github/workflows/build-and-push.yml"
MANIFEST = "IMAGE_VERSIONS.json"


def git(repo, *args, data=None):
    return subprocess.check_output(["git", "-C", str(repo), *args], input=data, text=True).rstrip("\n")


def sha(value):
    if not re.fullmatch(r"[0-9a-f]{40}", value):
        raise ValueError("Expected a full Git SHA")
    return value


def ancestor(repo, older, newer):
    result = subprocess.run(["git", "-C", str(repo), "merge-base", "--is-ancestor", older, newer])
    if result.returncode > 1:
        result.check_returncode()
    return result.returncode == 0


def validate_manifest(data):
    if not isinstance(data, dict) or set(data) != set(SERVICES):
        raise ValueError("Expected backend, bot, redis and postgresql entries")
    images = {}
    for service in SERVICES:
        entry = data[service]
        if (not isinstance(entry, dict) or
            not re.fullmatch(r"\d+\.\d+\.\d+", str(entry.get("version"))) or
            not re.fullmatch(r"sha256:[0-9a-f]{64}", str(entry.get("digest")))):
            raise ValueError(f"Invalid image version or digest for {service}")
        images[service] = f"ghcr.io/ikeniborn/familybudget-{service}@{entry['digest']}"
    return images


def git_files(repo, ref):
    return tuple(git(repo, "rev-parse", f"{ref}:{name}") for name in ("VERSION", MANIFEST))


def validate_source(repo, before, source, parent):
    for commit in (before, source, parent):
        sha(commit)
    if not ancestor(repo, source, parent) or not ancestor(repo, before, source):
        raise ValueError("Superseded source or push base")
    if git(repo, "rev-parse", before + ":VERSION") == git(repo, "rev-parse", source + ":VERSION"):
        raise ValueError("Push did not change VERSION")
    if git_files(repo, source) != git_files(repo, parent):
        raise ValueError("VERSION or manifest changed after the tested source")
    version = git(repo, "show", source + ":VERSION")
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Invalid release VERSION")
    return version


def github(endpoint):
    return json.loads(subprocess.check_output(["gh", "api", f"repos/{REPOSITORY}/{endpoint}"]))


def verified_release(repo, snapshot, applied=None, api=github):
    sha(snapshot)
    metadata = git(repo, "log", "-1", "--first-parent", "--format=%H",
                   "--grep=^Test-Release-Source: ", snapshot)
    if not metadata or (applied and (metadata == sha(applied) or not ancestor(repo, applied, metadata))):
        return None
    if git_files(repo, snapshot) != git_files(repo, metadata):
        return None
    parents = git(repo, "show", "-s", "--format=%P", metadata).split()
    if len(parents) != 1 or git(repo, "diff", "--name-only", parents[0], metadata) not in ("", MANIFEST):
        return None
    message = git(repo, "show", "-s", "--format=%B", metadata)
    trailers = dict(line.split(": ", 1) for line in message.splitlines() if line.startswith("Test-Release-") and ": " in line)
    source = trailers["Test-Release-Source"]
    version = validate_source(repo, trailers["Test-Release-Before"], source, parents[0])
    run_id = int(trailers["Test-Release-Run"])
    attempt = int(trailers["Test-Release-Attempt"])
    if run_id < 1 or attempt < 1 or version != trailers["Test-Release-Version"]:
        return None
    run_path = f"actions/runs/{run_id}"
    run = api(run_path)
    expected = {"event": "push", "head_branch": "test", "head_sha": source, "id": run_id,
                "run_attempt": attempt, "path": WORKFLOW, "conclusion": "success", "status": "completed"}
    if any(run.get(key) != value for key, value in expected.items()):
        return None
    jobs = api(f"{run_path}/attempts/{attempt}/jobs?per_page=100")["jobs"]
    if not any(job["name"] == "Verified test release " + metadata and job["conclusion"] == "success" for job in jobs):
        return None
    images = validate_manifest(json.loads(git(repo, "show", f"{metadata}:{MANIFEST}")))
    return {"metadata_sha": metadata, "source_sha": source, "version": version, "run_id": run_id,
            "run_attempt": attempt, "images": images}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--applied")
    args = parser.parse_args()
    release = verified_release(args.repo, args.snapshot, args.applied)
    if release is None:
        raise SystemExit(3)
    print(json.dumps(release))
