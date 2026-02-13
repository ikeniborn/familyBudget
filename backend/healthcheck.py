#!/usr/bin/env python3
"""
Healthcheck script for distroless Docker container.
Uses only stdlib (http.client) - no external dependencies.

Checks if FastAPI backend is responding on localhost:8000/health.
Exit code 0 = healthy, exit code 1 = unhealthy.
"""

import http.client
import sys


def check_health() -> bool:
    """
    Check if backend health endpoint responds with 200 OK.

    Returns:
        bool: True if healthy, False otherwise
    """
    try:
        # Create HTTP connection to localhost:8000
        conn = http.client.HTTPConnection("localhost", 8000, timeout=5)

        # Send GET request to /health endpoint
        conn.request("GET", "/health")

        # Get response
        response = conn.getresponse()

        # Close connection
        conn.close()

        # Check if status code is 200 OK
        if response.status == 200:
            return True
        else:
            print(f"Health check failed: HTTP {response.status}", file=sys.stderr)
            return False

    except ConnectionRefusedError:
        print("Health check failed: Connection refused (backend not running)", file=sys.stderr)
        return False
    except TimeoutError:
        print("Health check failed: Connection timeout", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Health check failed: {type(e).__name__}: {e}", file=sys.stderr)
        return False


if __name__ == "__main__":
    is_healthy = check_health()
    sys.exit(0 if is_healthy else 1)
