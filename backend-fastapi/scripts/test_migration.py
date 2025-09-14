#!/usr/bin/env python3
"""
Test script for Phase 1 database migration validation.

This script validates the database schema changes and data consolidation
for converting from user-isolated to admin-managed shared reference data.
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from app.db.database import engine
from app.models.financial_center import FinancialCenter
from app.models.cost_center import CostCenter
from app.models.nomenclature import Nomenclature
from app.models.period import Period


def check_schema_changes():
    """Verify that schema changes have been applied correctly."""
    print("🔍 Checking schema changes...")

    inspector = inspect(engine)

    # Check Financial Centers
    fc_columns = {col['name']: col for col in inspector.get_columns('t_d_financial_center')}
    print(f"✅ Financial Center columns: {list(fc_columns.keys())}")

    required_fc_columns = ['financial_center_code', 'created_by', 'managed_by', 'description']
    for col in required_fc_columns:
        if col in fc_columns:
            print(f"  ✅ {col}: {fc_columns[col]['type']} (nullable: {fc_columns[col]['nullable']})")
        else:
            print(f"  ❌ Missing column: {col}")

    # Check Cost Centers
    cc_columns = {col['name']: col for col in inspector.get_columns('t_d_cost_center')}
    print(f"✅ Cost Center columns: {list(cc_columns.keys())}")

    required_cc_columns = ['cost_center_code', 'created_by', 'managed_by', 'description']
    for col in required_cc_columns:
        if col in cc_columns:
            print(f"  ✅ {col}: {cc_columns[col]['type']} (nullable: {cc_columns[col]['nullable']})")
        else:
            print(f"  ❌ Missing column: {col}")

    # Check Nomenclatures
    nom_columns = {col['name']: col for col in inspector.get_columns('t_d_nomenclature')}
    print(f"✅ Nomenclature columns: {list(nom_columns.keys())}")

    required_nom_columns = ['nomenclature_code', 'created_by', 'managed_by', 'description']
    for col in required_nom_columns:
        if col in nom_columns:
            print(f"  ✅ {col}: {nom_columns[col]['type']} (nullable: {nom_columns[col]['nullable']})")
        else:
            print(f"  ❌ Missing column: {col}")

    # Check unique constraints
    fc_constraints = inspector.get_unique_constraints('t_d_financial_center')
    cc_constraints = inspector.get_unique_constraints('t_d_cost_center')
    nom_constraints = inspector.get_unique_constraints('t_d_nomenclature')

    print(f"✅ Financial Center constraints: {[c['name'] for c in fc_constraints]}")
    print(f"✅ Cost Center constraints: {[c['name'] for c in cc_constraints]}")
    print(f"✅ Nomenclature constraints: {[c['name'] for c in nom_constraints]}")


def check_data_integrity():
    """Check data integrity after consolidation."""
    print("\n🔍 Checking data integrity...")

    with engine.connect() as conn:
        # Check for any NULL codes (should not exist after migration)
        fc_null_codes = conn.execute(text("""
            SELECT COUNT(*) as count FROM t_d_financial_center
            WHERE financial_center_code IS NULL
        """)).fetchone()
        print(f"✅ Financial Centers with NULL codes: {fc_null_codes[0]}")

        cc_null_codes = conn.execute(text("""
            SELECT COUNT(*) as count FROM t_d_cost_center
            WHERE cost_center_code IS NULL
        """)).fetchone()
        print(f"✅ Cost Centers with NULL codes: {cc_null_codes[0]}")

        nom_null_codes = conn.execute(text("""
            SELECT COUNT(*) as count FROM t_d_nomenclature
            WHERE nomenclature_code IS NULL
        """)).fetchone()
        print(f"✅ Nomenclatures with NULL codes: {nom_null_codes[0]}")

        # Check shared vs user-specific records
        fc_shared = conn.execute(text("""
            SELECT
                COUNT(CASE WHEN user_id IS NULL THEN 1 END) as shared_count,
                COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as user_specific_count
            FROM t_d_financial_center
        """)).fetchone()
        print(f"✅ Financial Centers - Shared: {fc_shared[0]}, User-specific: {fc_shared[1]}")

        cc_shared = conn.execute(text("""
            SELECT
                COUNT(CASE WHEN user_id IS NULL THEN 1 END) as shared_count,
                COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as user_specific_count
            FROM t_d_cost_center
        """)).fetchone()
        print(f"✅ Cost Centers - Shared: {cc_shared[0]}, User-specific: {cc_shared[1]}")

        nom_shared = conn.execute(text("""
            SELECT
                COUNT(CASE WHEN user_id IS NULL THEN 1 END) as shared_count,
                COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as user_specific_count
            FROM t_d_nomenclature
        """)).fetchone()
        print(f"✅ Nomenclatures - Shared: {nom_shared[0]}, User-specific: {nom_shared[1]}")

        # Check registry references are still valid
        registry_check = conn.execute(text("""
            SELECT
                COUNT(*) as total_registry_records,
                COUNT(fc.financial_center_id) as valid_fc_refs,
                COUNT(cc.cost_center_id) as valid_cc_refs,
                COUNT(n.nomenclature_id) as valid_nom_refs
            FROM t_f_registry r
            LEFT JOIN t_d_financial_center fc ON r.financial_center_id = fc.financial_center_id
            LEFT JOIN t_d_cost_center cc ON r.cost_center_id = cc.cost_center_id
            LEFT JOIN t_d_nomenclature n ON r.nomenclature_id = n.nomenclature_id
        """)).fetchone()

        print(f"✅ Registry integrity:")
        print(f"  Total registry records: {registry_check[0]}")
        print(f"  Valid financial center refs: {registry_check[1]}")
        print(f"  Valid cost center refs: {registry_check[2]}")
        print(f"  Valid nomenclature refs: {registry_check[3]}")

        if registry_check[0] == registry_check[1] == registry_check[2] == registry_check[3]:
            print("  ✅ All registry references are valid!")
        else:
            print("  ❌ Some registry references are broken!")


def check_model_compatibility():
    """Test that SQLAlchemy models work with the new schema."""
    print("\n🔍 Checking SQLAlchemy model compatibility...")

    try:
        from sqlalchemy.orm import sessionmaker
        Session = sessionmaker(bind=engine)
        session = Session()

        # Test basic queries
        fc_count = session.query(FinancialCenter).count()
        cc_count = session.query(CostCenter).count()
        nom_count = session.query(Nomenclature).count()

        print(f"✅ Model queries work:")
        print(f"  Financial Centers: {fc_count}")
        print(f"  Cost Centers: {cc_count}")
        print(f"  Nomenclatures: {nom_count}")

        # Test creating a sample record
        test_fc = FinancialCenter(
            code="TST001",
            name="Test Financial Center",
            description="Test record for migration validation",
            is_active=True
        )

        # Don't actually save, just validate the model structure
        print("✅ Model instantiation works")

        session.close()

    except Exception as e:
        print(f"❌ Model compatibility error: {e}")


def main():
    """Run all validation checks."""
    print("🚀 Starting Phase 1 Migration Validation")
    print("="*50)

    try:
        check_schema_changes()
        check_data_integrity()
        check_model_compatibility()

        print("\n🎉 Migration validation completed!")
        print("="*50)

    except Exception as e:
        print(f"\n❌ Validation failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()