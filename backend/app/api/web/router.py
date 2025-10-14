"""
Web UI router for serving HTML pages.

Handles web interface routes with Jinja2 templates and HTMX integration.
"""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse

from backend.app.core.dependencies import CurrentAdmin, CurrentUserOptional
from backend.app.models.user import User

web_router = APIRouter(tags=["Web UI"])


@web_router.get("/", response_class=HTMLResponse)
async def index(
    request: Request,
    current_user: CurrentUserOptional = None
):
    """
    Home page / dashboard.

    Shows login prompt if unauthenticated, analytics dashboard if authenticated.
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Family Budget"
        }
    )


@web_router.get("/analytics", response_class=HTMLResponse)
async def analytics(
    request: Request,
    current_user: CurrentUserOptional = None
):
    """
    Analytics dashboard page.

    Interactive charts with ECharts and HTMX.
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "analytics.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Analytics"
        }
    )


@web_router.get("/admin/users", response_class=HTMLResponse)
async def admin_users(
    request: Request,
    current_admin: CurrentAdmin
):
    """
    Admin users management page (admin only).

    Provides interface for viewing and managing all users,
    including granting/revoking admin privileges.
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "admin_users.html",
        {
            "request": request,
            "user": current_admin,
            "page_title": "User Management"
        }
    )


@web_router.get("/admin/articles", response_class=HTMLResponse)
async def admin_articles(
    request: Request,
    current_admin: CurrentAdmin
):
    """
    Admin articles management page (admin only).

    Provides interface for managing income/expense categories
    with hierarchical tree structure.
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "admin_articles.html",
        {
            "request": request,
            "user": current_admin,
            "page_title": "Articles Management"
        }
    )
