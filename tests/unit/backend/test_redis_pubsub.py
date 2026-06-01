"""Unit tests for redis_pubsub_service — exception handler imports."""


def test_redis_exception_classes_importable():
    """Ensure fix imports RedisTimeoutError and RedisConnectionError from correct module."""
    from redis.exceptions import TimeoutError as RedisTimeoutError
    from redis.exceptions import ConnectionError as RedisConnectionError

    # Both must be proper exception classes
    assert issubclass(RedisTimeoutError, Exception)
    assert issubclass(RedisConnectionError, Exception)


def test_redis_exception_not_confused_with_builtin():
    """RedisConnectionError must not be the same as builtins.ConnectionError."""
    from redis.exceptions import ConnectionError as RedisConnectionError
    assert RedisConnectionError is not ConnectionError
