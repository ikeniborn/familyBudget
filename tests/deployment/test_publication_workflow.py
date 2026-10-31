"""Trace shell publication checks without running deploy or touching real services."""

import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
import unittest

import test_service_bindings as bindings

ROOT = bindings.ROOT


class PublicationWorkflowTests(unittest.TestCase):
    def run_workflow(self, action="preflight", candidate=None, **overrides):
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            fixture = candidate if candidate is not None else bindings.ServiceBindingsTests().valid_compose()
            for name, service in fixture.get("services", {}).items():
                service["image"] = f"fixture/{name}:test"
            (work / "compose.json").write_text(json.dumps(fixture))
            runtime = bindings.ServiceBindingsTests().valid_runtime()
            for item in runtime:
                item["State"] = {"Health": {"Status": "healthy"}}
            if overrides.pop("unsafe_runtime", False):
                runtime[0]["NetworkSettings"]["Ports"]["5432/tcp"][0]["HostIp"] = "0.0.0.0"
            if overrides.pop("unhealthy_runtime", False):
                runtime[1]["State"]["Health"]["Status"] = "unhealthy"
            (work / "runtime.json").write_text(json.dumps(runtime))
            (work / "docker-compose.yml").write_text("services: {}\n")
            (work / "VERSION").write_text("0.0.1\n")
            (work / "IMAGE_VERSIONS.json").write_text("{}\n")
            legacy_env = overrides.pop("legacy_env", None)
            if legacy_env is not None:
                (work / ".env").write_text(legacy_env)
            fake = work / "docker"
            fake.write_text(f"#!{sys.executable}\n" + """
import os, pathlib, sys
args = sys.argv[1:]
root = pathlib.Path(os.environ['FIXTURE_DIR'])
with (root / 'commands').open('a') as stream:
    stream.write('docker ' + ' '.join(args) + '\\n')
if args[0] == 'compose':
    if 'config' in args:
        if os.environ.get('FAIL_RENDER') == '1': sys.exit(9)
        print((root / 'compose.json').read_text())
    elif 'ps' in args: print('fixture-postgres\\nfixture-redis\\nfixture-backend')
    elif 'exec' in args: sys.exit(int(os.environ.get('FAIL_DOCKER_PEERS', '0')))
elif args[:2] == ['image', 'inspect']:
    sys.exit(int(os.environ.get('MISSING_IMAGE', '0')))
elif args[0] == 'inspect': print((root / 'runtime.json').read_text())
elif args[0] == 'ps': pass
else: sys.exit(8)
""")
            fake.chmod(0o755)
            for tool in ("sudo", "ufw", "iptables", "curl"):
                executable = work / tool
                executable.write_text("#!/bin/bash\nprintf '%s\\n' \"" + tool + " $*\" >> \"$FIXTURE_DIR/commands\"\nexit \"${FAIL_CURL:-0}\"\n")
                executable.chmod(0o755)
            python = work / "python3"
            python.write_text(f"#!{sys.executable}\n" + """
import os, sys
if len(sys.argv)>2 and sys.argv[1]=='-c' and 'socket.create_connection' in sys.argv[2]:
    with open(os.environ['FIXTURE_DIR']+'/commands','a') as f: f.write('host TCP '+sys.argv[-1]+'\\n')
    sys.exit(int(os.environ.get('FAIL_HOST_TCP','0')))
os.execv(sys.executable, [sys.executable]+sys.argv[1:])
""")
            python.chmod(0o755)
            if overrides.pop("auto_override", False):
                (work / "docker-compose.override.yml").write_text("services: {}\n")
            env = os.environ.copy()
            env.update(PATH=f"{work}:{env['PATH']}", FIXTURE_DIR=str(work),
                       SCRIPT_DIR=str(ROOT), DEPLOY_DIR=str(work), BACKEND_PORT="8000",
                       LOG_FILE=str(work / "test.log"), SKIP_SMOKE_TEST="true",
                       SKIP_DOCKERD_RESTART="true", CLEANUP_MODE="skip", DETACH_MODE="true",
                       TMPDIR=str(work))
            env.update(overrides)
            function = {"preflight": "validate_internal_service_publication",
                        "runtime": "verify_internal_service_publication",
                        "up": "compose_cmd up -d backend",
                        "recreation": "mark_internal_publication_recreation; printf '%s\\n' \"${NEEDS_POSTGRES_RECREATE:-false} ${NEEDS_REDIS_RECREATE:-false} ${NEEDS_BACKEND_RECREATE:-false} ${NEEDS_BOT_RECREATE:-false} ${NEEDS_TRAEFIK_RECREATE:-false}\"",
                        "main": "main",
                        "setup": "main",
                        "firewall": "configure_docker_firewall; configure_ufw_for_postgres"}[action]
            script = f"""set -e
source {shlex.quote(str(ROOT / 'scripts/lib/utils.sh'))}
source {shlex.quote(str(ROOT / 'scripts/lib/firewall.sh'))}
{function}
"""
            if action == "setup":
                script = script.rsplit("main", 1)[0] + f"""
source <(sed -n '/^main() {{/,/^}}/p' {shlex.quote(str(ROOT / 'setup.sh'))})
parse_args() {{ :; }}
main
"""
            elif action == "main":
                stubs = """parse_args check_orphaned_deployment_processes validate_firewall_rules
check_port_available check_prerequisites_early validate_env collect_deployment_parameters
ensure_monitoring_network check_git_sync sync_code_to_deploy analyze_sync_changes
regenerate_pwa_icons_if_needed confirm_deployment_versions generate_env_from_image_versions
cleanup_old_image_versions validate_registry_images pull_from_registry compare_running_vs_pulled_images
force_traefik_recreate_for_env check_prerequisites_late check_postgres_health_pre_deploy
cleanup_old_deployment cleanup_docker_images check_and_restart_dockerd create_deployment_safety_backup
prepare_upload_directories ensure_postgres_volume_exists start_postgres_only
verify_postgres_health_post_start start_redis_only start_backend_only run_alembic_migrations
verify_database_schema start_application_services wait_for_services setup_backup_cron
install_systemd_service configure_firewall_for_ssl verify_all_services cleanup_docker_system_soft
print_status save_deployed_version rm""".split()
                definitions = "\n".join(f'{name}() {{ printf "call {name}\\n" >> "$FIXTURE_DIR/commands"; }}'
                                        for name in stubs)
                script = script.rsplit("main", 1)[0] + f"""
source <(sed -n '/^main() {{/,/^}}/p' {shlex.quote(str(ROOT / 'deploy.sh'))})
{definitions}
info() {{ :; }}
success() {{ :; }}
warning() {{ :; }}
step() {{ :; }}
print_message() {{ :; }}
cd() {{ builtin cd "$DEPLOY_DIR"; }}
main
"""
            result = subprocess.run(["bash", "-c", script], env=env, text=True,
                                    capture_output=True, check=False)
            trace = (work / "commands").read_text().splitlines() if (work / "commands").exists() else []
            if legacy_env is not None:
                self.assertEqual((work / ".env").read_text(), legacy_env)
            return result, trace

    def assert_no_mutations(self, commands):
        self.assertFalse(any(any(token in item.split() for token in
                                 ("up", "down", "restart", "build", "delete", "allow", "-F"))
                             for item in commands), commands)

    def test_external_mode_stops_before_mutation(self):
        result, commands = self.run_workflow(POSTGRES_EXTERNAL_ACCESS="true")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SSH", result.stderr)
        self.assert_no_mutations(commands)

    def test_invalid_backend_port_stops_before_mutation(self):
        for port in ("bad", "0", "65536", "8000;exit", " 8000"):
            result, commands = self.run_workflow(BACKEND_PORT=port)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("BACKEND_PORT", result.stderr)
            self.assert_no_mutations(commands)

    def test_public_override_stops_before_mutation(self):
        candidate = bindings.ServiceBindingsTests().valid_compose()
        candidate["services"]["postgres"]["ports"][0]["host_ip"] = "0.0.0.0"
        result, commands = self.run_workflow(candidate=candidate)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("postgres", result.stderr)
        self.assert_no_mutations(commands)

    def test_network_mode_override_stops_all_deploy_startup(self):
        for mode in ("host", "service:postgres", "container:other"):
            candidate = bindings.ServiceBindingsTests().valid_compose()
            candidate["services"]["backend"]["network_mode"] = mode
            result, commands = self.run_workflow("main", candidate=candidate)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("backend", result.stderr)
            self.assertFalse(any("call start_" in item for item in commands))
            self.assert_no_mutations([item for item in commands if item.startswith("docker ")])

    def test_render_failure_cannot_pass(self):
        result, commands = self.run_workflow(FAIL_RENDER="1")
        self.assertNotEqual(result.returncode, 0)
        self.assert_no_mutations(commands)

    def test_missing_image_fails_without_build(self):
        result, commands = self.run_workflow(MISSING_IMAGE="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("image", result.stderr.lower())
        self.assert_no_mutations(commands)

    def test_valid_preflight_checks_prebuilt_images(self):
        result, commands = self.run_workflow()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(sum("image inspect fixture/" in item for item in commands), 3)
        self.assert_no_mutations(commands)

    def test_unsafe_runtime_fails_postflight(self):
        result, _ = self.run_workflow("runtime", unsafe_runtime=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("postgres", result.stderr)

    def test_failed_health_fails_postflight(self):
        result, _ = self.run_workflow("runtime", unhealthy_runtime=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("health", result.stderr.lower())

    def test_legacy_firewall_entry_points_preserve_operator_rules(self):
        result, commands = self.run_workflow("firewall")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_no_mutations(commands)

    def test_build_override_is_rejected(self):
        candidate = bindings.ServiceBindingsTests().valid_compose()
        candidate["services"]["backend"]["build"] = "."
        result, commands = self.run_workflow(candidate=candidate)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("CI", result.stderr)
        self.assert_no_mutations(commands)

    def test_compose_selection_is_shared_by_preflight_and_start(self):
        for options, expected in (({"COMPOSE_FILE": "base.yml:custom.yml"}, "-f base.yml -f custom.yml"),
                                  ({"auto_override": True}, "-f docker-compose.yml -f docker-compose.override.yml")):
            result, commands = self.run_workflow(**options)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(expected, commands[0])
            result, commands = self.run_workflow("up", **options)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(expected, commands[0])
            self.assertIn("--no-build", commands[0])

    def test_postflight_probes_host_and_docker_names(self):
        result, commands = self.run_workflow("runtime")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(any("host TCP 8000" in item for item in commands))
        self.assertTrue(any("127.0.0.1:8000/health" in item for item in commands))
        self.assertTrue(any('("postgres",5432)' in item and '("redis",6379)' in item for item in commands))

    def test_failed_connectivity_cannot_pass(self):
        for failure in ("FAIL_HOST_TCP", "FAIL_CURL", "FAIL_DOCKER_PEERS"):
            result, _ = self.run_workflow("runtime", **{failure: "1"})
            self.assertNotEqual(result.returncode, 0)

    def test_legacy_runtime_requests_only_internal_recreation(self):
        result, commands = self.run_workflow("recreation", unsafe_runtime=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("true true true false false", result.stdout)
        self.assert_no_mutations(commands)

    def test_safe_runtime_does_not_request_recreation(self):
        result, _ = self.run_workflow("recreation")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("false false false false false", result.stdout)

    def test_foreground_runs_full_startup_and_postflight_before_logs(self):
        result, commands = self.run_workflow("main", DETACH_MODE="false")
        self.assertEqual(result.returncode, 0, result.stderr)
        for service in ("postgres", "redis", "backend"):
            self.assertIn(f"call start_{service}_only", commands)
        health = next(i for i, item in enumerate(commands) if "127.0.0.1:8000/health" in item)
        logs = next(i for i, item in enumerate(commands) if "logs -f" in item)
        self.assertLess(health, logs)

    def test_deploy_external_flag_prevents_all_startup(self):
        result, commands = self.run_workflow("main", POSTGRES_EXTERNAL_ACCESS="true")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any("call start_" in item for item in commands))

    def test_setup_rejects_legacy_external_flag_without_rewriting_config(self):
        result, commands = self.run_workflow("setup", legacy_env="POSTGRES_EXTERNAL_ACCESS=true\n")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SSH", result.stderr)
        self.assert_no_mutations(commands)


if __name__ == "__main__":
    unittest.main()
