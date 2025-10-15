"""
Database Performance Analysis Script.

Runs EXPLAIN ANALYZE on critical queries to identify performance bottlenecks.
"""
import asyncio
import os
import sys
from datetime import date, datetime, timedelta

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from sqlmodel import select, func

from backend.app.core.config import settings
from backend.app.core.database import get_engine
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact as Fact
from backend.app.models.user import User


async def analyze_query(session, query_name: str, sql_query: str):
    """Execute EXPLAIN ANALYZE on a query and print results."""
    print(f"\n{'='*80}")
    print(f"📊 QUERY: {query_name}")
    print(f"{'='*80}")

    # Execute EXPLAIN ANALYZE
    explain_sql = f"EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) {sql_query}"
    result = await session.execute(text(explain_sql))
    explain_result = result.scalar()

    # Extract key metrics
    plan = explain_result[0]["Plan"]
    execution_time = explain_result[0]["Execution Time"]
    planning_time = explain_result[0]["Planning Time"]

    print(f"⏱️  Execution Time: {execution_time:.3f} ms")
    print(f"⏱️  Planning Time: {planning_time:.3f} ms")
    print(f"⏱️  Total Time: {execution_time + planning_time:.3f} ms")
    print(f"\n📋 Query Plan:")
    print_plan_recursive(plan, indent=0)

    return {
        "query": query_name,
        "execution_time": execution_time,
        "planning_time": planning_time,
        "total_time": execution_time + planning_time,
    }


def print_plan_recursive(node, indent=0):
    """Print query plan recursively."""
    prefix = "  " * indent
    node_type = node.get("Node Type", "Unknown")

    # Key info
    actual_time = node.get("Actual Total Time", 0)
    rows = node.get("Actual Rows", 0)

    # Additional info
    relation = node.get("Relation Name", "")
    index_name = node.get("Index Name", "")
    scan_type = node.get("Scan Direction", "")

    # Format output
    info = f"{node_type}"
    if relation:
        info += f" on {relation}"
    if index_name:
        info += f" using {index_name}"
    if scan_type:
        info += f" ({scan_type})"

    print(f"{prefix}├─ {info}")
    print(f"{prefix}│  ⏱️ Time: {actual_time:.3f} ms | Rows: {rows}")

    # Check for performance issues
    if "Seq Scan" in node_type and rows > 100:
        print(f"{prefix}│  ⚠️  Sequential scan on {rows} rows - consider adding index")

    # Recurse into child nodes
    if "Plans" in node:
        for child in node["Plans"]:
            print_plan_recursive(child, indent + 1)


async def main():
    """Run performance analysis on critical queries."""
    print("🚀 Starting Database Performance Analysis")
    print(f"📊 Database: {settings.DATABASE_URL.split('@')[1]}")
    print(f"📅 Date: {datetime.utcnow().isoformat()}")

    engine = get_engine()

    results = []

    async with engine.begin() as session:
        # Get a test user_id
        user_result = await session.execute(select(User).where(User.is_current == True).limit(1))
        test_user = user_result.scalar_one_or_none()

        if not test_user:
            print("❌ No test user found. Please create a user first.")
            return

        user_id = test_user.id
        print(f"\n✅ Using test user: {test_user.username} (id={user_id})")

        # Date range for queries
        today = date.today()
        month_start = date(today.year, today.month, 1)
        year_start = date(today.year, 1, 1)

        # ============================================================
        # QUERY 1: List Facts (most frequent query)
        # ============================================================
        query1 = f"""
        SELECT * FROM t_f_fact
        WHERE user_id = {user_id}
          AND fact_date >= '{month_start}'
          AND fact_date <= '{today}'
        ORDER BY fact_date DESC, id DESC
        LIMIT 100
        """
        results.append(await analyze_query(session, "Q1: List Facts (filtered by date)", query1))

        # ============================================================
        # QUERY 2: Facts Summary (aggregation)
        # ============================================================
        query2 = f"""
        SELECT
          a.type,
          SUM(f.amount) as total,
          COUNT(*) as count
        FROM t_f_fact f
        JOIN t_d_article a ON f.article_id = a.id
        WHERE f.user_id = {user_id}
          AND f.fact_date >= '{month_start}'
          AND f.fact_date <= '{today}'
          AND a.is_current = true
        GROUP BY a.type
        """
        results.append(await analyze_query(session, "Q2: Facts Summary (aggregation with JOIN)", query2))

        # ============================================================
        # QUERY 3: Category Breakdown (pie chart)
        # ============================================================
        query3 = f"""
        SELECT
          a.name,
          SUM(f.amount) as total
        FROM t_f_fact f
        JOIN t_d_article a ON f.article_id = a.id
        WHERE f.user_id = {user_id}
          AND a.type = 'expense'
          AND f.fact_date >= '{month_start}'
          AND f.fact_date <= '{today}'
          AND a.is_current = true
        GROUP BY a.name
        ORDER BY total DESC
        """
        results.append(await analyze_query(session, "Q3: Category Breakdown (pie chart)", query3))

        # ============================================================
        # QUERY 4: Trends (line chart - daily aggregation)
        # ============================================================
        query4 = f"""
        SELECT
          f.fact_date,
          a.type,
          SUM(f.amount) as total
        FROM t_f_fact f
        JOIN t_d_article a ON f.article_id = a.id
        WHERE f.user_id = {user_id}
          AND f.fact_date >= '{today - timedelta(days=30)}'
          AND f.fact_date <= '{today}'
          AND a.is_current = true
        GROUP BY f.fact_date, a.type
        ORDER BY f.fact_date
        """
        results.append(await analyze_query(session, "Q4: Trends (30-day line chart)", query4))

        # ============================================================
        # QUERY 5: Waterfall (yearly aggregation)
        # ============================================================
        query5 = f"""
        SELECT
          EXTRACT(MONTH FROM f.fact_date) as month,
          a.type,
          a.id as article_id,
          a.name as article_name,
          SUM(f.amount) as total
        FROM t_f_fact f
        JOIN t_d_article a ON f.article_id = a.id
        WHERE f.user_id = {user_id}
          AND f.fact_date >= '{year_start}'
          AND f.fact_date <= '{today}'
          AND a.is_current = true
        GROUP BY EXTRACT(MONTH FROM f.fact_date), a.type, a.id, a.name
        ORDER BY month
        """
        results.append(await analyze_query(session, "Q5: Waterfall Chart (yearly aggregation)", query5))

        # ============================================================
        # QUERY 6: Heatmap (daily expenses grouped by date)
        # ============================================================
        query6 = f"""
        SELECT
          f.fact_date,
          SUM(f.amount) as total
        FROM t_f_fact f
        JOIN t_d_article a ON f.article_id = a.id
        WHERE f.user_id = {user_id}
          AND a.type = 'expense'
          AND f.fact_date >= '{today - timedelta(days=90)}'
          AND f.fact_date <= '{today}'
          AND a.is_current = true
        GROUP BY f.fact_date
        """
        results.append(await analyze_query(session, "Q6: Heatmap (90-day expense patterns)", query6))

        # ============================================================
        # QUERY 7: List Articles (hierarchy with closure table)
        # ============================================================
        query7 = f"""
        SELECT * FROM t_d_article
        WHERE (user_id = {user_id} OR is_global = true)
          AND is_current = true
        LIMIT 100
        """
        results.append(await analyze_query(session, "Q7: List Articles (with global)", query7))

        # ============================================================
        # QUERY 8: Article Subtree (closure table usage)
        # ============================================================
        # First, get a root article
        article_result = await session.execute(
            text(f"SELECT id FROM t_d_article WHERE user_id = {user_id} AND is_current = true AND parent_id IS NULL LIMIT 1")
        )
        root_article_row = article_result.fetchone()

        if root_article_row:
            root_article_id = root_article_row[0]
            query8 = f"""
            SELECT a.*
            FROM t_d_article a
            JOIN t_d_article_hierarchy h ON a.id = h.descendant_id
            WHERE h.ancestor_id = {root_article_id}
              AND a.is_current = true
            """
            results.append(await analyze_query(session, f"Q8: Article Subtree (closure table, root={root_article_id})", query8))

    # ============================================================
    # Summary Report
    # ============================================================
    print(f"\n{'='*80}")
    print(f"📊 PERFORMANCE ANALYSIS SUMMARY")
    print(f"{'='*80}")

    # Sort by execution time
    results_sorted = sorted(results, key=lambda x: x["total_time"], reverse=True)

    print(f"\n⏱️  Queries by Total Time (slowest first):")
    print(f"{'─'*80}")
    for i, r in enumerate(results_sorted, 1):
        exec_ms = r['execution_time']
        plan_ms = r['planning_time']
        total_ms = r['total_time']

        # Color code based on performance
        if total_ms < 10:
            emoji = "✅"  # Fast
        elif total_ms < 50:
            emoji = "⚠️"  # Moderate
        else:
            emoji = "🔴"  # Slow

        print(f"{i}. {emoji} {r['query']}")
        print(f"   Total: {total_ms:.3f} ms (Execution: {exec_ms:.3f} ms + Planning: {plan_ms:.3f} ms)")
        print()

    # Recommendations
    print(f"\n{'='*80}")
    print(f"💡 RECOMMENDATIONS")
    print(f"{'='*80}")

    slow_queries = [r for r in results if r["total_time"] > 50]
    if slow_queries:
        print(f"\n🔴 Found {len(slow_queries)} slow queries (>50ms):")
        for q in slow_queries:
            print(f"   - {q['query']}: {q['total_time']:.3f} ms")
        print(f"\n   Recommendations:")
        print(f"   1. Check if indexes are being used (look for 'Index Scan' vs 'Seq Scan')")
        print(f"   2. Consider adding covering indexes for frequently accessed columns")
        print(f"   3. Review query structure for optimization opportunities")
    else:
        print(f"\n✅ All queries are fast (<50ms). Excellent performance!")

    moderate_queries = [r for r in results if 10 < r["total_time"] <= 50]
    if moderate_queries:
        print(f"\n⚠️  Found {len(moderate_queries)} moderate queries (10-50ms):")
        for q in moderate_queries:
            print(f"   - {q['query']}: {q['total_time']:.3f} ms")
        print(f"\n   These are acceptable but could be optimized further if needed.")

    fast_queries = [r for r in results if r["total_time"] <= 10]
    if fast_queries:
        print(f"\n✅ {len(fast_queries)} queries are very fast (<10ms)")

    print(f"\n{'='*80}")
    print(f"✅ Performance analysis complete!")
    print(f"{'='*80}")


if __name__ == "__main__":
    asyncio.run(main())
