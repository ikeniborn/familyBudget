import asyncpg
from asyncpg import PostgresError
from typing import Any, List, Optional, Union
import logging

logger = logging.getLogger(__name__)


class PostgresSecure:
    """Secure PostgreSQL database class with parameterized queries and connection pooling"""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 5432,
        database: str = "postgres",
        user: str = "postgres",
        password: str = "postgres",
        min_pool_size: int = 10,
        max_pool_size: int = 20,
    ) -> None:
        self._host = host
        self._port = port
        self._database = database
        self._user = user
        self._password = password
        self._min_pool_size = min_pool_size
        self._max_pool_size = max_pool_size
        self._pool: Optional[asyncpg.Pool] = None

    async def init_pool(self) -> None:
        """Initialize connection pool"""
        if not self._pool:
            self._pool = await asyncpg.create_pool(
                host=self._host,
                port=self._port,
                user=self._user,
                password=self._password,
                database=self._database,
                min_size=self._min_pool_size,
                max_size=self._max_pool_size,
            )
            logger.info("Database connection pool initialized")

    async def close_pool(self) -> None:
        """Close connection pool"""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Database connection pool closed")

    async def execute(self, query: str, *args) -> str:
        """Execute a query without returning results (INSERT, UPDATE, DELETE)"""
        if not self._pool:
            await self.init_pool()
        
        try:
            async with self._pool.acquire() as connection:
                async with connection.transaction():
                    result = await connection.execute(query, *args)
                    logger.debug(f"Executed query: {query[:100]}... with {len(args)} parameters")
                    return result
        except PostgresError as e:
            logger.error(f"Database error: {e}")
            raise

    async def fetchall(self, query: str, *args) -> List[asyncpg.Record]:
        """Execute a SELECT query and return all results"""
        if not self._pool:
            await self.init_pool()
        
        try:
            async with self._pool.acquire() as connection:
                rows = await connection.fetch(query, *args)
                logger.debug(f"Fetched {len(rows)} rows")
                return rows
        except PostgresError as e:
            logger.error(f"Database error: {e}")
            raise

    async def fetchone(self, query: str, *args) -> Optional[asyncpg.Record]:
        """Execute a SELECT query and return first result"""
        if not self._pool:
            await self.init_pool()
        
        try:
            async with self._pool.acquire() as connection:
                row = await connection.fetchrow(query, *args)
                logger.debug(f"Fetched {'1' if row else '0'} row")
                return row
        except PostgresError as e:
            logger.error(f"Database error: {e}")
            raise

    async def fetchval(self, query: str, *args) -> Any:
        """Execute a SELECT query and return single value"""
        if not self._pool:
            await self.init_pool()
        
        try:
            async with self._pool.acquire() as connection:
                value = await connection.fetchval(query, *args)
                logger.debug(f"Fetched value: {value}")
                return value
        except PostgresError as e:
            logger.error(f"Database error: {e}")
            raise

    # Legacy compatibility methods
    async def select(self, sql: str, *args) -> List[asyncpg.Record]:
        """Legacy method - use fetchall instead"""
        return await self.fetchall(sql, *args)

    async def insert(self, sql: str, *args) -> str:
        """Legacy method - use execute instead"""
        return await self.execute(sql, *args)

    async def update(self, sql: str, *args) -> str:
        """Legacy method - use execute instead"""
        return await self.execute(sql, *args)

    async def delete(self, sql: str, *args) -> str:
        """Legacy method - use execute instead"""
        return await self.execute(sql, *args)