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

import asyncio
import json
import re
import subprocess
from collections import deque
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

from backend.app.core.logging import get_logger

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
        logger.info("[LOGS_COLLECTOR] LogsCollectorService initialized")

    async def collect_docker_logs(
        self,
        service: str,
        since: str = "1h",
        tail: int = 500
    ) -> List[Dict[str, Any]]:
        """
        Collect logs from Docker container using subprocess.

        Args:
            service: Container name (backend, bot, postgres, nginx)
            since: Time range (e.g., "1h", "30m", "2025-12-27")
            tail: Number of recent lines to retrieve

        Returns:
            List of log entries with parsed JSON (for backend/bot) or plain text

        Raises:
            No exceptions raised - errors are logged and empty list returned
        """
        logger.info(f"[LOGS_COLLECTOR] Collecting Docker logs for service={service}, since={since}, tail={tail}")

        cmd = [
            "docker", "compose",
            "-f", "/opt/budget/docker-compose.yml",
            "logs",
            "--tail", str(tail),
            "--since", since,
            "--no-log-prefix",  # Remove Docker timestamp prefix
            service
        ]

        try:
            # Use asyncio subprocess for non-blocking execution
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            # Wait with timeout
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=10.0
            )

            if process.returncode != 0:
                logger.error(
                    f"[LOGS_COLLECTOR] Docker logs command failed for service={service}, "
                    f"returncode={process.returncode}, stderr={stderr.decode()[:500]}"
                )
                return []

            # Parse logs
            logs = []
            for line in stdout.decode().splitlines():
                if not line.strip():
                    continue

                # Parse JSON logs from backend/bot
                if service in ["backend", "bot"]:
                    try:
                        log_entry = json.loads(line)
                        logs.append({
                            "timestamp": log_entry.get("timestamp"),
                            "level": self._normalize_level(log_entry.get("level", "INFO")),
                            "message": log_entry.get("message", ""),
                            "module": log_entry.get("module") or log_entry.get("logger_name") or service,
                            "correlation_id": log_entry.get("correlation_id")
                        })
                    except json.JSONDecodeError:
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

            logger.info(f"[LOGS_COLLECTOR] Collected {len(logs)} logs from service={service}")
            return logs

        except asyncio.TimeoutError:
            logger.error(f"[LOGS_COLLECTOR] Timeout collecting logs for service={service}")
            return []
        except FileNotFoundError:
            logger.error(f"[LOGS_COLLECTOR] Docker compose not found - check PATH and installation")
            return []
        except Exception as e:
            logger.error(f"[LOGS_COLLECTOR] Error collecting logs for service={service}: {e}", exc_info=True)
            return []

    def collect_browser_logs(
        self,
        logs: List[Dict[str, Any]],
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
        logger.info(f"[LOGS_COLLECTOR] Receiving {len(logs)} browser logs from user_id={user_id}")

        stored_count = 0
        for log in logs:
            # Add user_id to log entry for admin visibility
            log["user_id"] = user_id

            # Sanitize before storing
            sanitized_log = self.sanitize_log_entry(log)

            # Store in browser_logs deque
            self.browser_logs.append(sanitized_log)
            stored_count += 1

        logger.info(f"[LOGS_COLLECTOR] Stored {stored_count} browser logs, total buffer size={len(self.browser_logs)}")
        return stored_count

    def filter_logs(
        self,
        logs: List[Dict[str, Any]],
        level: Optional[str] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
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
            logger.debug(f"[LOGS_COLLECTOR] After level filter ({level}): {len(filtered)} logs")

        # Filter by date range
        if since:
            filtered = [
                log for log in filtered
                if log.get("timestamp") and self._parse_timestamp(log["timestamp"]) >= since
            ]
            logger.debug(f"[LOGS_COLLECTOR] After since filter ({since}): {len(filtered)} logs")

        if until:
            filtered = [
                log for log in filtered
                if log.get("timestamp") and self._parse_timestamp(log["timestamp"]) <= until
            ]
            logger.debug(f"[LOGS_COLLECTOR] After until filter ({until}): {len(filtered)} logs")

        return filtered

    def sanitize_log_entry(self, log: Dict[str, Any]) -> Dict[str, Any]:
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
        service: Optional[str] = None,
        level: Optional[str] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
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
        logger.info(
            f"[LOGS_COLLECTOR] get_all_logs called: service={service}, level={level}, "
            f"since={since}, until={until}, limit={limit}"
        )

        # Refresh Docker logs (collect latest)
        if service == "all" or service is None:
            services_to_collect = ["backend", "bot", "postgres", "nginx"]
        elif service == "browser":
            services_to_collect = []
        else:
            services_to_collect = [service]

        # Collect Docker logs asynchronously
        for svc in services_to_collect:
            docker_logs = await self.collect_docker_logs(svc, since="1h", tail=500)

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

        logger.info(
            f"[LOGS_COLLECTOR] Returning {filtered_count} logs (from {total_count} total) "
            f"across {len([v for v in result.values() if v])} services"
        )

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
        """Detect log level from plain text line."""
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
        """
        try:
            # Remove 'Z' suffix and parse
            timestamp_str = timestamp_str.replace('Z', '+00:00')
            return datetime.fromisoformat(timestamp_str)
        except (ValueError, AttributeError):
            return datetime.min
