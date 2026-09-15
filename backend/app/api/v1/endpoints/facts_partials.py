"""
Facts HTMX Partials Endpoints.

Server-side rendered UI fragments for facts table, stats, and pagination.
Part of Phase 2: Migration from client-side rendering to HTMX partials.

Endpoints:
    GET /facts/stats - Render facts statistics widget
    GET /facts/pagination - Render pagination controls
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import HTMLResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, get_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/facts", tags=["Facts Partials (HTMX)"])


@router.get("/stats", response_class=HTMLResponse)
async def get_facts_stats_partial(
    request: Request,
    _current_user: CurrentUser,  # Required for authentication but not used
    session: AsyncSession = Depends(get_session),
    total: Annotated[int, Query(ge=0)] = 0,
    page: Annotated[int, Query(ge=0)] = 0,
    page_size: Annotated[int, Query(ge=1)] = 50,
) -> str:
    """
    Get facts statistics partial (HTMX).

    Renders server-side HTML stats widget showing:
    - Total facts count
    - Current page range (start-end)

    **Parameters:**
    - total: Total facts count (from query parameter)
    - page: Current page number (0-indexed)
    - page_size: Page size (default: 50)

    **Returns:**
    - HTML partial with stats widget
    """
    from backend.app.main import templates

    # Calculate page range
    start = page * page_size + 1 if total > 0 else 0
    end = min((page + 1) * page_size, total)

    return templates.TemplateResponse(
        "partials/facts/facts_stats.html",
        {
            "request": request,
            "total": total,
            "start": start,
            "end": end,
        },
    )


@router.get("/pagination", response_class=HTMLResponse)
async def get_facts_pagination_partial(
    request: Request,
    _current_user: CurrentUser,  # Required for authentication but not used
    total: Annotated[int, Query(ge=0)] = 0,
    page: Annotated[int, Query(ge=0)] = 0,
    page_size: Annotated[int, Query(ge=1)] = 50,
) -> str:
    """
    Get facts pagination controls partial (HTMX).

    Renders server-side HTML pagination controls with:
    - Previous/Next buttons
    - Page numbers
    - Disabled states

    **Parameters:**
    - total: Total facts count
    - page: Current page number (0-indexed)
    - page_size: Page size (default: 50)

    **Returns:**
    - HTML partial with pagination controls
    """
    from backend.app.main import templates

    # Calculate pagination data
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    has_previous = page > 0
    has_next = page < total_pages - 1

    return templates.TemplateResponse(
        "partials/facts/facts_pagination.html",
        {
            "request": request,
            "page": page,
            "total_pages": total_pages,
            "page_size": page_size,
            "has_previous": has_previous,
            "has_next": has_next,
        },
    )
