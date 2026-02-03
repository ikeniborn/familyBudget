"""
Write-Behind Queue Service for async PostgreSQL writes.

This module implements a write-behind pattern where write operations are
first queued in Redis and then asynchronously written to PostgreSQL
by a background worker.

Benefits:
    - Lower API latency (~10ms vs ~50ms for sync writes)
    - Decoupled write operations from API response
    - Automatic retry with exponential backoff
    - Dead Letter Queue (DLQ) for failed writes

Architecture:
    1. API endpoint validates input and pushes to Redis queue (RPUSH)
    2. API returns 201 Created immediately (fast!)
    3. Background worker BLPOPs from queue
    4. Worker writes to PostgreSQL
    5. Worker invalidates cache and broadcasts WebSocket event
    6. On failure: retry with exponential backoff, then DLQ

Redis Keys:
    - write_queue:facts - Main write queue (LIST)
    - write_queue:facts:failed - Dead Letter Queue (LIST)
    - write_queue:facts:lock - Processing lock (STRING with NX EX)

Usage:
    # Queue a write operation
    await write_behind_service.queue_fact_create(fact_data)

    # Start background worker (call from main.py lifespan)
    await start_write_behind_worker()

    # Stop worker (call from main.py shutdown)
    await stop_write_behind_worker()
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from backend.app.core.config import get_settings
from backend.app.core.json_utils import dumps as json_dumps, loads as json_loads
from backend.app.models.budget_fact_history import FAR_FUTURE_DATETIME
from backend.app.services.redis_service import get_redis, is_redis_available

logger = logging.getLogger(__name__)

# Redis keys
QUEUE_KEY = "write_queue:facts"
DLQ_KEY = "write_queue:facts:failed"
LOCK_KEY = "write_queue:facts:lock"
STATS_KEY = "write_queue:facts:stats"

# Configuration (defaults, can be overridden via settings)
INITIAL_BACKOFF_MS = 100
MAX_BACKOFF_MS = 5000
LOCK_TTL_SECONDS = 30
WORKER_POLL_INTERVAL = 0.1  # 100ms


def _get_max_retries() -> int:
    """Get max retries from settings."""
    return get_settings().WRITE_BEHIND_MAX_RETRIES


def _get_batch_size() -> int:
    """Get batch size from settings."""
    return get_settings().WRITE_BEHIND_BATCH_SIZE


def _get_dlq_ttl_seconds() -> int:
    """Get DLQ TTL in seconds from settings."""
    return get_settings().WRITE_BEHIND_DLQ_TTL_DAYS * 24 * 60 * 60


def _get_dlq_max_size() -> int:
    """Get DLQ max size from settings."""
    return get_settings().WRITE_BEHIND_DLQ_MAX_SIZE


class WriteOperation(str, Enum):
    """Write operation types."""
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class WriteQueueItem:
    """Represents an item in the write queue."""

    def __init__(
        self,
        operation: WriteOperation,
        entity_type: str,
        data: dict[str, Any],
        user_id: int,
        request_id: str | None = None,
        retries: int = 0,
        created_at: float | None = None,
    ):
        self.operation = operation
        self.entity_type = entity_type
        self.data = data
        self.user_id = user_id
        self.request_id = request_id or str(uuid.uuid4())
        self.retries = retries
        self.created_at = created_at or time.time()

    def to_json(self) -> str:
        """Serialize to JSON string for Redis."""
        return json_dumps({
            "operation": self.operation.value,
            "entity_type": self.entity_type,
            "data": self.data,
            "user_id": self.user_id,
            "request_id": self.request_id,
            "retries": self.retries,
            "created_at": self.created_at,
        })

    @classmethod
    def from_json(cls, json_str: str) -> "WriteQueueItem":
        """Deserialize from JSON string."""
        data = json_loads(json_str)
        return cls(
            operation=WriteOperation(data["operation"]),
            entity_type=data["entity_type"],
            data=data["data"],
            user_id=data["user_id"],
            request_id=data.get("request_id"),
            retries=data.get("retries", 0),
            created_at=data.get("created_at"),
        )


class WriteBehindService:
    """
    Write-Behind Queue Service.

    Provides async write operations via Redis queue with background processing.
    """

    def __init__(self):
        self._worker_task: asyncio.Task | None = None
        self._running = False
        self._worker_id = str(uuid.uuid4())[:8]
        self._stats = {
            "queued": 0,
            "processed": 0,
            "failed": 0,
            "retried": 0,
        }

    def is_enabled(self) -> bool:
        """Check if write-behind is enabled and Redis is available."""
        settings = get_settings()
        return settings.WRITE_BEHIND_ENABLED and is_redis_available()

    async def queue_fact_create(
        self,
        pre_generated_id: int,
        user_id: int,
        article_id: int,
        amount: float,
        fact_date: str,
        description: str | None = None,
        financial_center_id: int | None = None,
        cost_center_id: int | None = None,
        record_type: str = "fact",
        is_offline_sync: bool = False,
        sync_hash: str | None = None,
        content_hash: str | None = None,
        changed_by_user_id: int | None = None,
    ) -> str | None:
        """
        Queue a fact creation operation.

        Args:
            pre_generated_id: Pre-generated ID from PostgreSQL sequence for immediate return.
            user_id: User who owns the fact.
            article_id: Budget article/category ID.
            amount: Transaction amount (positive value).
            fact_date: Date of transaction (ISO format string).
            description: Optional transaction description.
            financial_center_id: Optional financial center ID.
            cost_center_id: Optional cost center ID.
            record_type: Record type ('fact' or 'plan').
            is_offline_sync: True if created via offline sync.
            sync_hash: Offline sync deduplication hash.
            content_hash: Content hash for duplicate detection.
            changed_by_user_id: User who initiated the change (for history).

        Returns:
            str: Request ID if queued successfully, None if write-behind is disabled.
        """
        if not self.is_enabled():
            return None

        item = WriteQueueItem(
            operation=WriteOperation.CREATE,
            entity_type="fact",
            data={
                "pre_generated_id": pre_generated_id,
                "article_id": article_id,
                "amount": amount,
                "fact_date": fact_date,
                "description": description,
                "financial_center_id": financial_center_id,
                "cost_center_id": cost_center_id,
                "record_type": record_type,
                "is_offline_sync": is_offline_sync,
                "sync_hash": sync_hash,
                "content_hash": content_hash,
                "changed_by_user_id": changed_by_user_id,
            },
            user_id=user_id,
        )

        return await self._queue_item(item)

    async def queue_fact_update(
        self,
        fact_id: int,
        user_id: int,
        updates: dict[str, Any],
    ) -> str | None:
        """
        Queue a fact update operation.

        Returns:
            str: Request ID if queued successfully, None if write-behind is disabled.
        """
        if not self.is_enabled():
            return None

        item = WriteQueueItem(
            operation=WriteOperation.UPDATE,
            entity_type="fact",
            data={
                "fact_id": fact_id,
                **updates,
            },
            user_id=user_id,
        )

        return await self._queue_item(item)

    async def queue_fact_delete(self, fact_id: int, user_id: int) -> str | None:
        """
        Queue a fact deletion operation.

        Returns:
            str: Request ID if queued successfully, None if write-behind is disabled.
        """
        if not self.is_enabled():
            return None

        item = WriteQueueItem(
            operation=WriteOperation.DELETE,
            entity_type="fact",
            data={"fact_id": fact_id},
            user_id=user_id,
        )

        return await self._queue_item(item)

    async def _queue_item(self, item: WriteQueueItem) -> str:
        """Push item to Redis queue."""
        try:
            async with get_redis() as redis:
                await redis.rpush(QUEUE_KEY, item.to_json())
                self._stats["queued"] += 1
                logger.debug(
                    f"Write-behind queued: {item.operation.value} {item.entity_type} "
                    f"request_id={item.request_id}"
                )
                return item.request_id
        except Exception as e:
            logger.error(f"Failed to queue write operation: {e}")
            raise

    async def _process_item(self, item: WriteQueueItem) -> bool:
        """
        Process a single queue item.

        Returns:
            bool: True if processed successfully, False if failed.
        """
        try:
            # Import here to avoid circular imports
            from backend.app.db.session import get_session
            from backend.app.services.cache_service import cache_service

            async for session in get_session():
                if item.entity_type == "fact":
                    await self._process_fact(session, item)

                # Invalidate cache
                await cache_service.invalidate_dashboard()

                # Broadcast WebSocket event
                await self._broadcast_event(item)

                await session.commit()
                self._stats["processed"] += 1
                logger.info(
                    f"Write-behind processed: {item.operation.value} {item.entity_type} "
                    f"request_id={item.request_id}"
                )
                return True

        except Exception as e:
            logger.error(
                f"Write-behind failed: {item.operation.value} {item.entity_type} "
                f"request_id={item.request_id} error={e}"
            )
            return False

    async def _process_fact(self, session, item: WriteQueueItem):
        """Process fact operations with complete history tracking."""
        from datetime import date, timezone
        from datetime import datetime as dt

        from sqlmodel import select

        from backend.app.models import BudgetFact, BudgetFactHistory

        now = dt.now(timezone.utc)

        # Parse fact_date from string (JSON serialization converts date to string)
        fact_date_raw = item.data.get("fact_date")
        if isinstance(fact_date_raw, str):
            fact_date = date.fromisoformat(fact_date_raw)
        else:
            fact_date = fact_date_raw

        if item.operation == WriteOperation.CREATE:
            # Create new fact with pre-generated ID
            fact = BudgetFact(
                id=item.data.get("pre_generated_id"),  # Use pre-generated ID
                user_id=item.user_id,
                article_id=item.data["article_id"],
                amount=item.data["amount"],
                fact_date=fact_date,
                description=item.data.get("description"),
                financial_center_id=item.data.get("financial_center_id"),
                cost_center_id=item.data.get("cost_center_id"),
                record_type=item.data.get("record_type", "fact"),
                is_offline_sync=item.data.get("is_offline_sync", False),
                sync_hash=item.data.get("sync_hash"),
                content_hash=item.data.get("content_hash"),
            )
            session.add(fact)
            await session.flush()

            # Store fact_id for broadcast
            item.data["created_fact_id"] = fact.id

            # Create history record with ALL required fields
            history = BudgetFactHistory(
                fact_id=fact.id,
                user_id=fact.user_id,
                article_id=fact.article_id,
                financial_center_id=fact.financial_center_id,
                cost_center_id=fact.cost_center_id,
                amount=fact.amount,
                fact_date=fact.fact_date,
                description=fact.description,
                record_type=fact.record_type,
                transfer_id=fact.transfer_id,
                is_offline_sync=fact.is_offline_sync,
                valid_from=now,
                valid_to=FAR_FUTURE_DATETIME,
                is_current=True,
                change_type="CREATE",
                changed_fields=None,  # No changed fields for CREATE
                changed_by_user_id=item.data.get("changed_by_user_id"),
                cascade_delete_source=None,
            )
            session.add(history)

        elif item.operation == WriteOperation.UPDATE:
            fact_id = item.data.get("fact_id")
            if fact_id is None:
                raise ValueError("fact_id is required for UPDATE operation")

            result = await session.execute(
                select(BudgetFact).where(BudgetFact.id == fact_id)
            )
            fact = result.scalar_one_or_none()
            if fact is None:
                raise ValueError(f"Fact {fact_id} not found")

            # Track which fields changed
            changed_fields = []
            update_data = {k: v for k, v in item.data.items()
                          if k not in ("fact_id", "changed_by_user_id")}

            # Parse fact_date if present (JSON serialization converts date to string)
            if "fact_date" in update_data and isinstance(update_data["fact_date"], str):
                update_data["fact_date"] = date.fromisoformat(update_data["fact_date"])

            for key, value in update_data.items():
                if hasattr(fact, key) and getattr(fact, key) != value:
                    changed_fields.append(key)
                    setattr(fact, key, value)

            fact.updated_at = now

            # Close previous history record (set valid_to, is_current=False)
            prev_history_result = await session.execute(
                select(BudgetFactHistory)
                .where(BudgetFactHistory.fact_id == fact.id)
                .where(BudgetFactHistory.is_current == True)
            )
            prev_history = prev_history_result.scalar_one_or_none()
            if prev_history:
                prev_history.is_current = False
                prev_history.valid_to = now

            # Create new history record
            history = BudgetFactHistory(
                fact_id=fact.id,
                user_id=fact.user_id,
                article_id=fact.article_id,
                financial_center_id=fact.financial_center_id,
                cost_center_id=fact.cost_center_id,
                amount=fact.amount,
                fact_date=fact.fact_date,
                description=fact.description,
                record_type=fact.record_type,
                transfer_id=fact.transfer_id,
                is_offline_sync=fact.is_offline_sync,
                valid_from=now,
                valid_to=FAR_FUTURE_DATETIME,
                is_current=True,
                change_type="UPDATE",
                changed_fields=changed_fields if changed_fields else None,
                changed_by_user_id=item.data.get("changed_by_user_id"),
                cascade_delete_source=None,
            )
            session.add(history)

        elif item.operation == WriteOperation.DELETE:
            fact_id = item.data.get("fact_id")
            if fact_id is None:
                raise ValueError("fact_id is required for DELETE operation")

            result = await session.execute(
                select(BudgetFact).where(BudgetFact.id == fact_id)
            )
            fact = result.scalar_one_or_none()
            if fact is None:
                raise ValueError(f"Fact {fact_id} not found")

            # Close previous history record
            prev_history_result = await session.execute(
                select(BudgetFactHistory)
                .where(BudgetFactHistory.fact_id == fact.id)
                .where(BudgetFactHistory.is_current == True)
            )
            prev_history = prev_history_result.scalar_one_or_none()
            if prev_history:
                prev_history.is_current = False
                prev_history.valid_to = now

            # Create DELETE history record before deletion
            history = BudgetFactHistory(
                fact_id=fact.id,
                user_id=fact.user_id,
                article_id=fact.article_id,
                financial_center_id=fact.financial_center_id,
                cost_center_id=fact.cost_center_id,
                amount=fact.amount,
                fact_date=fact.fact_date,
                description=fact.description,
                record_type=fact.record_type,
                transfer_id=fact.transfer_id,
                is_offline_sync=fact.is_offline_sync,
                valid_from=now,
                valid_to=now,  # DELETE records have same valid_from and valid_to
                is_current=False,  # DELETE records are never current
                change_type="DELETE",
                changed_fields=None,
                changed_by_user_id=item.data.get("changed_by_user_id"),
                cascade_delete_source=item.data.get("cascade_delete_source"),
            )
            session.add(history)
            await session.delete(fact)

    async def _broadcast_event(self, item: WriteQueueItem):
        """Broadcast WebSocket event for the write operation.

        Matches the sync path broadcast format (budget_ws.py:893-897):
        - Uses SAFE_FACT_FIELDS for filtering
        - Distinguishes between fact_created and plan_created events
        - Includes 'id' field (from pre_generated_id or fact_id)
        """
        try:
            from backend.app.services.redis_ws_manager import get_ws_manager

            manager = get_ws_manager()

            # Use pre_generated_id as the fact id for broadcast
            fact_id = item.data.get("pre_generated_id") or item.data.get("fact_id")

            # Determine event type based on record_type and operation
            # (matching sync path behavior in facts.py:373-376)
            record_type = item.data.get("record_type", "fact")
            if item.operation == WriteOperation.CREATE:
                event_type = "plan_created" if record_type == "plan" else "fact_created"
            elif item.operation == WriteOperation.UPDATE:
                event_type = "plan_updated" if record_type == "plan" else "fact_updated"
            elif item.operation == WriteOperation.DELETE:
                event_type = "plan_deleted" if record_type == "plan" else "fact_deleted"
            else:
                event_type = f"{item.entity_type}_{item.operation.value.lower()}d"

            # Filter data to only safe fields (matching budget_ws.py:854-857)
            SAFE_FACT_FIELDS = {
                "id", "article_id", "financial_center_id", "cost_center_id",
                "amount", "fact_date", "description", "record_type", "transfer_id",
            }

            # Build broadcast data with id field
            broadcast_data = {"id": fact_id}
            for key, value in item.data.items():
                if key in SAFE_FACT_FIELDS:
                    broadcast_data[key] = value

            await manager.broadcast(event_type, broadcast_data)
            logger.debug(
                f"Write-behind broadcast: {event_type}, id={fact_id}"
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast write-behind event: {e}")

    async def _retry_item(self, item: WriteQueueItem):
        """Retry a failed item with exponential backoff."""
        item.retries += 1
        max_retries = _get_max_retries()

        if item.retries >= max_retries:
            # Move to DLQ
            await self._move_to_dlq(item, "max_retries_exceeded")
            self._stats["failed"] += 1
            return

        # Calculate backoff
        backoff_ms = min(
            INITIAL_BACKOFF_MS * (2 ** item.retries),
            MAX_BACKOFF_MS
        )

        logger.warning(
            f"Write-behind retry {item.retries}/{max_retries}: "
            f"{item.operation.value} {item.entity_type} "
            f"request_id={item.request_id} backoff={backoff_ms}ms"
        )

        # Wait and re-queue
        await asyncio.sleep(backoff_ms / 1000)

        try:
            async with get_redis() as redis:
                await redis.rpush(QUEUE_KEY, item.to_json())
                self._stats["retried"] += 1
        except Exception as e:
            logger.error(f"Failed to re-queue item: {e}")
            await self._move_to_dlq(item, str(e))
            self._stats["failed"] += 1

    async def _move_to_dlq(self, item: WriteQueueItem, error: str):
        """Move a failed item to the Dead Letter Queue.

        Applies DLQ size limit (oldest items removed when exceeded).
        TTL-based cleanup is performed periodically by _cleanup_dlq().
        """
        try:
            async with get_redis() as redis:
                dlq_item = {
                    "item": json_loads(item.to_json()),
                    "error": error,
                    "failed_at": datetime.utcnow().isoformat(),
                    "worker_id": self._worker_id,
                }
                await redis.rpush(DLQ_KEY, json_dumps(dlq_item))
                logger.error(
                    f"Write-behind DLQ: {item.operation.value} {item.entity_type} "
                    f"request_id={item.request_id} error={error}"
                )

                # Trim DLQ to max size (keep newest items)
                max_size = _get_dlq_max_size()
                dlq_len = await redis.llen(DLQ_KEY)
                if dlq_len > max_size:
                    # Remove oldest items (from left side)
                    items_to_remove = dlq_len - max_size
                    for _ in range(items_to_remove):
                        await redis.lpop(DLQ_KEY)
                    logger.warning(
                        f"DLQ trimmed: removed {items_to_remove} oldest items, "
                        f"max_size={max_size}"
                    )
        except Exception as e:
            logger.error(f"Failed to move to DLQ: {e}")

    async def _cleanup_dlq(self):
        """Remove expired items from DLQ based on TTL.

        Called periodically from worker loop.
        """
        try:
            async with get_redis() as redis:
                dlq_len = await redis.llen(DLQ_KEY)
                if dlq_len == 0:
                    return

                ttl_seconds = _get_dlq_ttl_seconds()
                now = datetime.utcnow()
                removed_count = 0

                # Check items from oldest (left) to newest (right)
                # Stop when we find a non-expired item
                while True:
                    item_json = await redis.lindex(DLQ_KEY, 0)
                    if item_json is None:
                        break

                    try:
                        item_data = json_loads(item_json)
                        failed_at = datetime.fromisoformat(item_data.get("failed_at", ""))
                        age_seconds = (now - failed_at).total_seconds()

                        if age_seconds > ttl_seconds:
                            await redis.lpop(DLQ_KEY)
                            removed_count += 1
                        else:
                            # Items are ordered by time, so stop here
                            break
                    except ValueError:
                        # Invalid item, remove it
                        await redis.lpop(DLQ_KEY)
                        removed_count += 1

                if removed_count > 0:
                    logger.info(
                        f"DLQ cleanup: removed {removed_count} expired items "
                        f"(TTL={ttl_seconds // 86400} days)"
                    )
        except Exception as e:
            logger.warning(f"DLQ cleanup failed: {e}")

    async def _acquire_lock(self) -> bool:
        """Acquire processing lock."""
        try:
            async with get_redis() as redis:
                result = await redis.set(
                    LOCK_KEY,
                    self._worker_id,
                    nx=True,
                    ex=LOCK_TTL_SECONDS
                )
                return result is not None
        except Exception:
            return False

    async def _release_lock(self):
        """Release processing lock."""
        try:
            async with get_redis() as redis:
                current = await redis.get(LOCK_KEY)
                if current and current == self._worker_id:
                    await redis.delete(LOCK_KEY)
        except Exception:
            pass

    async def _refresh_lock(self):
        """Refresh lock TTL."""
        try:
            async with get_redis() as redis:
                current = await redis.get(LOCK_KEY)
                if current and current == self._worker_id:
                    await redis.expire(LOCK_KEY, LOCK_TTL_SECONDS)
        except Exception:
            pass

    async def _worker_loop(self):
        """Main worker loop for processing queue items."""
        logger.info(f"Write-behind worker started: worker_id={self._worker_id}")

        # DLQ cleanup interval (every 60 seconds)
        dlq_cleanup_interval = 60
        last_dlq_cleanup = 0

        while self._running:
            try:
                # Periodic DLQ cleanup
                import time
                current_time = time.time()
                if current_time - last_dlq_cleanup > dlq_cleanup_interval:
                    await self._cleanup_dlq()
                    last_dlq_cleanup = current_time

                # Try to acquire lock
                if not await self._acquire_lock():
                    # Another worker has the lock
                    await asyncio.sleep(WORKER_POLL_INTERVAL)
                    continue

                try:
                    # Process items
                    async with get_redis() as redis:
                        # BLPOP with timeout
                        result = await redis.blpop(QUEUE_KEY, timeout=1)

                        if result is None:
                            # No items in queue
                            continue

                        _, item_json = result
                        item = WriteQueueItem.from_json(item_json)

                        # Process the item
                        success = await self._process_item(item)

                        if not success:
                            await self._retry_item(item)

                        # Refresh lock
                        await self._refresh_lock()

                finally:
                    await self._release_lock()

            except asyncio.CancelledError:
                logger.info("Write-behind worker cancelled")
                break
            except Exception as e:
                logger.error(f"Write-behind worker error: {e}")
                await asyncio.sleep(1)  # Prevent tight loop on errors

        logger.info(f"Write-behind worker stopped: worker_id={self._worker_id}")

    async def start_worker(self) -> None:
        """Start the background worker."""
        if self._worker_task is not None:
            logger.warning("Write-behind worker already running")
            return

        if not self.is_enabled():
            logger.info("Write-behind is disabled, skipping worker start")
            return

        self._running = True
        self._worker_task = asyncio.create_task(self._worker_loop())
        logger.info("Write-behind worker task created")

    async def stop_worker(self) -> None:
        """Stop the background worker."""
        if self._worker_task is None:
            return

        self._running = False

        # Cancel the task
        self._worker_task.cancel()
        try:
            await self._worker_task
        except asyncio.CancelledError:
            pass

        self._worker_task = None
        logger.info("Write-behind worker stopped")

    async def get_queue_stats(self) -> dict[str, Any]:
        """Get queue statistics."""
        stats = dict(self._stats)

        if is_redis_available():
            try:
                async with get_redis() as redis:
                    stats["queue_length"] = await redis.llen(QUEUE_KEY)
                    stats["dlq_length"] = await redis.llen(DLQ_KEY)
            except Exception:
                stats["queue_length"] = -1
                stats["dlq_length"] = -1
        else:
            stats["queue_length"] = -1
            stats["dlq_length"] = -1

        stats["worker_id"] = self._worker_id
        stats["running"] = self._running
        stats["enabled"] = self.is_enabled()

        return stats


# Singleton instance
write_behind_service = WriteBehindService()


async def start_write_behind_worker() -> None:
    """Start write-behind worker (call from main.py lifespan startup)."""
    await write_behind_service.start_worker()


async def stop_write_behind_worker() -> None:
    """Stop write-behind worker (call from main.py lifespan shutdown)."""
    await write_behind_service.stop_worker()
