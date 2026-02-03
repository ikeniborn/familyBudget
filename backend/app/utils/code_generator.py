"""
Code Generator Utility - Auto-generate sequential business codes for dimension tables.

Generates unique sequential codes for dimension models.

Pattern: {PREFIX}-{SEQUENTIAL_NUMBER}
Examples:
- Article: ART-1, ART-2, ART-3, ...
- FinancialCenter: CFO-1, CFO-2, CFO-3, ...
- CostCenter: MVZ-1, MVZ-2, MVZ-3, ...
- Store: STORE-1, STORE-2, STORE-3, ...
- ProductGroup: PGRP-1, PGRP-2, PGRP-3, ...

Created: 2025-11-09
"""

import re
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from backend.app.models.article import Article
from backend.app.models.cost_center import CostCenter
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.product_group import ProductGroup
from backend.app.models.store import Store

# Type variable for dimension models
T = TypeVar("T", Article, FinancialCenter, CostCenter, Store, ProductGroup)

# Prefix mapping for each model type
MODEL_PREFIXES = {
    Article: "ART",
    FinancialCenter: "CFO",
    CostCenter: "MVZ",
    Store: "STORE",
    ProductGroup: "PGRP",
}


async def generate_code(
    session: AsyncSession,
    model_class: type[T],
) -> str:
    """
    Generate next sequential code for dimension model.

    Algorithm:
    1. Get prefix for model (ART/CFO/MVZ)
    2. Query all existing codes with this prefix
    3. Extract numeric parts and find maximum
    4. Return {PREFIX}-{MAX+1}

    Args:
        session: SQLAlchemy async session
        model_class: Model class (Article, FinancialCenter, or CostCenter)

    Returns:
        Generated code string (e.g., "ART-5", "CFO-12")

    Examples:
        >>> # No existing codes → ART-1
        >>> code = await generate_code(session, Article)
        >>> assert code == "ART-1"

        >>> # Existing codes: ART-1, ART-3, ART-5 → ART-6
        >>> code = await generate_code(session, Article)
        >>> assert code == "ART-6"

        >>> # FinancialCenter: CFO-1, CFO-2 → CFO-3
        >>> code = await generate_code(session, FinancialCenter)
        >>> assert code == "CFO-3"

    Raises:
        ValueError: If model_class is not in MODEL_PREFIXES
    """
    # Get prefix for model
    prefix = MODEL_PREFIXES.get(model_class)
    if prefix is None:
        raise ValueError(
            f"Unsupported model class: {model_class}. "
            f"Supported: {list(MODEL_PREFIXES.keys())}"
        )

    # Query all existing codes with this prefix
    statement = select(model_class.code).where(
        model_class.code.like(f"{prefix}-%")  # type: ignore
    )
    result = await session.execute(statement)
    existing_codes = result.scalars().all()

    # Extract numeric parts from existing codes
    numbers = []
    pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$")

    for code in existing_codes:
        if code is None:
            continue
        match = pattern.match(code)
        if match:
            numbers.append(int(match.group(1)))

    # Find next number (max + 1, or 1 if no codes exist)
    next_number = max(numbers) + 1 if numbers else 1

    # Generate code
    generated_code = f"{prefix}-{next_number}"

    return generated_code


async def get_prefix_for_model(model_class: type[SQLModel]) -> str:
    """
    Get code prefix for model class.

    Args:
        model_class: Model class

    Returns:
        Prefix string (ART/CFO/MVZ)

    Raises:
        ValueError: If model not in mapping

    Examples:
        >>> prefix = await get_prefix_for_model(Article)
        >>> assert prefix == "ART"
    """
    prefix = MODEL_PREFIXES.get(model_class)
    if prefix is None:
        raise ValueError(
            f"No prefix mapping for model: {model_class}. "
            f"Supported: {list(MODEL_PREFIXES.keys())}"
        )
    return prefix
