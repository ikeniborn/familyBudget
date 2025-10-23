"""
Web UI router for serving HTML pages.

Handles web interface routes with Jinja2 templates and HTMX integration.
"""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse

from backend.app.core.dependencies import CurrentAdmin, CurrentUser, CurrentUserOptional
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


@web_router.get("/admin/facts", response_class=HTMLResponse)
async def admin_facts(
    request: Request,
    current_user: CurrentUser
):
    """
    Facts management page (accessible to all authenticated users).

    Provides interface for viewing, editing, and deleting financial facts
    with pagination and filtering capabilities.
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "admin_facts.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Facts Management"
        }
    )


@web_router.get("/admin/monitoring", response_class=HTMLResponse)
async def admin_monitoring(
    request: Request,
    current_admin: CurrentAdmin
):
    """
    Admin monitoring dashboard (admin only).

    Provides real-time system health monitoring with:
    - Application status
    - Database health and statistics
    - System resource usage (CPU, memory, disk)
    - Uptime tracking
    - Component status indicators
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "admin_monitoring.html",
        {
            "request": request,
            "user": current_admin,
            "page_title": "System Monitoring"
        }
    )


@web_router.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard(
    request: Request,
    current_admin: CurrentAdmin
):
    """
    Admin analytics dashboard (admin only).

    Provides system-wide analytics and insights:
    - User registration trends
    - Transaction volume analysis
    - Top users by activity
    - Popular categories breakdown
    - ЦФО/МВЗ usage statistics
    - Financial summary (total income/expense/balance)

    Uses ECharts for interactive data visualizations.
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "admin_dashboard.html",
        {
            "request": request,
            "user": current_admin,
            "page_title": "Admin Analytics Dashboard"
        }
    )


@web_router.get("/admin/financial-centers", response_class=HTMLResponse)
async def admin_financial_centers(
    request: Request,
    current_admin: CurrentAdmin
):
    """
    Admin financial centers management page (admin only).

    Provides interface for managing financial centers (ЦФО):
    - Bank accounts
    - Wallets
    - Cash
    - Other financial entities

    Uses REST API endpoints for CRUD operations.
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "admin_financial_centers.html",
        {
            "request": request,
            "user": current_admin,
            "page_title": "Financial Centers Management"
        }
    )


@web_router.get("/admin/cost-centers", response_class=HTMLResponse)
async def admin_cost_centers(
    request: Request,
    current_admin: CurrentAdmin
):
    """
    Admin cost centers management page (admin only).

    Provides interface for managing cost centers (МВЗ):
    - Projects
    - Departments
    - Budget groups
    - Other cost allocation entities

    Uses REST API endpoints for CRUD operations.
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "admin_cost_centers.html",
        {
            "request": request,
            "user": current_admin,
            "page_title": "Cost Centers Management"
        }
    )
