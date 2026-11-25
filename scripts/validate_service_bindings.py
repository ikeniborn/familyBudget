#!/usr/bin/env python3
"""Check rendered Compose or inspect output without printing configuration secrets."""

import argparse
import json
import re
import sys


def tcp_port(value):
    """Accept numeric TCP ports, excluding ranges and implicit conversions."""
    if isinstance(value, bool) or not re.fullmatch(r"[0-9]+", str(value)):
        raise ValueError("invalid TCP port")
    port = int(value)
    if not 1 <= port <= 65535:
        raise ValueError("invalid TCP port")
    return port


def publications(data, mode, service):
    if mode == "compose":
        mappings = data["services"][service].get("ports", [])
        return [(item.get("host_ip"), tcp_port(item.get("published")),
                 tcp_port(item.get("target")), item.get("protocol", "tcp"))
                for item in mappings]
    containers = [item for item in data
                  if item.get("Config", {}).get("Labels", {}).get(
                      "com.docker.compose.service") == service]
    if len(containers) != 1:
        raise ValueError("expected one service container")
    result = []
    for target, mappings in containers[0]["NetworkSettings"]["Ports"].items():
        if mappings:
            port, protocol = target.split("/")
            result.extend((item.get("HostIp"), tcp_port(item.get("HostPort")),
                           tcp_port(port), protocol) for item in mappings)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("compose", "runtime"))
    parser.add_argument("--backend-port", default="8000")
    args = parser.parse_args()
    try:
        backend_port = tcp_port(args.backend_port)
    except ValueError:
        print("backend: invalid configured TCP port", file=sys.stderr)
        return 1
    try:
        data = json.load(sys.stdin)
    except (ValueError, OSError):
        print("publication: invalid JSON input", file=sys.stderr)
        return 1
    failed = False
    for service, target, host in (("postgres", 5432, 5432),
                                  ("redis", 6379, 6379), ("backend", 8000, backend_port)):
        try:
            if args.mode == "compose" and "network_mode" in data["services"][service]:
                print(f"{service}: network_mode overrides are unsupported; require Docker service networks",
                      file=sys.stderr)
                failed = True
                continue
            actual = publications(data, args.mode, service)
            if actual != [("127.0.0.1", host, target, "tcp")]:
                raise ValueError("unexpected publication")
        except (KeyError, TypeError, AttributeError, ValueError):
            print(f"{service}: require only 127.0.0.1:{host}:{target}/tcp publication",
                  file=sys.stderr)
            failed = True
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
