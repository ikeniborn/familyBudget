"""
LogsCollectorService - Centralized log collection and management

Collects logs from multiple sources:
- Browser client logs (from all users)
- Docker container logs (backend, bot, postgres, nginx)

Features:
- In-memory storage with deque (500 logs per service)
- Docker logs via subprocess
- Log filtering (level, date range, service)
- Sensitive data sanitization
- Comprehensive logging for debugging

Author: Claude Code
Date: 2025-12-27
"""

import re
from collections import deque
from datetime import datetime
from typing import Any

import docker
from docker.errors import DockerException, NotFound

from backend.app.core.json_utils import loads as json_loads
from backend.app.core.logging import get_logger
from backend.app.utils.timezone import get_system_timezone

logger = get_logger(__name__)


class LogsCollectorService:
    """
    Service for collecting and managing logs from multiple sources.

    Storage: In-memory deques with maxlen=500 per service
    Total capacity: 2500 logs (500 × 5 services)
    """

    # In-memory storage (class-level for singleton pattern)
    browser_logs: deque = deque(maxlen=500)
    backend_logs: deque = deque(maxlen=500)
    bot_logs: deque = deque(maxlen=500)
    postgres_logs: deque = deque(maxlen=500)
    nginx_logs: deque = deque(maxlen=500)

    @property
    def SERVICE_NAMES(self):
        """Get service name to deque mapping (dynamic property)."""
        return {
            'browser': self.browser_logs,
            'backend': self.backend_logs,
            'bot': self.bot_logs,
            'postgres': self.postgres_logs,
            'nginx': self.nginx_logs
        }

    # Sensitive data patterns (regex)
    SENSITIVE_PATTERNS = [
        (r'password["\']?\s*[:=]\s*["\']?[^\s"\']+', '[REDACTED_PASSWORD]'),
        (r'token["\']?\s*[:=]\s*["\']?[^\s"\']+', '[REDACTED_TOKEN]'),
        (r'api[_-]?key["\']?\s*[:=]\s*["\']?[^\s"\']+', '[REDACTED_API_KEY]'),
        (r'secret["\']?\s*[:=]\s*["\']?[^\s"\']+', '[REDACTED_SECRET]'),
        (r'\d{16}', '[REDACTED_CARD]'),  # Credit card numbers
        (r'Bearer\s+[A-Za-z0-9\-._~+/]+=*', 'Bearer [REDACTED_JWT]'),  # JWT tokens
    ]

    def __init__(self):
        """Initialize LogsCollectorService."""
        pass

    async def collect_docker_logs(
        self,
        service: str,
        since: str = "1h",
        tail: int = 500
    ) -> list[dict[str, Any]]:
        """
        Collect logs from Docker container using Docker SDK.

        Args:
            service: Container name (backend, bot, postgres, nginx)
            since: Time range (e.g., "1h", "30m", "2025-12-27")
            tail: Number of recent lines to retrieve

        Returns:
            List of log entries with parsed JSON (for backend/bot) or plain text

        Raises:
            No exceptions raised - errors are logged and empty list returned
        """
        try:
            # Convert "1h", "30m" format to seconds for Docker API
            since_seconds = self._parse_since_to_seconds(since)

            # Connect to Docker daemon via socket with timeout
            client = docker.DockerClient(
                base_url='unix://var/run/docker.sock',
                timeout=30  # 30 seconds timeout (prevent hanging)
            )

            # Get container name (compose adds project prefix)
            container_name = f"familybudget-{service}"

            # Get container
            try:
                container = client.containers.get(container_name)
            except NotFound:
                logger.warning("[LOGS_COLLECTOR] Container not found: %s", container_name)
                return []

            # Get logs from container
            logs_output = container.logs(
                since=since_seconds,
                tail=tail,
                timestamps=False,  # We'll parse timestamps from JSON logs
            ).decode('utf-8')

            # Parse logs
            logs = []
            for line in logs_output.splitlines():
                if not line.strip():
                    continue

                # Parse JSON logs from backend/bot
                if service in ["backend", "bot"]:
                    try:
                        log_entry = json_loads(line)
                        logs.append({
                            "timestamp": log_entry.get("timestamp"),
                            "level": self._normalize_level(log_entry.get("level", "INFO")),
                            "message": log_entry.get("message", ""),
                            "module": log_entry.get("module") or log_entry.get("logger_name") or service,
                            "correlation_id": log_entry.get("correlation_id")
                        })
                    except ValueError:
                        # Fallback for non-JSON logs
                        logs.append({
                            "timestamp": None,
                            "level": "info",
                            "message": line,
                            "module": service,
                            "correlation_id": None
                        })
                else:
                    # Plain text logs (postgres, nginx)
                    logs.append({
                        "timestamp": None,
                        "level": self._detect_level_from_text(line),
                        "message": line,
                        "module": service,
                        "correlation_id": None
                    })

            return logs

        except DockerException as e:
            logger.error("[LOGS_COLLECTOR] Docker error for service=%s: %s", service, e)
            return []
        except Exception as e:
            logger.error("[LOGS_COLLECTOR] Error collecting logs for service=%s: %s", service, e, exc_info=True)
            return []

    def collect_browser_logs(
        self,
        logs: list[dict[str, Any]],
        user_id: int
    ) -> int:
        """
        Store browser logs in in-memory buffer.

        Args:
            logs: List of log entries from browser
            user_id: User ID who sent the logs

        Returns:
            Number of logs stored
        """
        stored_count = 0
        for log in logs:
            # Add user_id to log entry for admin visibility
            log["user_id"] = user_id

            # Sanitize before storing
            sanitized_log = self.sanitize_log_entry(log)

            # Store in browser_logs deque
            self.browser_logs.append(sanitized_log)
            stored_count += 1

        return stored_count

    def filter_logs(
        self,
        logs: list[dict[str, Any]],
        level: str | None = None,
        since: datetime | None = None,
        until: datetime | None = None
    ) -> list[dict[str, Any]]:
        """
        Filter logs in-memory.

        Args:
            logs: List of log entries to filter
            level: Log level filter ("info", "warning", "error", "all")
            since: Start datetime filter
            until: End datetime filter

        Returns:
            Filtered list of log entries
        """
        filtered = logs

        # Filter by level
        if level and level != "all":
            filtered = [log for log in filtered if log.get("level") == level]
            logger.debug("[LOGS_COLLECTOR] After level filter (%s): %s logs", level, len(filtered))

        # Filter by date range
        if since:
            filtered = [
                log for log in filtered
                if log.get("timestamp") and self._parse_timestamp(log["timestamp"]) >= since
            ]
            logger.debug("[LOGS_COLLECTOR] After since filter (%s): %s logs", since, len(filtered))

        if until:
            filtered = [
                log for log in filtered
                if log.get("timestamp") and self._parse_timestamp(log["timestamp"]) <= until
            ]
            logger.debug("[LOGS_COLLECTOR] After until filter (%s): %s logs", until, len(filtered))

        return filtered

    def sanitize_log_entry(self, log: dict[str, Any]) -> dict[str, Any]:
        """
        Remove sensitive data from log entry.

        Args:
            log: Log entry to sanitize

        Returns:
            Sanitized log entry (new dict)
        """
        sanitized = log.copy()
        message = sanitized.get("message", "")

        # Apply all sensitive patterns
        for pattern, replacement in self.SENSITIVE_PATTERNS:
            message = re.sub(pattern, replacement, message, flags=re.IGNORECASE)

        sanitized["message"] = message
        return sanitized

    async def get_all_logs(
        self,
        service: str | None = None,
        level: str | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
        limit: int = 50
    ) -> dict[str, Any]:
        """
        Retrieve filtered logs from all services.

        Args:
            service: Service filter ("browser", "backend", "bot", "postgres", "nginx", "all")
            level: Log level filter ("info", "warning", "error", "all")
            since: Start datetime filter
            until: End datetime filter
            limit: Max logs per service

        Returns:
            Dictionary with logs per service, counts, and filters applied
        """
        # Refresh Docker logs (collect latest)
        # NOTE: bot/postgres have aggressive limits to prevent timeouts
        if service == "all" or service is None:
            services_to_collect = ["backend", "nginx", "bot", "postgres"]
        elif service == "browser":
            services_to_collect = []
        else:
            services_to_collect = [service]

        # Collect Docker logs asynchronously (different limits per service)
        for svc in services_to_collect:
            # Bot and postgres have too many logs - use very aggressive limits
            if svc in ["bot", "postgres"]:
                since_param = "1m"  # Last 1 minute only
                tail_param = 20     # Only 20 most recent logs
            else:
                since_param = "5m"  # Last 5 minutes
                tail_param = 100    # 100 logs

            docker_logs = await self.collect_docker_logs(svc, since=since_param, tail=tail_param)

            # Store in appropriate deque
            if svc == "backend":
                self.backend_logs.clear()
                self.backend_logs.extend([self.sanitize_log_entry(log) for log in docker_logs])
            elif svc == "bot":
                self.bot_logs.clear()
                self.bot_logs.extend([self.sanitize_log_entry(log) for log in docker_logs])
            elif svc == "postgres":
                self.postgres_logs.clear()
                self.postgres_logs.extend([self.sanitize_log_entry(log) for log in docker_logs])
            elif svc == "nginx":
                self.nginx_logs.clear()
                self.nginx_logs.extend([self.sanitize_log_entry(log) for log in docker_logs])

        # Filter and slice logs
        result = {}
        total_count = 0
        filtered_count = 0

        for svc_name, svc_deque in self.SERVICE_NAMES.items():
            # Skip if service filter doesn't match
            if service and service != "all" and service != svc_name:
                result[svc_name] = []
                continue

            # Convert deque to list
            logs_list = list(svc_deque)
            total_count += len(logs_list)

            # Apply filters
            filtered = self.filter_logs(logs_list, level, since, until)

            # Sort by timestamp (newest first)
            filtered.sort(
                key=lambda x: self._parse_timestamp(x.get("timestamp")) if x.get("timestamp") else datetime.min,
                reverse=True
            )

            # Limit to top N
            filtered = filtered[:limit]
            filtered_count += len(filtered)

            result[svc_name] = filtered

        return {
            "browser": result.get("browser", []),
            "backend": result.get("backend", []),
            "bot": result.get("bot", []),
            "postgres": result.get("postgres", []),
            "nginx": result.get("nginx", []),
            "total_count": total_count,
            "filtered_count": filtered_count,
            "filters_applied": {
                "service": service or "all",
                "level": level or "all",
                "since": since.isoformat() if since else None,
                "until": until.isoformat() if until else None,
                "limit": limit
            }
        }

    def _normalize_level(self, level: str) -> str:
        """Normalize log level to lowercase."""
        level_map = {
            "DEBUG": "debug",
            "INFO": "info",
            "WARNING": "warning",
            "WARN": "warning",
            "ERROR": "error",
            "CRITICAL": "error",
            "FATAL": "error"
        }
        return level_map.get(level.upper(), "info")

    def _detect_level_from_text(self, line: str) -> str:
        """Detect log level from plain text line.

        Special handling for nginx access logs - uses HTTP status code.
        Format: IP - - [DATE] "REQUEST" STATUS SIZE
        """
        # Nginx access log detection: extract HTTP status code
        nginx_access_pattern = r'"[^"]*"\s+(\d{3})\s+'
        match = re.search(nginx_access_pattern, line)
        if match:
            status_code = int(match.group(1))
            if 200 <= status_code < 400:
                return "info"  # Success or redirect (2xx, 3xx)
            elif 400 <= status_code < 500:
                return "warning"  # Client error (4xx)
            elif 500 <= status_code < 600:
                return "error"  # Server error (5xx)

        # Fallback: keyword-based detection for other logs
        line_upper = line.upper()
        if "ERROR" in line_upper or "FATAL" in line_upper or "CRITICAL" in line_upper:
            return "error"
        elif "WARN" in line_upper:
            return "warning"
        else:
            return "info"

    def _parse_timestamp(self, timestamp_str: str) -> datetime:
        """
        Parse timestamp string to datetime.

        Supports:
        - ISO 8601: "2025-12-27T10:30:00Z"
        - ISO with microseconds: "2025-12-27T10:30:00.123456Z"
        - Local time: "2025-12-27T10:30:00"

        Always returns timezone-aware datetime (system timezone from SYSTEM_TIMEZONE env).
        """
        try:
            # Remove 'Z' suffix and parse
            timestamp_str = timestamp_str.replace('Z', '+00:00')
            dt = datetime.fromisoformat(timestamp_str)
            # Make timezone-aware if naive (assume system timezone)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=get_system_timezone())
            return dt
        except (ValueError, AttributeError):
            # Return timezone-aware datetime.min in system timezone
            return datetime.min.replace(tzinfo=get_system_timezone())

    def _parse_since_to_seconds(self, since: str) -> int:
        """
        Parse 'since' parameter to seconds for Docker API.

        Supports:
        - "1h" → 3600
        - "30m" → 1800
        - "2d" → 172800
        - "2025-12-27" → calculates delta from now

        Args:
            since: Time range string

        Returns:
            Number of seconds from now
        """
        try:
            # Check if it's a duration format (e.g., "1h", "30m", "2d")
            if since[-1] in ['h', 'm', 'd', 's']:
                unit = since[-1]
                value = int(since[:-1])

                if unit == 's':
                    return value
                elif unit == 'm':
                    return value * 60
                elif unit == 'h':
                    return value * 3600
                elif unit == 'd':
                    return value * 86400

            # Try parsing as date
            target_date = datetime.fromisoformat(since)
            delta = datetime.now() - target_date
            return int(delta.total_seconds())

        except (ValueError, IndexError):
            # Default to 1 hour if parsing fails
            logger.warning("[LOGS_COLLECTOR] Failed to parse since=%s, defaulting to 1h", since)
            return 3600
