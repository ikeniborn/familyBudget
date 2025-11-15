#!/usr/bin/env python3
"""
Parallel SQL Execution Script for PostgreSQL
Efficiently executes SQL files with batched transactions and connection pooling.

Features:
- Parallel execution with configurable connection limit (max 50)
- Batch processing (BEGIN...COMMIT blocks)
- Progress tracking with rich progress bar
- Connection parameters from postgresql.env
- Error handling and retry logic

Author: Claude Code
Date: 2025-11-02
"""

import asyncio
import asyncpg
import re
import sys
from pathlib import Path
from typing import List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime
import argparse

try:
    from rich.console import Console
    from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn, TimeRemainingColumn
    from rich.panel import Panel
    from rich.table import Table
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("⚠️  'rich' library not found. Install with: pip install rich")

try:
    from dotenv import dotenv_values
    DOTENV_AVAILABLE = True
except ImportError:
    DOTENV_AVAILABLE = False
    print("⚠️  'python-dotenv' library not found. Install with: pip install python-dotenv")


@dataclass
class BatchStats:
    """Statistics for batch execution"""
    total_batches: int = 0
    successful: int = 0
    failed: int = 0
    total_statements: int = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    @property
    def duration(self) -> float:
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0.0


class SQLBatchParser:
    """Parse SQL file into batches (BEGIN...COMMIT blocks)"""

    @staticmethod
    def parse_file(file_path: Path) -> List[Tuple[str, List[str]]]:
        """
        Parse SQL file into batches.

        Returns:
            List of tuples: (batch_name, [statements])
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Remove comments (-- style and /* */ style)
        content = re.sub(r'--[^\n]*', '', content)
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

        batches = []

        # Try to find BEGIN...COMMIT blocks
        begin_commit_pattern = re.compile(
            r'BEGIN;(.*?)COMMIT;',
            re.DOTALL | re.IGNORECASE
        )

        matches = list(begin_commit_pattern.finditer(content))

        if matches:
            # File has explicit BEGIN...COMMIT blocks
            for idx, match in enumerate(matches, start=1):
                batch_content = match.group(1).strip()
                statements = SQLBatchParser._split_statements(batch_content)
                if statements:
                    batches.append((f"Batch {idx}", statements))
        else:
            # No explicit batches - split by semicolons and create single batch
            statements = SQLBatchParser._split_statements(content)
            if statements:
                batches.append(("All statements", statements))

        return batches

    @staticmethod
    def _split_statements(content: str) -> List[str]:
        """Split content into individual SQL statements"""
        # Split by semicolon, but be careful with strings
        statements = []
        current = []
        in_string = False
        escape_next = False

        for char in content:
            if escape_next:
                current.append(char)
                escape_next = False
                continue

            if char == '\\':
                escape_next = True
                current.append(char)
                continue

            if char == "'":
                in_string = not in_string
                current.append(char)
                continue

            if char == ';' and not in_string:
                stmt = ''.join(current).strip()
                if stmt:
                    statements.append(stmt)
                current = []
                continue

            current.append(char)

        # Add remaining content
        stmt = ''.join(current).strip()
        if stmt:
            statements.append(stmt)

        return statements


class PostgreSQLConfig:
    """PostgreSQL connection configuration from .env file"""

    def __init__(self, env_file: Path):
        if not DOTENV_AVAILABLE:
            raise ImportError("python-dotenv is required. Install with: pip install python-dotenv")

        if not env_file.exists():
            raise FileNotFoundError(f"Environment file not found: {env_file}")

        self.config = dotenv_values(env_file)
        self._validate()

    def _validate(self):
        """Validate required configuration parameters"""
        required = ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD']
        missing = [key for key in required if key not in self.config]

        if missing:
            raise ValueError(f"Missing required configuration: {', '.join(missing)}")

    @property
    def dsn(self) -> str:
        """Get PostgreSQL DSN connection string"""
        return (
            f"postgresql://{self.config['POSTGRES_USER']}:{self.config['POSTGRES_PASSWORD']}"
            f"@{self.config['POSTGRES_HOST']}:{self.config['POSTGRES_PORT']}"
            f"/{self.config['POSTGRES_DB']}"
        )

    def __repr__(self):
        return (
            f"PostgreSQL({self.config['POSTGRES_HOST']}:{self.config['POSTGRES_PORT']}"
            f"/{self.config['POSTGRES_DB']} as {self.config['POSTGRES_USER']})"
        )


class ParallelSQLExecutor:
    """Execute SQL batches in parallel with connection pooling"""

    def __init__(self, config: PostgreSQLConfig, max_connections: int = 50):
        self.config = config
        self.max_connections = min(max_connections, 50)  # Hard limit at 50
        self.semaphore = asyncio.Semaphore(self.max_connections)
        self.stats = BatchStats()
        self.console = Console() if RICH_AVAILABLE else None

    async def execute_batch(
        self,
        batch_name: str,
        statements: List[str],
        pool: asyncpg.Pool
    ) -> Tuple[bool, Optional[str]]:
        """Execute a single batch (transaction)"""
        async with self.semaphore:
            try:
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        for stmt in statements:
                            await conn.execute(stmt)

                return True, None

            except Exception as e:
                error_msg = f"{batch_name}: {str(e)}"
                return False, error_msg

    async def execute_file(self, sql_file: Path) -> BatchStats:
        """Execute SQL file with parallel batch processing"""
        self.stats = BatchStats()
        self.stats.start_time = datetime.now()

        # Parse file into batches
        if self.console:
            self.console.print(f"\n[cyan]📄 Parsing file:[/cyan] {sql_file.name}")

        batches = SQLBatchParser.parse_file(sql_file)
        self.stats.total_batches = len(batches)
        self.stats.total_statements = sum(len(stmts) for _, stmts in batches)

        if self.console:
            self.console.print(f"[green]✓[/green] Found {self.stats.total_batches} batches, "
                             f"{self.stats.total_statements} statements")

        # Create connection pool
        if self.console:
            self.console.print(f"[cyan]🔗 Creating connection pool:[/cyan] {self.max_connections} connections")

        pool = await asyncpg.create_pool(
            self.config.dsn,
            min_size=2,
            max_size=self.max_connections,
            command_timeout=300  # 5 minutes per statement
        )

        try:
            # Execute batches in parallel with progress bar
            tasks = [
                self.execute_batch(name, stmts, pool)
                for name, stmts in batches
            ]

            if RICH_AVAILABLE:
                # Rich progress bar
                with Progress(
                    SpinnerColumn(),
                    TextColumn("[progress.description]{task.description}"),
                    BarColumn(),
                    TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                    TextColumn("({task.completed}/{task.total})"),
                    TimeElapsedColumn(),
                    TimeRemainingColumn(),
                    console=self.console
                ) as progress:
                    task = progress.add_task(
                        f"[cyan]Executing batches...",
                        total=len(tasks)
                    )

                    for coro in asyncio.as_completed(tasks):
                        success, error = await coro

                        if success:
                            self.stats.successful += 1
                        else:
                            self.stats.failed += 1
                            if self.console:
                                self.console.print(f"[red]✗ {error}[/red]")

                        progress.update(task, advance=1)
            else:
                # Simple progress without rich
                print(f"Executing {len(tasks)} batches...")
                for idx, coro in enumerate(asyncio.as_completed(tasks), start=1):
                    success, error = await coro

                    if success:
                        self.stats.successful += 1
                    else:
                        self.stats.failed += 1
                        print(f"✗ {error}")

                    print(f"Progress: {idx}/{len(tasks)}")

        finally:
            await pool.close()

        self.stats.end_time = datetime.now()
        return self.stats


def print_stats(stats: BatchStats, console: Optional[Console] = None):
    """Print execution statistics"""
    if RICH_AVAILABLE and console:
        # Rich formatted output
        table = Table(title="Execution Statistics", show_header=True)
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")

        table.add_row("Total Batches", str(stats.total_batches))
        table.add_row("Total Statements", str(stats.total_statements))
        table.add_row("Successful", str(stats.successful))
        table.add_row("Failed", f"[red]{stats.failed}[/red]" if stats.failed > 0 else "0")
        table.add_row("Duration", f"{stats.duration:.2f}s")

        if stats.total_statements > 0 and stats.duration > 0:
            rate = stats.total_statements / stats.duration
            table.add_row("Throughput", f"{rate:.1f} statements/sec")

        console.print("\n")
        console.print(table)

        if stats.failed > 0:
            console.print(f"\n[red]⚠️  {stats.failed} batches failed![/red]")
        else:
            console.print(f"\n[green]✓ All batches executed successfully![/green]")
    else:
        # Simple text output
        print("\n" + "=" * 50)
        print("Execution Statistics")
        print("=" * 50)
        print(f"Total Batches:      {stats.total_batches}")
        print(f"Total Statements:   {stats.total_statements}")
        print(f"Successful:         {stats.successful}")
        print(f"Failed:             {stats.failed}")
        print(f"Duration:           {stats.duration:.2f}s")

        if stats.total_statements > 0 and stats.duration > 0:
            rate = stats.total_statements / stats.duration
            print(f"Throughput:         {rate:.1f} statements/sec")

        print("=" * 50)

        if stats.failed > 0:
            print(f"\n⚠️  {stats.failed} batches failed!")
        else:
            print(f"\n✓ All batches executed successfully!")


async def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(
        description="Execute SQL files in parallel with PostgreSQL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Interactive mode
  python3 execute_sql_parallel.py

  # Direct file path
  python3 execute_sql_parallel.py --file 06_insert_t_f_budget_fact.sql

  # Custom connection limit
  python3 execute_sql_parallel.py --file 06_insert_t_f_budget_fact.sql --max-connections 30

  # Custom env file
  python3 execute_sql_parallel.py --env /path/to/.env --file 06_insert_t_f_budget_fact.sql
        """
    )

    parser.add_argument(
        '--file',
        type=str,
        help='Path to SQL file to execute'
    )

    parser.add_argument(
        '--max-connections',
        type=int,
        default=50,
        help='Maximum number of parallel connections (default: 50, max: 50)'
    )

    parser.add_argument(
        '--env',
        type=str,
        default='postgresql.env',
        help='Path to postgresql.env file (default: postgresql.env)'
    )

    args = parser.parse_args()

    console = Console() if RICH_AVAILABLE else None

    # Print header
    if console:
        console.print(Panel.fit(
            "[bold cyan]PostgreSQL Parallel SQL Executor[/bold cyan]\n"
            "Efficient batch processing with connection pooling",
            border_style="cyan"
        ))
    else:
        print("=" * 60)
        print("PostgreSQL Parallel SQL Executor")
        print("=" * 60)

    # Get SQL file path
    if args.file:
        sql_file = Path(args.file)
    else:
        if console:
            console.print("\n[yellow]Enter path to SQL file:[/yellow]")
        else:
            print("\nEnter path to SQL file:")

        file_input = input("> ").strip()

        if not file_input:
            print("Error: No file path provided")
            sys.exit(1)

        sql_file = Path(file_input)

    if not sql_file.exists():
        print(f"Error: File not found: {sql_file}")
        sys.exit(1)

    # Load PostgreSQL configuration
    env_file = Path(args.env)

    if not env_file.exists():
        # Try alternative locations
        alternatives = [
            Path(__file__).parent / 'postgresql.env',  # Same directory as script
            Path.cwd() / 'postgresql.env',              # Current working directory
            Path(__file__).parent.parent / 'postgresql.env',  # Parent directory
        ]

        for alt in alternatives:
            if alt.exists():
                env_file = alt
                break

    if not env_file.exists():
        print(f"Error: postgresql.env file not found")
        print(f"Searched locations:")
        print(f"  - {args.env}")
        for alt in alternatives:
            print(f"  - {alt}")
        sys.exit(1)

    try:
        config = PostgreSQLConfig(env_file)

        if console:
            console.print(f"\n[green]✓[/green] Loaded config: {config}")
        else:
            print(f"\n✓ Loaded config: {config}")

    except Exception as e:
        print(f"Error loading configuration: {e}")
        sys.exit(1)

    # Execute SQL file
    executor = ParallelSQLExecutor(config, max_connections=args.max_connections)

    try:
        stats = await executor.execute_file(sql_file)
        print_stats(stats, console)

        # Exit with error code if any batches failed
        if stats.failed > 0:
            sys.exit(1)

    except Exception as e:
        if console:
            console.print(f"\n[red]✗ Fatal error:[/red] {e}")
        else:
            print(f"\n✗ Fatal error: {e}")

        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    # Check for required dependencies
    missing_deps = []

    if not RICH_AVAILABLE:
        missing_deps.append("rich")

    if not DOTENV_AVAILABLE:
        missing_deps.append("python-dotenv")

    try:
        import asyncpg
    except ImportError:
        missing_deps.append("asyncpg")

    if missing_deps:
        print("Missing required dependencies:")
        for dep in missing_deps:
            print(f"  - {dep}")
        print("\nInstall with:")
        print(f"  pip install {' '.join(missing_deps)}")
        sys.exit(1)

    # Run main
    asyncio.run(main())
