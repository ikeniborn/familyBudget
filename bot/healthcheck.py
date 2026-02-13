#!/usr/bin/env python3
"""
Healthcheck script for bot distroless Docker container.
Uses only stdlib - no external dependencies.

Simple healthcheck: verifies that bot.main module can be imported.
If Python process can run this script and import bot.main, bot is healthy.

Exit code 0 = healthy, exit code 1 = unhealthy.
"""

import sys


def check_health() -> bool:
    """
    Check if bot is healthy by attempting to import bot.main module.
    This verifies that:
    1. Python process is running
    2. Bot code is accessible and valid
    3. Dependencies are installed

    Returns:
        bool: True if healthy, False otherwise
    """
    try:
        # Attempt to import bot.main module
        # If import succeeds, bot environment is valid
        import bot.main  # noqa: F401

        return True

    except ImportError as e:
        print(f"Health check failed: Cannot import bot.main: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Health check failed: {type(e).__name__}: {e}", file=sys.stderr)
        return False


if __name__ == "__main__":
    is_healthy = check_health()
    sys.exit(0 if is_healthy else 1)
