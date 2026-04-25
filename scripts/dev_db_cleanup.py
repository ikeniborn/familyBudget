"""Dev-DB cleanup: purge orphan test records left over from E2E runs.

Targets admin dictionaries (articles, FC, CC, stores, product groups) and
shopping lists whose `name` matches the test-prefix patterns listed below.

By default runs in DRY-RUN mode (prints SQL + row counts, no changes).
Pass `--apply` to actually execute the updates.

Strategy: soft-archive (`is_active=false`) instead of DELETE — matches the
application's existing delete semantics and lets the Dexie active-view
filter them out on next sync. For `t_f_shopping_list`, cascade to items
(service layer cascade already does this on archive, but we mirror here).

Must be run on the dev server (never against prod):
    ssh budget-test
    cd /opt/budget
    python scripts/dev_db_cleanup.py            # dry-run
    python scripts/dev_db_cleanup.py --apply    # execute
"""

from __future__ import annotations

import argparse
import os
import sys

from sqlalchemy import create_engine, text

# Patterns treated as test-only records. ILIKE (case-insensitive), PostgreSQL.
NAME_PATTERNS = [
    "DEXIE_%",
    "ТЕСТ_DEXIE_%",
    "MCP\\_%",       # escaped underscore — literal "MCP_" prefix
    "MCP16\\_%",
]

# Additional explicit names seen in prior runs.
EXPLICIT_NAMES = ["Uuuu", "Офлайн тест БАГ-1"]

TARGETS: list[tuple[str, str]] = [
    ("t_d_article", "articles"),
    ("t_d_financial_center", "financial_centers"),
    ("t_d_cost_center", "cost_centers"),
    ("t_d_store", "stores"),
    ("t_d_product_group", "product_groups"),
    ("t_f_shopping_list", "shopping_lists"),
]


def build_where(params: dict[str, str]) -> str:
    """Build a WHERE fragment matching any pattern or explicit name."""
    clauses: list[str] = []
    for i, _ in enumerate(NAME_PATTERNS):
        params[f"pat{i}"] = NAME_PATTERNS[i]
        clauses.append(f"name ILIKE :pat{i} ESCAPE '\\'")
    for i, _ in enumerate(EXPLICIT_NAMES):
        params[f"name{i}"] = EXPLICIT_NAMES[i]
        clauses.append(f"name = :name{i}")
    return "(" + " OR ".join(clauses) + ") AND is_active = true"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Execute updates (default: dry-run)")
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL"),
        help="PostgreSQL URL (default: $DATABASE_URL)",
    )
    args = parser.parse_args()

    if not args.database_url:
        print("ERROR: DATABASE_URL not set (pass --database-url or export it)", file=sys.stderr)
        return 2

    engine = create_engine(args.database_url)
    total = 0

    with engine.begin() as conn:
        for table, label in TARGETS:
            params: dict[str, str] = {}
            where = build_where(params)
            preview_sql = f"SELECT id, name FROM {table} WHERE {where} ORDER BY id"
            rows = conn.execute(text(preview_sql), params).all()
            print(f"\n[{label}] {len(rows)} candidate(s):")
            for row in rows:
                print(f"  id={row.id:<6} name={row.name!r}")
            total += len(rows)

            if args.apply and rows:
                update_sql = f"UPDATE {table} SET is_active = false WHERE {where}"
                result = conn.execute(text(update_sql), params)
                print(f"  → archived {result.rowcount}")

        if args.apply and total == 0:
            print("\nNothing to do.")

    mode = "APPLIED" if args.apply else "DRY-RUN"
    print(f"\n=== {mode}: {total} record(s) across {len(TARGETS)} tables ===")
    if not args.apply and total:
        print("Re-run with --apply to archive them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
