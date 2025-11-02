#!/usr/bin/env python3
"""
CSV to SQL Transformation Script
Converts budget data from CSV to PostgreSQL INSERT statements

Input: t_f_registry_t_d_financial_center_t_d_cost_center_t_d_nomenclatu_*.csv
Output: Multiple SQL files with INSERT statements for dimension and fact tables

Author: Claude Code
Date: 2025-11-02
"""

import csv
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Set, Tuple
from collections import defaultdict


# Configuration
CSV_FILE = "t_f_registry_t_d_financial_center_t_d_cost_center_t_d_nomenclatu_202511012113.csv"
DATA_DIR = Path(__file__).parent.parent / "data"  # Input from data/ directory
OUTPUT_DIR = Path(__file__).parent.parent / "queries"  # Output to queries/ directory
USER_ID = 1  # Audit trail user_id for all dimension records

# Income article keywords (rest are expenses)
INCOME_KEYWORDS = {'зарплата', 'аванс', 'отпускные'}


def escape_sql(value: str) -> str:
    """Escape single quotes for SQL"""
    if value is None:
        return 'NULL'
    return value.replace("'", "''")


def determine_article_type(name: str) -> str:
    """Determine if article is income or expense based on keywords"""
    name_lower = name.lower()
    for keyword in INCOME_KEYWORDS:
        if keyword in name_lower:
            return 'income'
    return 'expense'


def is_valid_date(date_str: str) -> bool:
    """Check if date string is valid"""
    try:
        datetime.strptime(date_str, '%Y-%m-%d')
        return True
    except (ValueError, TypeError):
        return False


def parse_csv(csv_path: Path) -> Tuple[List[Dict], Dict]:
    """
    Parse CSV file and extract clean data

    Returns:
        - List of valid transaction records
        - Statistics dictionary
    """
    records = []
    stats = {
        'total_rows': 0,
        'valid_rows': 0,
        'invalid_rows': 0,
        'skipped_rows': [],
        'zero_amount_skipped': 0,
        'empty_names_skipped': 0
    }

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for idx, row in enumerate(reader, start=2):  # Start from 2 (header is row 1)
            stats['total_rows'] += 1

            # Validate required fields
            period_dt = row.get('period_dt', '').strip()
            operation_dttm = row.get('operation_dttm', '').strip()

            # Skip rows with invalid period_dt
            if not is_valid_date(period_dt):
                stats['invalid_rows'] += 1
                stats['skipped_rows'].append(f"Row {idx}: Invalid period_dt '{period_dt}'")
                continue

            # Clean and validate
            try:
                # Extract date from operation_dttm (format: "2023-03-09 13:25:49.000")
                operation_date = operation_dttm.split()[0] if operation_dttm else period_dt

                if not is_valid_date(operation_date):
                    operation_date = period_dt

                # Parse amount
                amount_str = row['cost_sum'].replace(',', '.')
                amount = float(amount_str)

                # Skip records with zero amount (violates CHECK constraint)
                if amount == 0.0:
                    stats['zero_amount_skipped'] += 1
                    stats['skipped_rows'].append(f"Row {idx}: Zero amount (technical record)")
                    continue

                # Get names
                financial_center = row['financial_center_name'].strip()
                cost_center = row['cost_center_name'].strip()
                nomenclature = row['nomenclature_name'].strip()
                account = row['account_name'].strip()

                # Skip records with empty critical names
                if not nomenclature or not financial_center or not cost_center:
                    stats['empty_names_skipped'] += 1
                    stats['skipped_rows'].append(f"Row {idx}: Empty critical field(s)")
                    continue

                record = {
                    'operation_date': operation_date,
                    'period_dt': period_dt,
                    'financial_center': financial_center,
                    'cost_center': cost_center,
                    'nomenclature': nomenclature,
                    'account': account,
                    'row_type': row['row_type_name'].strip(),  # Факт или Бюджет
                    'amount': amount,
                    'comment': row.get('comment_description', '').strip()
                }

                records.append(record)
                stats['valid_rows'] += 1

            except (ValueError, KeyError) as e:
                stats['invalid_rows'] += 1
                stats['skipped_rows'].append(f"Row {idx}: {str(e)}")

    return records, stats


def extract_dimensions(records: List[Dict]) -> Dict:
    """Extract unique dimension values from records"""
    dims = {
        'financial_centers': set(),
        'cost_centers': set(),
        'parent_articles': {},  # account_name -> type
        'child_articles': {},   # (nomenclature, parent) -> type
    }

    for record in records:
        dims['financial_centers'].add(record['financial_center'])
        dims['cost_centers'].add(record['cost_center'])

        # Determine article type
        nomenclature = record['nomenclature']
        account = record['account']

        article_type = determine_article_type(nomenclature)

        # Store parent (account) article
        if account and account not in dims['parent_articles']:
            dims['parent_articles'][account] = article_type

        # Store child (nomenclature) article with parent reference
        child_key = (nomenclature, account)
        if child_key not in dims['child_articles']:
            dims['child_articles'][child_key] = article_type

    return dims


def generate_financial_center_sql(financial_centers: Set[str], output_path: Path):
    """Generate SQL INSERT for t_d_financial_center"""
    sql_lines = [
        "-- ============================================================================",
        "-- INSERT: t_d_financial_center",
        "-- Description: Financial centers (ЦФО) dimension",
        "-- Generated: " + datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "-- ============================================================================\n",
        "-- Insert financial centers (shared across all users)",
    ]

    for idx, name in enumerate(sorted(financial_centers), start=1):
        code = f"FC_{name.upper()}"
        sql = f"INSERT INTO t_d_financial_center (user_id, code, name, is_current) VALUES ({USER_ID}, '{escape_sql(code)}', '{escape_sql(name)}', true);"
        sql_lines.append(sql)

    sql_lines.append(f"\n-- Total: {len(financial_centers)} financial centers")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))

    print(f"✓ Generated: {output_path.name} ({len(financial_centers)} records)")


def generate_cost_center_sql(cost_centers: Set[str], output_path: Path):
    """Generate SQL INSERT for t_d_cost_center"""
    sql_lines = [
        "-- ============================================================================",
        "-- INSERT: t_d_cost_center",
        "-- Description: Cost centers (МВЗ) dimension",
        "-- Generated: " + datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "-- ============================================================================\n",
        "-- Insert cost centers (shared across all users)",
    ]

    for idx, name in enumerate(sorted(cost_centers), start=1):
        code = f"CC_{name.upper()}"
        sql = f"INSERT INTO t_d_cost_center (user_id, code, name, is_current) VALUES ({USER_ID}, '{escape_sql(code)}', '{escape_sql(name)}', true);"
        sql_lines.append(sql)

    sql_lines.append(f"\n-- Total: {len(cost_centers)} cost centers")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))

    print(f"✓ Generated: {output_path.name} ({len(cost_centers)} records)")


def generate_article_parents_sql(parent_articles: Dict[str, str], output_path: Path):
    """Generate SQL INSERT for parent articles (account_name)"""
    sql_lines = [
        "-- ============================================================================",
        "-- INSERT: t_d_article (Parent articles)",
        "-- Description: Parent category articles from account_name",
        "-- Generated: " + datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "-- ============================================================================\n",
        "-- Insert parent articles (root level categories)",
    ]

    for idx, (name, article_type) in enumerate(sorted(parent_articles.items()), start=1):
        code = f"ART_PARENT_{idx:03d}"
        sql = f"INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_current) VALUES ({USER_ID}, '{escape_sql(code)}', '{escape_sql(name)}', '{article_type}', NULL, true);"
        sql_lines.append(sql)

    sql_lines.append(f"\n-- Total: {len(parent_articles)} parent articles")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))

    print(f"✓ Generated: {output_path.name} ({len(parent_articles)} records)")


def generate_article_children_sql(child_articles: Dict[Tuple[str, str], str], parent_articles: Dict[str, str], output_path: Path):
    """Generate SQL INSERT for child articles (nomenclature_name)"""
    sql_lines = [
        "-- ============================================================================",
        "-- INSERT: t_d_article (Child articles)",
        "-- Description: Child category articles from nomenclature_name",
        "-- Generated: " + datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "-- ============================================================================\n",
        "-- Insert child articles (referencing parent via parent_id)",
        "-- NOTE: parent_id references are resolved via code lookup",
    ]

    # Create parent_name -> code mapping
    parent_code_map = {}
    for idx, name in enumerate(sorted(parent_articles.keys()), start=1):
        parent_code_map[name] = f"ART_PARENT_{idx:03d}"

    for idx, ((child_name, parent_name), article_type) in enumerate(sorted(child_articles.items()), start=1):
        code = f"ART_CHILD_{idx:04d}"
        parent_code = parent_code_map.get(parent_name, 'NULL')

        if parent_code != 'NULL':
            # Use subquery to get parent_id by code
            parent_ref = f"(SELECT id FROM t_d_article WHERE code = '{parent_code}' AND is_current = true LIMIT 1)"
        else:
            parent_ref = 'NULL'

        sql = f"INSERT INTO t_d_article (user_id, code, name, type, parent_id, is_current) VALUES ({USER_ID}, '{escape_sql(code)}', '{escape_sql(child_name)}', '{article_type}', {parent_ref}, true);"
        sql_lines.append(sql)

    sql_lines.append(f"\n-- Total: {len(child_articles)} child articles")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))

    print(f"✓ Generated: {output_path.name} ({len(child_articles)} records)")


# NOTE: generate_article_hierarchy_sql() function REMOVED
# Hierarchy is maintained automatically by triggers (007_create_article_hierarchy_triggers.sql)
# No need to generate 05_insert_t_d_article_hierarchy.sql
# See CLAUDE.md - Closure Table section for details


def get_date_range(records: List[Dict]) -> Tuple[datetime, datetime]:
    """Extract min and max dates from records"""
    dates = []
    for record in records:
        try:
            date_obj = datetime.strptime(record['operation_date'], '%Y-%m-%d')
            dates.append(date_obj)
        except (ValueError, KeyError):
            pass

    if not dates:
        # Default range if no valid dates
        return datetime(2023, 1, 1), datetime(2025, 12, 31)

    return min(dates), max(dates)


def add_months(date: datetime, months: int) -> datetime:
    """Add months to a date (handles month overflow correctly)"""
    month = date.month - 1 + months
    year = date.year + month // 12
    month = month % 12 + 1
    day = min(date.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month-1])
    return date.replace(year=year, month=month, day=day)


def generate_partitions_sql(records: List[Dict], output_path: Path):
    """Generate SQL for creating monthly partitions for t_f_budget_fact"""
    min_date, max_date = get_date_range(records)

    # Round to start of month
    start_month = min_date.replace(day=1)
    # Always generate partitions up to 2030-12-31 for future data
    end_month = datetime(2031, 1, 1)  # Partitions up to 2030-12-31

    sql_lines = [
        "-- ============================================================================",
        "-- CREATE PARTITIONS: t_f_budget_fact",
        "-- Description: Monthly partitions for budget fact table",
        "-- Generated: " + datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "-- ============================================================================\n",
        f"-- Data range in CSV: {start_month.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')}",
        f"-- Partition range: {start_month.strftime('%Y-%m-%d')} to 2030-12-31 (fixed)",
        "-- Creating monthly partitions using RANGE partitioning\n",
    ]

    # Generate partition for each month
    current_month = start_month
    partition_count = 0

    while current_month < end_month:
        next_month = add_months(current_month, 1)

        partition_name = f"t_f_budget_fact_{current_month.strftime('%Y_%m')}"
        from_date = current_month.strftime('%Y-%m-%d')
        to_date = next_month.strftime('%Y-%m-%d')

        sql = (
            f"CREATE TABLE IF NOT EXISTS {partition_name} "
            f"PARTITION OF t_f_budget_fact "
            f"FOR VALUES FROM ('{from_date}') TO ('{to_date}');"
        )
        sql_lines.append(sql)

        current_month = next_month
        partition_count += 1

    sql_lines.append(f"\n-- Total: {partition_count} monthly partitions created")
    sql_lines.append("\n-- Verify partitions:")
    sql_lines.append("-- SELECT tablename FROM pg_tables WHERE tablename LIKE 't_f_budget_fact_%' ORDER BY tablename;")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))

    print(f"✓ Generated: {output_path.name} ({partition_count} partitions)")


def generate_budget_fact_sql(records: List[Dict], output_path: Path):
    """Generate SQL INSERT for t_f_budget_fact with COMMIT every 1000 records"""
    BATCH_SIZE = 1000

    sql_lines = [
        "-- ============================================================================",
        "-- INSERT: t_f_budget_fact",
        "-- Description: Budget transactions (plan and fact records)",
        "-- Generated: " + datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "-- ============================================================================\n",
        "-- IMPORTANT: Run 05_create_partitions_t_f_budget_fact.sql BEFORE this file!",
        "-- Partitions must exist before inserting data.\n",
        "-- Insert budget facts in batches (COMMIT every 1000 records)",
        "-- record_type: 'fact' for actual transactions, 'plan' for budget\n",
    ]

    # Start first transaction
    sql_lines.append("BEGIN;")
    sql_lines.append("")

    batch_count = 0

    for idx, record in enumerate(records, start=1):
        # Map row_type to record_type
        if record['row_type'] == 'Факт':
            record_type = 'fact'
        elif record['row_type'] == 'Бюджет':
            record_type = 'plan'
        else:
            record_type = 'fact'  # default

        # Build SQL
        sql = (
            "INSERT INTO t_f_budget_fact "
            "(user_id, article_id, financial_center_id, cost_center_id, fact_date, amount, record_type, description) "
            "VALUES ("
            f"{USER_ID}, "
            f"(SELECT id FROM t_d_article WHERE name = '{escape_sql(record['nomenclature'])}' AND is_current = true LIMIT 1), "
            f"(SELECT id FROM t_d_financial_center WHERE name = '{escape_sql(record['financial_center'])}' AND is_current = true LIMIT 1), "
            f"(SELECT id FROM t_d_cost_center WHERE name = '{escape_sql(record['cost_center'])}' AND is_current = true LIMIT 1), "
            f"'{record['operation_date']}', "
            f"{record['amount']:.2f}, "
            f"'{record_type}', "
            f"'{escape_sql(record['comment'])}'"
            ");"
        )
        sql_lines.append(sql)

        # COMMIT every 1000 records
        if idx % BATCH_SIZE == 0:
            batch_count += 1
            sql_lines.append("")
            sql_lines.append(f"COMMIT;  -- Batch {batch_count}: {idx-BATCH_SIZE+1}-{idx} records")
            sql_lines.append(f"-- Progress: {idx} / {len(records)} records ({(idx/len(records)*100):.1f}%)")

            # Start new transaction if not at the end
            if idx < len(records):
                sql_lines.append("")
                sql_lines.append("BEGIN;")
                sql_lines.append("")

    # COMMIT remaining records if any
    remaining = len(records) % BATCH_SIZE
    if remaining > 0:
        batch_count += 1
        sql_lines.append("")
        sql_lines.append(f"COMMIT;  -- Batch {batch_count}: {len(records)-remaining+1}-{len(records)} records (final)")

    sql_lines.append(f"\n-- Total: {len(records)} budget fact records in {batch_count} batches")
    sql_lines.append(f"-- Batch size: {BATCH_SIZE} records per transaction")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))

    print(f"✓ Generated: {output_path.name} ({len(records)} records in {batch_count} batches)")


def main():
    """Main execution flow"""
    print("=" * 80)
    print("CSV to SQL Transformation Script")
    print("=" * 80)

    # Paths
    csv_path = DATA_DIR / CSV_FILE

    if not csv_path.exists():
        print(f"✗ ERROR: CSV file not found: {csv_path}")
        print(f"Expected location: {DATA_DIR}")
        return

    print(f"\n1. Reading CSV: {CSV_FILE}")
    records, stats = parse_csv(csv_path)

    print(f"   Total rows: {stats['total_rows']}")
    print(f"   Valid rows: {stats['valid_rows']}")
    print(f"   Skipped - Zero amount: {stats['zero_amount_skipped']}")
    print(f"   Skipped - Empty names: {stats['empty_names_skipped']}")
    print(f"   Skipped - Other errors: {stats['invalid_rows']}")

    if stats['skipped_rows']:
        print("\n   Skipped rows details:")
        for msg in stats['skipped_rows'][:10]:  # Show first 10
            print(f"   - {msg}")
        if len(stats['skipped_rows']) > 10:
            print(f"   ... and {len(stats['skipped_rows']) - 10} more")

    print(f"\n2. Extracting dimensions...")
    dims = extract_dimensions(records)

    print(f"   Financial centers: {len(dims['financial_centers'])}")
    print(f"   Cost centers: {len(dims['cost_centers'])}")
    print(f"   Parent articles: {len(dims['parent_articles'])}")
    print(f"   Child articles: {len(dims['child_articles'])}")

    print(f"\n3. Generating SQL files...")

    # Generate dimension SQLs
    generate_financial_center_sql(
        dims['financial_centers'],
        OUTPUT_DIR / "01_insert_t_d_financial_center.sql"
    )

    generate_cost_center_sql(
        dims['cost_centers'],
        OUTPUT_DIR / "02_insert_t_d_cost_center.sql"
    )

    generate_article_parents_sql(
        dims['parent_articles'],
        OUTPUT_DIR / "03_insert_t_d_article_parents.sql"
    )

    generate_article_children_sql(
        dims['child_articles'],
        dims['parent_articles'],
        OUTPUT_DIR / "04_insert_t_d_article_children.sql"
    )

    # NOTE: 05_insert_t_d_article_hierarchy.sql is NO LONGER GENERATED
    # Hierarchy is maintained automatically by triggers (007_create_article_hierarchy_triggers.sql)
    # See CLAUDE.md - Closure Table section for details

    # Generate partitions SQL (BEFORE fact inserts!)
    # Renumbered from 06 to 05 after removing hierarchy file
    generate_partitions_sql(
        records,
        OUTPUT_DIR / "05_create_partitions_t_f_budget_fact.sql"
    )

    # Generate fact SQL
    # Renumbered from 07 to 06 after removing hierarchy file
    generate_budget_fact_sql(
        records,
        OUTPUT_DIR / "06_insert_t_f_budget_fact.sql"
    )

    print("\n" + "=" * 80)
    print("✓ Transformation completed successfully!")
    print("=" * 80)
    print(f"\nGenerated files in: {OUTPUT_DIR}")
    print("  01_insert_t_d_financial_center.sql")
    print("  02_insert_t_d_cost_center.sql")
    print("  03_insert_t_d_article_parents.sql")
    print("  04_insert_t_d_article_children.sql")
    print("  05_create_partitions_t_f_budget_fact.sql  ⚠️ Run BEFORE 06!")
    print("  06_insert_t_f_budget_fact.sql")
    print("\n⚠️  IMPORTANT:")
    print("  - Execute in order! Partitions (05) must be created before inserting facts (06).")
    print("  - t_d_article_hierarchy is populated AUTOMATICALLY by database triggers (NO file needed)")


if __name__ == "__main__":
    main()
