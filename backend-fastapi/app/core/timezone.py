"""
Timezone handling utilities for FastAPI application.

This module provides utilities to handle timezone-aware datetime objects
and convert them for PostgreSQL storage which expects TIMESTAMP WITHOUT TIME ZONE.
"""
from datetime import datetime, timezone
from typing import Optional, Union
import logging

logger = logging.getLogger(__name__)


def prepare_datetime_for_db(dt: Optional[Union[datetime, str]]) -> Optional[datetime]:
    """
    Prepare datetime object for database storage by stripping timezone info.

    PostgreSQL TIMESTAMP WITHOUT TIME ZONE columns cannot accept timezone-aware
    datetime objects. This function converts timezone-aware datetimes to naive
    datetimes by stripping the timezone information.

    Args:
        dt: Datetime object or string to prepare. Can be:
            - timezone-aware datetime: converts to UTC then strips timezone
            - timezone-naive datetime: returns as-is
            - string: attempts to parse then process
            - None: returns None

    Returns:
        Optional[datetime]: Timezone-naive datetime object suitable for database
                          storage, or None if input was None

    Raises:
        ValueError: If string datetime cannot be parsed
        TypeError: If input is not a valid datetime type

    Examples:
        >>> from datetime import datetime, timezone
        >>> aware_dt = datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc)
        >>> prepare_datetime_for_db(aware_dt)
        datetime(2025, 1, 15, 10, 30)

        >>> naive_dt = datetime(2025, 1, 15, 10, 30)
        >>> prepare_datetime_for_db(naive_dt)
        datetime(2025, 1, 15, 10, 30)

        >>> prepare_datetime_for_db(None)
        None
    """
    if dt is None:
        return None

    # Handle string input
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
        except ValueError as e:
            logger.error(f"Failed to parse datetime string '{dt}': {e}")
            raise ValueError(f"Invalid datetime string format: {dt}") from e

    # Validate input type
    if not isinstance(dt, datetime):
        raise TypeError(f"Expected datetime object or string, got {type(dt)}")

    # If timezone-aware, convert to UTC then strip timezone
    if dt.tzinfo is not None:
        # Convert to UTC first to maintain consistency
        utc_dt = dt.astimezone(timezone.utc)
        # Strip timezone info for database storage
        naive_dt = utc_dt.replace(tzinfo=None)
        logger.debug(f"Converted timezone-aware datetime {dt} to naive UTC {naive_dt}")
        return naive_dt

    # Already timezone-naive, return as-is
    logger.debug(f"Datetime {dt} is already timezone-naive, returning as-is")
    return dt


def prepare_datetime_fields_for_db(data: dict, *field_names: str) -> dict:
    """
    Prepare multiple datetime fields in a dictionary for database storage.

    Applies prepare_datetime_for_db to specified fields in the dictionary.
    Creates a copy of the input dictionary to avoid mutation.

    Args:
        data: Dictionary containing datetime fields
        *field_names: Names of fields to process

    Returns:
        dict: New dictionary with processed datetime fields

    Examples:
        >>> data = {
        ...     'start_date': datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc),
        ...     'end_date': datetime(2025, 1, 15, 18, 30, tzinfo=timezone.utc),
        ...     'name': 'Test Period'
        ... }
        >>> prepared = prepare_datetime_fields_for_db(data, 'start_date', 'end_date')
        >>> prepared['start_date'].tzinfo is None
        True
        >>> prepared['name']
        'Test Period'
    """
    if not isinstance(data, dict):
        raise TypeError(f"Expected dictionary, got {type(data)}")

    # Create a copy to avoid mutating the original
    prepared_data = data.copy()

    for field_name in field_names:
        if field_name in prepared_data:
            original_value = prepared_data[field_name]
            try:
                prepared_data[field_name] = prepare_datetime_for_db(original_value)
                logger.debug(f"Processed field '{field_name}': {original_value} -> {prepared_data[field_name]}")
            except (ValueError, TypeError) as e:
                logger.error(f"Failed to process datetime field '{field_name}' with value {original_value}: {e}")
                # Re-raise with more context
                raise ValueError(f"Invalid datetime in field '{field_name}': {original_value}") from e

    return prepared_data


def get_utc_now() -> datetime:
    """
    Get current UTC time as a timezone-naive datetime.

    This is useful for creating timestamps that will be stored in the database
    while maintaining UTC consistency.

    Returns:
        datetime: Current UTC time without timezone info

    Example:
        >>> now = get_utc_now()
        >>> now.tzinfo is None
        True
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def ensure_utc_for_comparison(dt: datetime) -> datetime:
    """
    Ensure datetime is in UTC for safe comparison operations.

    This function is useful when comparing datetimes that might have
    different timezone information.

    Args:
        dt: Datetime object to normalize

    Returns:
        datetime: UTC datetime (timezone-naive for database compatibility)

    Example:
        >>> local_dt = datetime(2025, 1, 15, 15, 30, tzinfo=timezone(timedelta(hours=3)))
        >>> utc_dt = ensure_utc_for_comparison(local_dt)
        >>> utc_dt.hour
        12
        >>> utc_dt.tzinfo is None
        True
    """
    if dt is None:
        return None

    if dt.tzinfo is None:
        # Assume naive datetime is already in UTC
        logger.debug(f"Assuming naive datetime {dt} is in UTC")
        return dt

    # Convert to UTC and strip timezone
    utc_dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    logger.debug(f"Converted {dt} to UTC: {utc_dt}")
    return utc_dt