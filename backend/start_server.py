#!/usr/bin/env python3
"""
Entrypoint script for distroless Python runtime.
Supports environment variable substitution for uvicorn parameters.
"""
import os
import sys

# Get configuration from environment variables
WORKERS = os.getenv("WORKERS", "1")
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")
HOST = os.getenv("UVICORN_HOST", "0.0.0.0")
PORT = os.getenv("UVICORN_PORT", "8000")

# Build uvicorn command arguments
uvicorn_args = [
    "-m", "uvicorn",
    "backend.app.main:app",
    "--host", HOST,
    "--port", PORT,
    "--workers", WORKERS,
    "--ws-per-message-deflate", "false",
    "--log-level", LOG_LEVEL,
    "--access-log",
    "--proxy-headers",
    "--forwarded-allow-ips=*"
]

# Replace current process with uvicorn
os.execvp(sys.executable, [sys.executable] + uvicorn_args)
