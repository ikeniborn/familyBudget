"""
Services package.

This package contains business logic services organized by domain:
- JWT token management
- Telegram OAuth validation
- User authentication and management
- SCD Type 2 (Slowly Changing Dimension) operations
- Hierarchy queries (Closure Table pattern)
- Tinkoff CSV import parsing
- Import execution (staging to BudgetFact)
"""

from backend.app.services.hierarchy_service import (
    archive_recursive,
    get_ancestors,
    get_depth,
    get_direct_children,
    get_level,
    get_path,
    get_root,
    get_subtree,
    is_descendant_of,
    restore_recursive,
)
from backend.app.services.import_executor import ImportExecutor
from backend.app.services.jwt import create_access_token, decode_access_token
from backend.app.services.scd2_service import (
    create_new_version,
    get_current_version,
    get_history,
    get_version_at_date,
    has_changes,
    validate_scd2_instance,
    verify_no_concurrent_update,
)
from backend.app.services.telegram_auth import validate_telegram_auth
from backend.app.services.tinkoff_csv_parser import TinkoffCSVParser

__all__ = [
    "create_access_token",
    "decode_access_token",
    "validate_telegram_auth",
    # SCD Type 2 service
    "create_new_version",
    "get_current_version",
    "get_version_at_date",
    "get_history",
    "has_changes",
    "validate_scd2_instance",
    "verify_no_concurrent_update",
    # Hierarchy service
    "get_subtree",
    "get_ancestors",
    "get_path",
    "get_depth",
    "get_direct_children",
    "get_root",
    "is_descendant_of",
    "get_level",
    "archive_recursive",
    "restore_recursive",
    # Import service
    "TinkoffCSVParser",
    "ImportExecutor",
]
