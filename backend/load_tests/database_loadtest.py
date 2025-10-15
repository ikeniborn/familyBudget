"""
Database Load Testing Script
TASK-018: Database Load Testing

This script tests database performance under concurrent load
without going through the API layer.

Usage:
    python database_loadtest.py --connections 50 --duration 300 --queries-per-second 100
"""

import argparse
import asyncio
import asyncpg
import time
import random
import statistics
from datetime import datetime, date
from typing import List, Dict
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database connection parameters
DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "database": os.getenv("POSTGRES_DB", "familybudget"),
    "user": os.getenv("POSTGRES_USER", "familybudget"),
    "password": os.getenv("POSTGRES_PASSWORD", ""),
}


class DatabaseLoadTester:
    """Database load testing class"""

    def __init__(self, pool_size: int = 20):
        self.pool_size = pool_size
        self.pool = None
        self.query_times: List[float] = []
        self.error_count = 0
        self.success_count = 0

    async def create_pool(self):
        """Create connection pool"""
        self.pool = await asyncpg.create_pool(
            **DB_CONFIG,
            min_size=self.pool_size // 2,
            max_size=self.pool_size,
            command_timeout=10,
        )
        print(f"✓ Created connection pool (size: {self.pool_size})")

    async def close_pool(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            print("✓ Closed connection pool")

    async def run_read_query(self, query_type: str = "random"):
        """Execute a read query"""
        start_time = time.time()

        try:
            async with self.pool.acquire() as conn:
                if query_type == "fact_list":
                    # Simulate fact list query
                    user_id = random.randint(1, 10)
                    result = await conn.fetch(
                        """
                        SELECT f.id, f.fact_date, f.amount, a.name as article_name
                        FROM t_f_budget_fact f
                        JOIN t_d_article a ON f.article_id = a.id
                        WHERE f.user_id = $1
                          AND f.fact_date >= '2025-01-01'
                          AND f.fact_date <= CURRENT_DATE
                          AND a.is_current = TRUE
                        ORDER BY f.fact_date DESC
                        LIMIT 50
                        """,
                        user_id
                    )

                elif query_type == "analytics":
                    # Simulate analytics query
                    user_id = random.randint(1, 10)
                    result = await conn.fetch(
                        """
                        SELECT
                            EXTRACT(month FROM f.fact_date) as month,
                            a.type,
                            SUM(f.amount) as total
                        FROM t_f_budget_fact f
                        JOIN t_d_article a ON f.article_id = a.id
                        WHERE f.user_id = $1
                          AND f.fact_date >= '2025-01-01'
                          AND a.is_current = TRUE
                        GROUP BY month, a.type
                        ORDER BY month
                        """,
                        user_id
                    )

                elif query_type == "hierarchy":
                    # Simulate hierarchy query
                    article_id = random.randint(1, 28)
                    result = await conn.fetch(
                        """
                        SELECT a.id, a.name, h.depth
                        FROM t_d_article a
                        JOIN t_d_article_hierarchy h ON a.id = h.descendant_id
                        WHERE h.ancestor_id = $1 AND a.is_current = TRUE
                        ORDER BY h.depth, a.name
                        """,
                        article_id
                    )

                else:  # random
                    # Pick a random query type
                    query_types = ["fact_list", "analytics", "hierarchy"]
                    return await self.run_read_query(random.choice(query_types))

            elapsed = (time.time() - start_time) * 1000  # Convert to ms
            self.query_times.append(elapsed)
            self.success_count += 1

        except Exception as e:
            self.error_count += 1
            print(f"✗ Query error: {e}")

    async def run_write_query(self):
        """Execute a write query (INSERT)"""
        start_time = time.time()

        try:
            async with self.pool.acquire() as conn:
                user_id = random.randint(1, 10)
                article_id = random.randint(1, 28)
                amount = random.uniform(-5000, 50000)
                fact_date = date(2025, 10, 14)

                result = await conn.execute(
                    """
                    INSERT INTO t_f_budget_fact
                        (user_id, article_id, fact_date, amount, record_type, description)
                    VALUES ($1, $2, $3, $4, 'fact', 'Load test transaction')
                    """,
                    user_id, article_id, fact_date, amount
                )

            elapsed = (time.time() - start_time) * 1000
            self.query_times.append(elapsed)
            self.success_count += 1

        except Exception as e:
            self.error_count += 1
            print(f"✗ Write error: {e}")

    async def run_concurrent_queries(
        self,
        num_queries: int,
        read_ratio: float = 0.8,
        query_types: List[str] = None
    ):
        """
        Run queries concurrently.

        Args:
            num_queries: Number of queries to execute
            read_ratio: Ratio of read queries (0.0 - 1.0)
            query_types: List of query types to execute
        """
        if query_types is None:
            query_types = ["fact_list", "analytics", "hierarchy"]

        tasks = []
        for _ in range(num_queries):
            if random.random() < read_ratio:
                # Read query
                query_type = random.choice(query_types)
                tasks.append(self.run_read_query(query_type))
            else:
                # Write query
                tasks.append(self.run_write_query())

        await asyncio.gather(*tasks)

    async def run_sustained_load(
        self,
        duration_seconds: int,
        queries_per_second: int,
        read_ratio: float = 0.8
    ):
        """
        Run sustained load for specified duration.

        Args:
            duration_seconds: How long to run the test
            queries_per_second: Target query rate
            read_ratio: Ratio of read queries
        """
        print(f"\n{'=' * 80}")
        print(f"SUSTAINED LOAD TEST")
        print(f"Duration: {duration_seconds}s")
        print(f"Target QPS: {queries_per_second}")
        print(f"Read/Write Ratio: {read_ratio:.0%}/{(1-read_ratio):.0%}")
        print(f"{'=' * 80}\n")

        start_time = time.time()
        interval = 1.0 / queries_per_second

        query_count = 0
        while (time.time() - start_time) < duration_seconds:
            # Run one query
            if random.random() < read_ratio:
                await self.run_read_query("random")
            else:
                await self.run_write_query()

            query_count += 1

            # Sleep to maintain target QPS
            await asyncio.sleep(interval)

            # Print progress every 100 queries
            if query_count % 100 == 0:
                elapsed = time.time() - start_time
                current_qps = query_count / elapsed
                print(f"Progress: {query_count} queries in {elapsed:.1f}s (QPS: {current_qps:.1f})")

        print(f"\n✓ Completed {query_count} queries in {duration_seconds}s")

    def print_statistics(self):
        """Print test statistics"""
        if not self.query_times:
            print("No query times recorded")
            return

        print(f"\n{'=' * 80}")
        print("TEST STATISTICS")
        print(f"{'=' * 80}")
        print(f"Total Queries:    {self.success_count + self.error_count}")
        print(f"Successful:       {self.success_count}")
        print(f"Failed:           {self.error_count}")
        print(f"Success Rate:     {(self.success_count / (self.success_count + self.error_count) * 100):.2f}%")
        print(f"\nQuery Times (ms):")
        print(f"  Min:            {min(self.query_times):.2f}")
        print(f"  Max:            {max(self.query_times):.2f}")
        print(f"  Mean:           {statistics.mean(self.query_times):.2f}")
        print(f"  Median:         {statistics.median(self.query_times):.2f}")

        if len(self.query_times) >= 10:
            sorted_times = sorted(self.query_times)
            p95_index = int(len(sorted_times) * 0.95)
            p99_index = int(len(sorted_times) * 0.99)
            print(f"  P95:            {sorted_times[p95_index]:.2f}")
            print(f"  P99:            {sorted_times[p99_index]:.2f}")

        print(f"{'=' * 80}\n")


async def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(description="Database Load Testing")
    parser.add_argument("--connections", type=int, default=20, help="Connection pool size")
    parser.add_argument("--duration", type=int, default=60, help="Test duration in seconds")
    parser.add_argument("--qps", type=int, default=50, help="Queries per second")
    parser.add_argument("--read-ratio", type=float, default=0.8, help="Read query ratio (0.0-1.0)")
    parser.add_argument("--test-type", choices=["burst", "sustained"], default="sustained",
                        help="Test type: burst or sustained")

    args = parser.parse_args()

    # Create load tester
    tester = DatabaseLoadTester(pool_size=args.connections)

    try:
        # Create connection pool
        await tester.create_pool()

        if args.test_type == "burst":
            # Burst test - run many queries concurrently
            print(f"\nRunning BURST test: {args.qps * args.duration} concurrent queries...")
            await tester.run_concurrent_queries(
                num_queries=args.qps * args.duration,
                read_ratio=args.read_ratio
            )

        else:
            # Sustained test - maintain constant QPS
            await tester.run_sustained_load(
                duration_seconds=args.duration,
                queries_per_second=args.qps,
                read_ratio=args.read_ratio
            )

        # Print statistics
        tester.print_statistics()

    finally:
        # Close connection pool
        await tester.close_pool()


if __name__ == "__main__":
    asyncio.run(main())
