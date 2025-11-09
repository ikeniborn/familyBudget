#!/usr/bin/env python3
"""
Update code patterns in SQL queries from old format to new unified sequential format.

Old patterns:
- FC_{name} → CFO-{idx}
- CC_{name} → MVZ-{idx}
- ART_PARENT_{num} → ART-{idx}
- ART_CHILD_{num} → ART-{idx} (continuing sequence)

Usage:
    python3 update_code_patterns.py
"""

import re
from pathlib import Path


def update_financial_center_codes(content: str) -> str:
    """Replace FC_{name} with CFO-{idx} in sequential order."""
    pattern = r"code, name, is_current\) VALUES \(1, '(FC_[^']+)', '([^']+)', true\)"

    idx = 1
    def replacer(match):
        nonlocal idx
        old_code, name = match.groups()
        new_code = f"CFO-{idx}"
        idx += 1
        return f"code, name, is_current) VALUES (1, '{new_code}', '{name}', true)"

    return re.sub(pattern, replacer, content)


def update_cost_center_codes(content: str) -> str:
    """Replace CC_{name} with MVZ-{idx} in sequential order."""
    pattern = r"code, name, is_current\) VALUES \(1, '(CC_[^']+)', '([^']+)', true\)"

    idx = 1
    def replacer(match):
        nonlocal idx
        old_code, name = match.groups()
        new_code = f"MVZ-{idx}"
        idx += 1
        return f"code, name, is_current) VALUES (1, '{new_code}', '{name}', true)"

    return re.sub(pattern, replacer, content)


def update_article_parent_codes(content: str) -> str:
    """Replace ART_PARENT_{num} with ART-{idx} in sequential order."""
    pattern = r"code, name, type, parent_id, is_current\) VALUES \(1, '(ART_PARENT_\d+)', '([^']+)', '([^']+)', NULL, true\)"

    idx = 1
    def replacer(match):
        nonlocal idx
        old_code, name, article_type = match.groups()
        new_code = f"ART-{idx}"
        idx += 1
        return f"code, name, type, parent_id, is_current) VALUES (1, '{new_code}', '{name}', '{article_type}', NULL, true)"

    return re.sub(pattern, replacer, content)


def update_article_child_codes(content: str, start_idx: int) -> str:
    """Replace ART_CHILD_{num} with ART-{idx} continuing sequence from parents."""
    # Pattern for child articles (with parent_id reference)
    # Note: LIMIT 1 is optional in the pattern
    pattern = r"VALUES \(1, '(ART_CHILD_\d+)', '([^']+)', '([^']+)', \(SELECT id FROM t_d_article WHERE code = '([^']+)' AND is_current = true(?:\s+LIMIT\s+1)?\), true\)"

    idx = start_idx
    def replacer(match):
        nonlocal idx
        old_code, name, article_type, parent_code = match.groups()

        # parent_code is already converted (ART-11, ART-15, etc.)
        new_code = f"ART-{idx}"
        idx += 1
        return f"VALUES (1, '{new_code}', '{name}', '{article_type}', (SELECT id FROM t_d_article WHERE code = '{parent_code}' AND is_current = true LIMIT 1), true)"

    return re.sub(pattern, replacer, content)


def main():
    """Update code patterns in all SQL query files."""
    base_dir = Path(__file__).parent.parent
    backup_dir = base_dir / "queries_backup"
    output_dir = base_dir / "queries"

    print("=" * 80)
    print("SQL Code Pattern Update")
    print("=" * 80)
    print(f"Source: {backup_dir}")
    print(f"Target: {output_dir}")
    print()

    # Create output directory if not exists
    output_dir.mkdir(exist_ok=True)

    # 1. Update FinancialCenter codes
    fc_file = backup_dir / "01_insert_t_d_financial_center.sql"
    if fc_file.exists():
        content = fc_file.read_text(encoding='utf-8')
        updated = update_financial_center_codes(content)
        (output_dir / fc_file.name).write_text(updated, encoding='utf-8')
        print(f"✓ Updated: {fc_file.name}")
        # Count replacements
        old_count = len(re.findall(r"'FC_", content))
        new_count = len(re.findall(r"'CFO-", updated))
        print(f"  Replaced {old_count} FC_* codes with CFO-{new_count} pattern")

    # 2. Update CostCenter codes
    cc_file = backup_dir / "02_insert_t_d_cost_center.sql"
    if cc_file.exists():
        content = cc_file.read_text(encoding='utf-8')
        updated = update_cost_center_codes(content)
        (output_dir / cc_file.name).write_text(updated, encoding='utf-8')
        print(f"✓ Updated: {cc_file.name}")
        old_count = len(re.findall(r"'CC_", content))
        new_count = len(re.findall(r"'MVZ-", updated))
        print(f"  Replaced {old_count} CC_* codes with MVZ-{new_count} pattern")

    # 3. Update Article parent codes
    parent_file = backup_dir / "03_insert_t_d_article_parents.sql"
    if parent_file.exists():
        content = parent_file.read_text(encoding='utf-8')
        updated = update_article_parent_codes(content)
        (output_dir / parent_file.name).write_text(updated, encoding='utf-8')
        print(f"✓ Updated: {parent_file.name}")
        old_count = len(re.findall(r"'ART_PARENT_", content))
        new_count = len(re.findall(r"'ART-", updated))
        print(f"  Replaced {old_count} ART_PARENT_* codes with ART-{new_count} pattern")

        # Remember max parent idx for children
        max_parent_idx = new_count

    # 4. Update Article child codes (continuing sequence)
    child_file = backup_dir / "04_insert_t_d_article_children.sql"
    if child_file.exists():
        content = child_file.read_text(encoding='utf-8')

        # First replace parent code references in SELECT subqueries
        # Convert ART_PARENT_001 → ART-1 in WHERE clauses
        for old_num in range(1, 100):  # Assume max 99 parents
            old_pattern = f"ART_PARENT_{old_num:03d}"
            new_pattern = f"ART-{old_num}"
            content = content.replace(f"code = '{old_pattern}'", f"code = '{new_pattern}'")

        # Then update child codes
        start_idx = max_parent_idx + 1
        updated = update_article_child_codes(content, start_idx)
        (output_dir / child_file.name).write_text(updated, encoding='utf-8')
        print(f"✓ Updated: {child_file.name}")
        old_count = len(re.findall(r"'ART_CHILD_", content))
        new_count = len(re.findall(r"'ART-\d+',", updated)) - max_parent_idx  # Subtract parent refs
        print(f"  Replaced {old_count} ART_CHILD_* codes with ART-{start_idx}...{start_idx + new_count - 1} pattern")

    # 5. Copy remaining files unchanged
    for file in backup_dir.glob("*.sql"):
        if file.name not in [
            "01_insert_t_d_financial_center.sql",
            "02_insert_t_d_cost_center.sql",
            "03_insert_t_d_article_parents.sql",
            "04_insert_t_d_article_children.sql"
        ]:
            content = file.read_text(encoding='utf-8')
            (output_dir / file.name).write_text(content, encoding='utf-8')
            print(f"✓ Copied unchanged: {file.name}")

    print()
    print("=" * 80)
    print("✓ Code pattern update completed successfully")
    print("=" * 80)


if __name__ == "__main__":
    main()
