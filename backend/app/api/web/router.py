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

    Redirects to /login-email if unauthenticated, shows dashboard if authenticated.
    """
    from fastapi.responses import RedirectResponse
    from backend.app.main import templates

    # Redirect unauthenticated users to login page
    if not current_user:
        return RedirectResponse(url="/login-email", status_code=303)

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


@web_router.get("/facts", response_class=HTMLResponse)
async def facts(
    request: Request,
    current_user: CurrentUserOptional = None
):
    """
    Facts management page (accessible to all users).

    Provides interface for viewing, editing, and deleting financial facts
    with pagination and filtering capabilities.
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "facts.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Факты"
        }
    )


@web_router.get("/plan", response_class=HTMLResponse)
async def plan(
    request: Request,
    current_user: CurrentUserOptional = None
):
    """
    Plan management page (accessible to all users).

    Provides interface for viewing, editing, and deleting planned financial transactions
    with pagination and filtering capabilities. Shows only record_type='plan' entries.
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "plan.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "План"
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


@web_router.get("/notifications", response_class=HTMLResponse)
async def notifications(
    request: Request,
    current_user: CurrentUserOptional = None
):
    """
    Notifications history page (accessible to all users).

    Provides interface for viewing budget notification history:
    - Budget threshold alerts (90% warning)
    - Budget exceeded notifications
    - Weekly/monthly reports
    - Filtering by type and date range
    - Broadcast notifications visible to all users

    Uses REST API endpoints for data fetching.
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "notifications.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Уведомления"
        }
    )


@web_router.get("/import", response_class=HTMLResponse)
async def import_page(
    request: Request,
    current_user: CurrentUser
):
    """
    Tinkoff CSV import page (all authenticated users).

    Provides interface for importing transactions from Tinkoff bank CSV:
    - Upload CSV file
    - Review and enrich transactions in staging table
    - Assign categories, financial centers, cost centers
    - Bulk operations for mass assignment
    - Execute import to BudgetFact
    - Cleanup staging after import

    Uses REST API endpoints for all operations (FR-080).
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "admin_import.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Импорт Tinkoff"
        }
    )


# =============================================================================
# Authentication Web Pages (Public and Authenticated)
# =============================================================================


@web_router.get("/register", response_class=HTMLResponse)
async def register_page(
    request: Request,
    current_user: CurrentUserOptional = None
):
    """
    Email registration page (public).

    Provides form for new users to register with email/password.
    After registration, account requires admin activation.
    """
    from backend.app.main import templates

    # Redirect if already logged in
    if current_user:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url="/", status_code=303)

    return templates.TemplateResponse(
        "register.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Регистрация"
        }
    )


@web_router.get("/login-email", response_class=HTMLResponse)
async def login_email_page(
    request: Request,
    current_user: CurrentUserOptional = None
):
    """
    Email login page (public).

    Provides form for users to login with email/password.
    After successful password verification, redirects to 2FA page.
    """
    from backend.app.main import templates

    # Redirect if already logged in
    if current_user:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url="/", status_code=303)

    return templates.TemplateResponse(
        "login_email.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Вход по Email"
        }
    )


@web_router.get("/2fa-verify", response_class=HTMLResponse)
async def two_factor_verify_page(
    request: Request,
    current_user: CurrentUserOptional = None
):
    """
    2FA verification page (public, requires session token).

    Shows form to enter TOTP code or backup code.
    Session token should be stored in sessionStorage by login page.
    """
    from backend.app.main import templates

    # Redirect if already logged in
    if current_user:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url="/", status_code=303)

    return templates.TemplateResponse(
        "2fa_verify.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Проверка 2FA"
        }
    )


@web_router.get("/pending-activation", response_class=HTMLResponse)
async def pending_activation_page(
    request: Request,
    current_user: CurrentUserOptional = None
):
    """
    Pending activation page (public).

    Shows information for users who registered but are waiting
    for admin approval.
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "pending_activation.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Ожидание активации"
        }
    )


@web_router.get("/security", response_class=HTMLResponse)
async def security_settings_page(
    request: Request,
    current_user: CurrentUser
):
    """
    Security settings page (authenticated).

    Provides interface for managing security settings:
    - Add email to Telegram account
    - Set/change password
    - Enable/disable 2FA
    - Link Telegram to email account
    - View backup codes
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "security_settings.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Настройки безопасности"
        }
    )


@web_router.get("/2fa-setup", response_class=HTMLResponse)
async def two_factor_setup_page(
    request: Request,
    current_user: CurrentUser
):
    """
    2FA setup page (authenticated).

    Provides interface for setting up two-factor authentication:
    - Display QR code for authenticator app
    - Manual secret entry option
    - Code verification
    - Backup codes display
    """
    from backend.app.main import templates

    return templates.TemplateResponse(
        "2fa_setup.html",
        {
            "request": request,
            "user": current_user,
            "page_title": "Настройка 2FA"
        }
    )
