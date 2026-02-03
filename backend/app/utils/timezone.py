"""
Timezone utility functions for Family Budget.

Uses Python 3.9+ zoneinfo module (no external dependencies).
All internal storage is UTC. Conversions happen at API boundaries.

Usage:
    # Convert user's local time to UTC for storage
    reminder_utc = to_utc(user_input_datetime, user.timezone)

    # Convert UTC from DB to user's local time for display
    display_time = from_utc(db_datetime, user.timezone)

    # Get current time
    now = now_utc()  # For storage
    now_user = now_local(user.timezone)  # For display
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo, available_timezones


def get_system_timezone() -> ZoneInfo:
    """
    Get system timezone from settings.

    Returns:
        ZoneInfo: System timezone configured in SYSTEM_TIMEZONE env var
    """
    from backend.app.core.config import get_settings

    return ZoneInfo(get_settings().SYSTEM_TIMEZONE)


def get_user_timezone(user_tz: str | None = None) -> ZoneInfo:
    """
    Get user timezone or fallback to system timezone.

    Args:
        user_tz: IANA timezone string (e.g., "Europe/Moscow") or None

    Returns:
        ZoneInfo: User's timezone or system default if None
    """
    if user_tz:
        return ZoneInfo(user_tz)
    return get_system_timezone()


def to_utc(dt: datetime, user_tz: str | None = None) -> datetime:
    """
    Convert datetime from user timezone to UTC for storage.

    If dt is naive (no tzinfo), assumes it's in user's timezone.
    If dt is aware, converts to UTC.

    Args:
        dt: Datetime to convert
        user_tz: User's IANA timezone string or None for system default

    Returns:
        datetime: Timezone-aware datetime in UTC
    """
    tz = get_user_timezone(user_tz)

    if dt.tzinfo is None:
        # Naive datetime - assume user's timezone
        dt = dt.replace(tzinfo=tz)

    return dt.astimezone(timezone.utc)


def from_utc(dt: datetime, user_tz: str | None = None) -> datetime:
    """
    Convert datetime from UTC to user timezone for display.

    If dt is naive (no tzinfo), assumes it's UTC.
    Returns timezone-aware datetime in user's timezone.

    Args:
        dt: Datetime in UTC
        user_tz: User's IANA timezone string or None for system default

    Returns:
        datetime: Timezone-aware datetime in user's timezone
    """
    tz = get_user_timezone(user_tz)

    if dt.tzinfo is None:
        # Naive datetime - assume UTC
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(tz)


def now_utc() -> datetime:
    """
    Get current UTC datetime (timezone-aware).

    Use this for all timestamp storage in database.

    Returns:
        datetime: Current time in UTC with tzinfo
    """
    return datetime.now(timezone.utc)


def now_local(user_tz: str | None = None) -> datetime:
    """
    Get current datetime in user's timezone.

    Use this for display or date calculations relative to user's local time.

    Args:
        user_tz: User's IANA timezone string or None for system default

    Returns:
        datetime: Current time in user's timezone
    """
    return from_utc(now_utc(), user_tz)


def is_valid_timezone(tz_name: str) -> bool:
    """
    Check if timezone name is valid IANA timezone.

    Args:
        tz_name: Timezone name to validate (e.g., "Europe/Moscow")

    Returns:
        bool: True if valid, False otherwise
    """
    return tz_name in available_timezones()


def get_common_timezones() -> list[dict]:
    """
    Get list of common timezones with UTC offsets for UI.

    Returns list of dicts with:
    - name: IANA timezone name
    - offset: Formatted UTC offset (e.g., "UTC+03:00")
    - display: Human-readable format for dropdown

    Returns:
        list[dict]: List of timezone info dicts
    """
    common = [
        "UTC",
        "Europe/Moscow",
        "Europe/Kaliningrad",
        "Europe/Samara",
        "Asia/Yekaterinburg",
        "Asia/Omsk",
        "Asia/Krasnoyarsk",
        "Asia/Irkutsk",
        "Asia/Yakutsk",
        "Asia/Vladivostok",
        "Asia/Magadan",
        "Asia/Kamchatka",
        "Europe/London",
        "Europe/Paris",
        "Europe/Berlin",
        "America/New_York",
        "America/Chicago",
        "America/Los_Angeles",
        "Asia/Tokyo",
        "Asia/Shanghai",
        "Asia/Dubai",
        "Australia/Sydney",
    ]

    result = []
    now = datetime.now(timezone.utc)

    for tz_name in common:
        try:
            tz = ZoneInfo(tz_name)
            local_time = now.astimezone(tz)
            offset = local_time.strftime("%z")
            # Format: +0300 -> +03:00
            offset_formatted = f"UTC{offset[:3]}:{offset[3:]}"
            result.append(
                {
                    "name": tz_name,
                    "offset": offset_formatted,
                    "display": f"({offset_formatted}) {tz_name}",
                }
            )
        except Exception:
            # Skip invalid timezones
            continue

    return result


def format_datetime_local(
    dt: datetime, user_tz: str | None = None, fmt: str = "%d.%m.%Y %H:%M"
) -> str:
    """
    Format datetime in user's timezone.

    Convenience function that combines from_utc + strftime.

    Args:
        dt: Datetime in UTC
        user_tz: User's IANA timezone string or None for system default
        fmt: strftime format string (default: "DD.MM.YYYY HH:MM")

    Returns:
        str: Formatted datetime string in user's timezone
    """
    local_dt = from_utc(dt, user_tz)
    return local_dt.strftime(fmt)
