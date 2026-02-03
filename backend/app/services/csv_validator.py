"""
CSV Validation Module

Validates CSV data before import:
- Required fields presence
- Field format validation
- Reference validation (stores, product groups exist)
- Duplicate detection
"""

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.product_group import ProductGroup
from backend.app.models.product_group_hierarchy import ProductGroupHierarchy
from backend.app.models.product_group_history import ProductGroupHistory
from backend.app.models.store import Store
from backend.app.models.store_history import StoreHistory
from backend.app.utils.code_generator import generate_code


class ValidationError:
    """Single validation error."""

    def __init__(
        self,
        row_index: int,
        field: str,
        value: Any,
        error_type: str,
        message: str,
        severity: str = "error",
    ):
        self.row_index = row_index
        self.field = field
        self.value = value
        self.error_type = error_type  # "required", "format", "reference", "duplicate"
        self.message = message
        self.severity = severity  # "error", "warning"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "row_index": self.row_index,
            "field": self.field,
            "value": self.value,
            "error_type": self.error_type,
            "message": self.message,
            "severity": self.severity,
        }


class ValidationResult:
    """Result of CSV validation."""

    def __init__(self):
        self.is_valid: bool = True
        self.errors: list[ValidationError] = []
        self.warnings: list[ValidationError] = []
        self.valid_rows: int = 0
        self.invalid_rows: int = 0
        self.total_rows: int = 0

    def add_error(self, error: ValidationError):
        """Add validation error."""
        if error.severity == "error":
            self.errors.append(error)
            self.is_valid = False
        else:
            self.warnings.append(error)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "is_valid": self.is_valid,
            "errors": [e.to_dict() for e in self.errors],
            "warnings": [w.to_dict() for w in self.warnings],
            "valid_rows": self.valid_rows,
            "invalid_rows": self.invalid_rows,
            "total_rows": self.total_rows,
        }


def validate_required_field(
    row_index: int, field_name: str, value: Any
) -> ValidationError | None:
    """
    Validate that required field is present and not empty.

    Args:
        row_index: Row index (0-based)
        field_name: Field name
        value: Field value

    Returns:
        ValidationError if invalid, None otherwise
    """
    if value is None or (isinstance(value, str) and not value.strip()):
        return ValidationError(
            row_index=row_index,
            field=field_name,
            value=value,
            error_type="required",
            message=f"Field '{field_name}' is required",
            severity="error",
        )
    return None


def validate_quantity(
    row_index: int, value: str | None
) -> ValidationError | None:
    """
    Validate quantity field (must be positive decimal).

    Args:
        row_index: Row index
        value: Quantity value (string)

    Returns:
        ValidationError if invalid, None otherwise
    """
    if value is None or not value.strip():
        return None  # Quantity is optional

    try:
        quantity = Decimal(value.replace(",", "."))
        if quantity <= 0:
            return ValidationError(
                row_index=row_index,
                field="quantity",
                value=value,
                error_type="format",
                message="Quantity must be positive",
                severity="error",
            )
    except (InvalidOperation, ValueError):
        return ValidationError(
            row_index=row_index,
            field="quantity",
            value=value,
            error_type="format",
            message=f"Invalid quantity format: '{value}'",
            severity="error",
        )

    return None


async def validate_store_reference(
    session: AsyncSession,
    row_index: int,
    store_name: str,
    stores_cache: dict[str, int],
) -> ValidationError | None:
    """
    Validate that store exists in database.

    Args:
        session: Database session
        row_index: Row index
        store_name: Store name to validate
        stores_cache: Cache of store_name → store_id

    Returns:
        ValidationError if store not found, None otherwise
    """
    # Check cache first
    if store_name in stores_cache:
        return None

    # Query database
    result = await session.execute(
        select(Store).where(Store.name == store_name, Store.is_active == True)
    )
    store = result.scalar_one_or_none()

    if store:
        # Add to cache
        stores_cache[store_name] = store.id
        return None

    return ValidationError(
        row_index=row_index,
        field="store",
        value=store_name,
        error_type="reference",
        message=f"Store '{store_name}' not found in database",
        severity="error",
    )


async def validate_product_group_reference(
    session: AsyncSession,
    row_index: int,
    product_group_name: str,
    product_groups_cache: dict[str, int],
) -> ValidationError | None:
    """
    Validate that product group exists in database.

    Args:
        session: Database session
        row_index: Row index
        product_group_name: Product group name to validate
        product_groups_cache: Cache of group_name → group_id

    Returns:
        ValidationError if product group not found, None otherwise
    """
    # Check cache first
    if product_group_name in product_groups_cache:
        return None

    # Query database
    result = await session.execute(
        select(ProductGroup).where(
            ProductGroup.name == product_group_name, ProductGroup.is_active == True
        )
    )
    product_group = result.scalar_one_or_none()

    if product_group:
        # Add to cache
        product_groups_cache[product_group_name] = product_group.id
        return None

    return ValidationError(
        row_index=row_index,
        field="product_group",
        value=product_group_name,
        error_type="reference",
        message=f"Product group '{product_group_name}' not found in database",
        severity="error",
    )


async def get_or_create_store(
    session: AsyncSession,
    store_name: str,
    creator_id: int,
    stores_cache: dict[str, int],
) -> int:
    """
    Get existing store ID or create new store.

    Args:
        session: Database session
        store_name: Store name to find or create
        creator_id: User ID who is creating the store (if needed)
        stores_cache: Cache of store_name → store_id

    Returns:
        Store ID (existing or newly created)

    Notes:
        - Checks cache first for performance
        - Creates new store if not found (any user can create)
        - Auto-flushes to get new store ID
    """
    # Check cache first
    if store_name in stores_cache:
        return stores_cache[store_name]

    # Try to find existing store
    result = await session.execute(
        select(Store).where(Store.name == store_name, Store.is_active == True)
    )
    store = result.scalar_one_or_none()

    if store:
        # Add to cache and return
        stores_cache[store_name] = store.id
        return store.id

    # Create new store with auto-generated code
    generated_code = await generate_code(session, Store)

    new_store = Store(
        creator_id=creator_id,
        name=store_name,
        code=generated_code,
        is_active=True,
    )
    session.add(new_store)
    await session.flush()  # Flush to get ID before commit

    # Create initial history record INLINE (no commit - will be committed with import)
    # Using FAR_FUTURE constant for SCD Type 2 valid_to field
    FAR_FUTURE = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
    store_history = StoreHistory(
        store_id=new_store.id,
        creator_id=new_store.creator_id,
        name=new_store.name,
        address=new_store.address,
        description=new_store.description,
        code=new_store.code,
        is_active=new_store.is_active,
        valid_from=datetime.utcnow(),
        valid_to=FAR_FUTURE,
        is_current=True,
        change_type="CREATE",
        changed_fields=None,
        changed_by_user_id=None,
    )
    session.add(store_history)

    # Add to cache
    stores_cache[store_name] = new_store.id
    return new_store.id


async def get_or_create_product_group(
    session: AsyncSession,
    product_group_name: str,
    creator_id: int,
    product_groups_cache: dict[str, int],
) -> int:
    """
    Get existing product group ID or create new product group.

    Args:
        session: Database session
        product_group_name: Product group name to find or create
        creator_id: User ID who is creating the product group (if needed)
        product_groups_cache: Cache of group_name → group_id

    Returns:
        Product group ID (existing or newly created)

    Notes:
        - Checks cache first for performance
        - Creates new product group if not found (any user can create)
        - Created as root group (parent_id=NULL) for simplicity
        - Auto-flushes to get new group ID
    """
    # Check cache first
    if product_group_name in product_groups_cache:
        return product_groups_cache[product_group_name]

    # Try to find existing product group
    result = await session.execute(
        select(ProductGroup).where(
            ProductGroup.name == product_group_name, ProductGroup.is_active == True
        )
    )
    product_group = result.scalar_one_or_none()

    if product_group:
        # Add to cache and return
        product_groups_cache[product_group_name] = product_group.id
        return product_group.id

    # Create new product group as root (parent_id=NULL) with auto-generated code
    generated_code = await generate_code(session, ProductGroup)

    new_product_group = ProductGroup(
        creator_id=creator_id,
        name=product_group_name,
        parent_id=None,  # Create as root group
        code=generated_code,
        is_active=True,
    )
    session.add(new_product_group)
    await session.flush()  # Flush to get ID before commit

    # Create initial history record INLINE (no commit - will be committed with import)
    FAR_FUTURE = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
    pg_history = ProductGroupHistory(
        product_group_id=new_product_group.id,
        creator_id=new_product_group.creator_id,
        parent_id=new_product_group.parent_id,
        name=new_product_group.name,
        description=new_product_group.description,
        code=new_product_group.code,
        is_active=new_product_group.is_active,
        valid_from=datetime.utcnow(),
        valid_to=FAR_FUTURE,
        is_current=True,
        change_type="CREATE",
        changed_fields=None,
        changed_by_user_id=None,
    )
    session.add(pg_history)

    # Create hierarchy self-reference INLINE (no commit)
    # Root groups only need self-reference (depth=0)
    hierarchy_self_ref = ProductGroupHierarchy(
        ancestor_id=new_product_group.id,
        descendant_id=new_product_group.id,
        depth=0,
    )
    session.add(hierarchy_self_ref)

    # Add to cache
    product_groups_cache[product_group_name] = new_product_group.id
    return new_product_group.id


def aggregate_duplicate_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Aggregate duplicate rows: sum quantity, merge comments.

    Key: (store, product_group, product_name) - case-insensitive
    - quantity: summed
    - comment: merged via comma
    - unit: first non-empty value

    Args:
        rows: List of row dictionaries with mapped field names

    Returns:
        List of aggregated rows (fewer rows if duplicates existed)
    """
    aggregated: dict[tuple[str, str, str], dict[str, Any]] = {}

    for row in rows:
        store = row.get("store", "").strip()
        product_group = row.get("product_group", "").strip()
        product_name = row.get("product_name", "").strip()

        # Skip incomplete rows
        if not store or not product_group or not product_name:
            # Keep incomplete rows as-is (they will fail validation anyway)
            key = (store.lower(), product_group.lower(), f"__incomplete_{id(row)}")
            aggregated[key] = row.copy()
            continue

        key = (store.lower(), product_group.lower(), product_name.lower())

        if key in aggregated:
            existing = aggregated[key]

            # Sum quantity
            try:
                existing_qty = float(
                    str(existing.get("quantity") or "0").replace(",", ".")
                )
                new_qty = float(str(row.get("quantity") or "0").replace(",", "."))
                total = existing_qty + new_qty
                existing["quantity"] = str(total) if total > 0 else None
            except (ValueError, TypeError):
                # Keep existing quantity if parsing fails
                pass

            # Merge comments via comma
            existing_comment = (existing.get("comment") or "").strip()
            new_comment = (row.get("comment") or "").strip()
            if new_comment:
                if existing_comment:
                    existing["comment"] = f"{existing_comment}, {new_comment}"
                else:
                    existing["comment"] = new_comment

            # Unit: take first non-empty value
            if not existing.get("unit") and row.get("unit"):
                existing["unit"] = row.get("unit")
        else:
            # First occurrence - preserve original case
            aggregated[key] = row.copy()

    return list(aggregated.values())


def detect_duplicates(rows: list[dict[str, Any]]) -> list[ValidationError]:
    """
    Detect duplicate rows (same product_name in same store and product_group).

    Args:
        rows: List of row dictionaries

    Returns:
        List of ValidationErrors for duplicates
    """
    seen: dict[tuple[str, str, str], int] = {}  # (store, group, product) → first_index
    duplicates: list[ValidationError] = []

    for idx, row in enumerate(rows):
        store = row.get("store", "").strip()
        product_group = row.get("product_group", "").strip()
        product_name = row.get("product_name", "").strip()

        if not store or not product_group or not product_name:
            continue  # Skip incomplete rows

        key = (store.lower(), product_group.lower(), product_name.lower())

        if key in seen:
            first_idx = seen[key]
            duplicates.append(
                ValidationError(
                    row_index=idx,
                    field="product_name",
                    value=product_name,
                    error_type="duplicate",
                    message=f"Duplicate product (first occurrence at row {first_idx})",
                    severity="warning",
                )
            )
        else:
            seen[key] = idx

    return duplicates


async def validate_csv_rows(
    session: AsyncSession, rows: list[dict[str, Any]]
) -> ValidationResult:
    """
    Validate all CSV rows.

    Checks:
    - Required fields (store, product_group, product_name)
    - Quantity format
    - Store reference
    - Product group reference
    - Duplicates

    Args:
        session: Database session
        rows: List of row dictionaries with mapped field names

    Returns:
        ValidationResult with errors and warnings
    """
    result = ValidationResult()
    result.total_rows = len(rows)

    # Caches to avoid repeated queries
    stores_cache: dict[str, int] = {}
    product_groups_cache: dict[str, int] = {}

    for idx, row in enumerate(rows):
        row_errors: list[ValidationError] = []

        # Validate required fields
        for field in ["store", "product_group", "product_name"]:
            error = validate_required_field(idx, field, row.get(field))
            if error:
                row_errors.append(error)

        # Validate quantity (optional field)
        if "quantity" in row:
            error = validate_quantity(idx, row.get("quantity"))
            if error:
                row_errors.append(error)

        # Validate store reference (only if field is present)
        if "store" in row and row.get("store"):
            error = await validate_store_reference(
                session, idx, row["store"], stores_cache
            )
            if error:
                row_errors.append(error)

        # Validate product group reference (only if field is present)
        if "product_group" in row and row.get("product_group"):
            error = await validate_product_group_reference(
                session, idx, row["product_group"], product_groups_cache
            )
            if error:
                row_errors.append(error)

        # Add errors to result
        for error in row_errors:
            result.add_error(error)

        # Update counts
        if row_errors:
            result.invalid_rows += 1
        else:
            result.valid_rows += 1

    # Detect duplicates (warnings)
    duplicate_errors = detect_duplicates(rows)
    for error in duplicate_errors:
        result.add_error(error)

    return result
