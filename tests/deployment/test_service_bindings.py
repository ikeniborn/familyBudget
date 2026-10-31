"""Exercise publication validation without application or database fixtures."""

import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[2]
VALIDATOR = ROOT / "scripts/validate_service_bindings.py"


class ServiceBindingsTests(unittest.TestCase):
    def valid_compose(self):
        return {"services": {
            name: {"ports": [{"target": target, "published": str(host),
                              "host_ip": "127.0.0.1", "protocol": "tcp"}]}
            for name, target, host in (("postgres", 5432, 5432),
                                       ("redis", 6379, 6379), ("backend", 8000, 8000))
        }}

    def valid_runtime(self):
        return [{"Config": {"Labels": {"com.docker.compose.service": name}},
                 "NetworkSettings": {"Ports": {
                     f"{port}/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(port)}]}}}
                for name, port in (("postgres", 5432), ("redis", 6379), ("backend", 8000))]

    def run_validator(self, mode, candidate, port="8000"):
        return subprocess.run([sys.executable, str(VALIDATOR), mode,
                               "--backend-port", port], input=json.dumps(candidate),
                              text=True, capture_output=True, check=False)

    def test_valid_publications_pass(self):
        for mode, candidate in (("compose", self.valid_compose()),
                                ("runtime", self.valid_runtime())):
            with self.subTest(mode=mode):
                result = self.run_validator(mode, candidate)
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_remapped_backend_passes(self):
        compose = self.valid_compose()
        compose["services"]["backend"]["ports"][0]["published"] = "18000"
        runtime = self.valid_runtime()
        runtime[2]["NetworkSettings"]["Ports"]["8000/tcp"][0]["HostPort"] = "18000"
        for mode, candidate in (("compose", compose), ("runtime", runtime)):
            result = self.run_validator(mode, candidate, "18000")
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_captured_render_and_inspect_pass(self):
        fixtures = Path(__file__).parent / "fixtures"
        for mode, port in (("compose", "8000"), ("runtime", "18000")):
            candidate = json.loads((fixtures / f"{mode}-publications.json").read_text())
            result = self.run_validator(mode, candidate, port)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_unsafe_addresses_fail(self):
        for address in ("0.0.0.0", "", "::", "2001:db8::1", "192.0.2.1"):
            for mode in ("compose", "runtime"):
                with self.subTest(address=address, mode=mode):
                    candidate = self.valid_compose() if mode == "compose" else self.valid_runtime()
                    if mode == "compose":
                        candidate["services"]["postgres"]["ports"][0]["host_ip"] = address
                    else:
                        candidate[0]["NetworkSettings"]["Ports"]["5432/tcp"][0]["HostIp"] = address
                    result = self.run_validator(mode, candidate)
                    self.assertEqual(result.returncode, 1)
                    self.assertIn("postgres", result.stderr)

    def test_missing_service_or_mapping_fails(self):
        for mode in ("compose", "runtime"):
            for missing_service in (False, True):
                candidate = self.valid_compose() if mode == "compose" else self.valid_runtime()
                if mode == "compose":
                    if missing_service:
                        del candidate["services"]["redis"]
                    else:
                        candidate["services"]["redis"]["ports"] = []
                elif missing_service:
                    candidate.pop(1)
                else:
                    candidate[1]["NetworkSettings"]["Ports"]["6379/tcp"] = None
                result = self.run_validator(mode, candidate)
                self.assertEqual(result.returncode, 1)
                self.assertIn("redis", result.stderr)

    def test_extra_mapping_or_wrong_port_fails(self):
        for mode in ("compose", "runtime"):
            for extra in (False, True):
                candidate = self.valid_compose() if mode == "compose" else self.valid_runtime()
                if mode == "compose":
                    mappings = candidate["services"]["backend"]["ports"]
                    mapping = copy.deepcopy(mappings[0])
                    mapping["published"] = "18000"
                else:
                    mappings = candidate[2]["NetworkSettings"]["Ports"]["8000/tcp"]
                    mapping = {"HostIp": "0.0.0.0", "HostPort": "18000"}
                if extra:
                    mappings.append(mapping)
                else:
                    mappings[0] = mapping
                result = self.run_validator(mode, candidate)
                self.assertEqual(result.returncode, 1)
                self.assertIn("backend", result.stderr)

    def test_invalid_backend_port_fails(self):
        for port in ("", "abc", "0", "65536", "-1", "8000/tcp", " 8000"):
            result = self.run_validator("compose", self.valid_compose(), port)
            self.assertEqual(result.returncode, 1, result.stderr)

    def test_malformed_input_does_not_disclose_values(self):
        for candidate in ({"secret": "private-value"}, None, ["private-value"]):
            result = self.run_validator("compose", candidate)
            self.assertEqual(result.returncode, 1)
            self.assertNotIn("private-value", result.stderr)


if __name__ == "__main__":
    unittest.main()
