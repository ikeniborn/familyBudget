import asyncpg
from asyncpg import PostgresError, Pool
from typing import List, Any, Optional, Dict
import logging

logger = logging.getLogger(__name__)


class PostgresOptimized:
    """Optimized PostgreSQL client with connection pooling and parameterized queries."""
    
    _instance = None
    _pool: Optional[Pool] = None
    
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(
        self,
        host: str = "localhost",
        port: int = 5432,
        database: str = "postgres",
        user: str = "postgres",
        password: str = "postgres",
        min_connections: int = 10,
        max_connections: int = 20,
    ) -> None:
        if not hasattr(self, '_initialized'):
            self._host = host
            self._port = port
            self._database = database
            self._user = user
            self._password = password
            self._min_connections = min_connections
            self._max_connections = max_connections
            self._initialized = True
    
    async def init_pool(self):
        """Initialize connection pool."""
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                host=self._host,
                port=self._port,
                user=self._user,
                password=self._password,
                database=self._database,
                min_size=self._min_connections,
                max_size=self._max_connections,
                command_timeout=60
            )
            logger.info(f"Connection pool created with {self._min_connections}-{self._max_connections} connections")
    
    async def close_pool(self):
        """Close connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Connection pool closed")
    
    async def execute(self, query: str, *args, timeout: float = None) -> str:
        """Execute a query with parameters (INSERT, UPDATE, DELETE)."""
        if not self._pool:
            await self.init_pool()
        
        async with self._pool.acquire() as connection:
            try:
                result = await connection.execute(query, *args, timeout=timeout)
                logger.debug(f"Executed query: {query[:100]}... with {len(args)} parameters")
                return result
            except PostgresError as e:
                logger.error(f"Query execution error: {e}")
                raise
    
    async def fetch(self, query: str, *args, timeout: float = None) -> List[asyncpg.Record]:
        """Fetch multiple rows with parameters."""
        if not self._pool:
            await self.init_pool()
        
        async with self._pool.acquire() as connection:
            try:
                rows = await connection.fetch(query, *args, timeout=timeout)
                logger.debug(f"Fetched {len(rows)} rows")
                return rows
            except PostgresError as e:
                logger.error(f"Query fetch error: {e}")
                raise
    
    async def fetchrow(self, query: str, *args, timeout: float = None) -> Optional[asyncpg.Record]:
        """Fetch single row with parameters."""
        if not self._pool:
            await self.init_pool()
        
        async with self._pool.acquire() as connection:
            try:
                row = await connection.fetchrow(query, *args, timeout=timeout)
                return row
            except PostgresError as e:
                logger.error(f"Query fetchrow error: {e}")
                raise
    
    async def fetchval(self, query: str, *args, column: int = 0, timeout: float = None) -> Any:
        """Fetch single value with parameters."""
        if not self._pool:
            await self.init_pool()
        
        async with self._pool.acquire() as connection:
            try:
                value = await connection.fetchval(query, *args, column=column, timeout=timeout)
                return value
            except PostgresError as e:
                logger.error(f"Query fetchval error: {e}")
                raise
    
    async def execute_many(self, query: str, args_list: List[tuple], timeout: float = None):
        """Execute multiple queries with different parameters."""
        if not self._pool:
            await self.init_pool()
        
        async with self._pool.acquire() as connection:
            try:
                await connection.executemany(query, args_list, timeout=timeout)
                logger.debug(f"Executed {len(args_list)} queries")
            except PostgresError as e:
                logger.error(f"Batch execution error: {e}")
                raise
    
    async def transaction(self, queries: List[tuple]):
        """Execute multiple queries in a transaction."""
        if not self._pool:
            await self.init_pool()
        
        async with self._pool.acquire() as connection:
            async with connection.transaction():
                try:
                    for query, args in queries:
                        await connection.execute(query, *args)
                    logger.debug(f"Transaction completed with {len(queries)} queries")
                except PostgresError as e:
                    logger.error(f"Transaction error: {e}")
                    raise
    
    # Backward compatibility methods
    async def insert(self, sql: str = None, *args):
        """Legacy insert method - use execute instead."""
        logger.warning("Using deprecated insert method. Use execute() instead.")
        return await self.execute(sql, *args)
    
    async def update(self, sql: str = None, *args):
        """Legacy update method - use execute instead."""
        logger.warning("Using deprecated update method. Use execute() instead.")
        return await self.execute(sql, *args)
    
    async def delete(self, sql: str = None, *args):
        """Legacy delete method - use execute instead."""
        logger.warning("Using deprecated delete method. Use execute() instead.")
        return await self.execute(sql, *args)
    
    async def select(self, sql: str = None, *args):
        """Legacy select method - use fetch instead."""
        logger.warning("Using deprecated select method. Use fetch() instead.")
        return await self.fetch(sql, *args)