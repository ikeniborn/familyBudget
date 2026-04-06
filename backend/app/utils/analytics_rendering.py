"""
Rendering helpers for analytics HTML responses.

Contains formatting functions, CSS class constants, HTML card renderers,
and inline CSS extracted from analytics.py for separation of concerns.
"""
import html


def _format_money_mobile(amount: float) -> str:
    """Format money with abbreviations for mobile: 1k, 1M, etc."""
    abs_amount = abs(amount)
    sign = "-" if amount < 0 else ""
    if abs_amount >= 1_000_000:
        val = abs_amount / 1_000_000
        return f"{sign}{val:.1f}M".rstrip('0').rstrip('.')
    elif abs_amount >= 1_000:
        val = abs_amount / 1_000
        return f"{sign}{val:.1f}k".rstrip('0').rstrip('.')
    return f"{sign}{int(abs_amount)}"


def _format_money_desktop(amount: float) -> str:
    """Format money with thousand separators for desktop."""
    abs_amount = abs(amount)
    sign = "-" if amount < 0 else ""
    return f"{sign}{int(abs_amount):,}".replace(',', ' ')


def _format_pct(pct: float) -> str:
    return f"{pct:.1f}%"


def _get_pct_color(pct: float) -> str:
    if pct >= 95.0:
        return "text-success"
    elif pct >= 80.0:
        return "text-warning"
    return "text-error"


def _get_balance_color(balance: float) -> str:
    if balance > 0:
        return "text-success"
    elif balance < 0:
        return "text-error"
    return "text-base-content"


_VALID_STAT_CSS_CLASSES = frozenset({"text-success", "text-error", "text-info", "text-warning"})


_BALANCES_EMPTY_HTML = """
<div class="alert alert-info">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
    <span>Нет активных счетов</span>
</div>
"""


def _render_stat_card(title: str, plan: float, fact: float, pct: float, fact_color: str) -> str:
    """Render one stat card HTML (income/expense/credit/debit)."""
    title = html.escape(title)
    if fact_color not in _VALID_STAT_CSS_CLASSES:
        fact_color = ""
    return f"""
        <div class="stat-card">
            <div class="stat-title">{title}</div>
            <div class="stat-rows">
                <div class="stat-row">
                    <span class="stat-label">План</span>
                    <span class="stat-value">
                        <span class="mobile-value">{_format_money_mobile(plan)}</span>
                        <span class="desktop-value">{_format_money_desktop(plan)}</span>
                    </span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Факт</span>
                    <span class="stat-value {fact_color}">
                        <span class="mobile-value">{_format_money_mobile(fact)}</span>
                        <span class="desktop-value">{_format_money_desktop(fact)}</span>
                    </span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Исп.%</span>
                    <span class="stat-pct {_get_pct_color(pct)}">{_format_pct(pct)}</span>
                </div>
            </div>
        </div>"""


def _render_balance_card(bal: dict) -> str:
    """Render one balance card HTML for a financial center."""
    _name = html.escape(bal['name'])
    return f"""
        <div class="balance-card" data-movement="{bal['month_movement']:.2f}">
            <div class="balance-title" title="{_name}">{_name}</div>
            <div>
                <div class="balance-row">
                    <span class="balance-label">Начало</span>
                    <span class="balance-value {_get_balance_color(bal['opening_balance'])}">
                        <span class="mobile-value">{_format_money_mobile(bal['opening_balance'])}</span>
                        <span class="desktop-value">{_format_money_desktop(bal['opening_balance'])}</span>
                    </span>
                </div>
                <div class="balance-row balance-divider">
                    <span class="balance-label">Текущий</span>
                    <span class="balance-value font-bold {_get_balance_color(bal['current_balance'])}">
                        <span class="mobile-value">{_format_money_mobile(bal['current_balance'])}</span>
                        <span class="desktop-value">{_format_money_desktop(bal['current_balance'])}</span>
                    </span>
                </div>
            </div>
        </div>"""


def _calc_plan_execution(fact: float, plan: float) -> float:
    """Calculate plan execution percentage with division by zero protection."""
    return (fact / plan * 100.0) if plan > 0 else 0.0


def _build_quick_stat_cards(
    month_data: dict[str, float], month_plan_data: dict[str, float]
) -> str:
    """Build HTML stat cards for quick stats dashboard."""
    types = [
        ("income", "💰 Доходы", "text-success"),
        ("expense", "💸 Расходы", "text-error"),
        ("credit", "➕ Пополнение", "text-info"),
        ("debit", "➖ Списание", "text-warning"),
    ]
    cards = []
    for type_key, label, css_class in types:
        fact_val = month_data.get(type_key, 0.0)
        plan_val = month_plan_data.get(type_key, 0.0)
        pct = _calc_plan_execution(fact_val, plan_val)
        cards.append(_render_stat_card(label, plan_val, fact_val, pct, css_class))
    return "".join(cards)


def _get_quick_stats_css() -> str:
    """Return inline CSS for quick stats HTMX fragment (5 breakpoints)."""
    return """
        /* === QUICK STATS: 5 Breakpoints Grid Layout === */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
        }
        .stat-card {
            background: oklch(var(--b2));
            border-radius: 0.5rem;
            padding: 0.5rem 0.625rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid oklch(var(--b3));
        }
        .stat-title {
            font-weight: 600;
            font-size: 0.8125rem;
            margin-bottom: 0.25rem;
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }
        .stat-rows {
            display: flex;
            flex-direction: column;
            gap: 0;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 0.375rem;
            white-space: nowrap;
            height: 1.125rem;
        }
        .stat-label {
            font-size: 0.6875rem;
            opacity: 0.6;
            flex-shrink: 0;
        }
        .stat-value {
            font-size: 0.8125rem;
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .stat-pct {
            font-size: 0.6875rem;
            font-weight: 700;
        }
        /* Mobile/Desktop value toggle */
        .mobile-value { display: inline; }
        .desktop-value { display: none; }

        /* Breakpoint: <375px (XS) - 1 column */
        @media (max-width: 374px) {
            .stats-grid {
                grid-template-columns: 1fr;
                gap: 0.375rem;
            }
            .stat-card { padding: 0.375rem 0.5rem; }
            .stat-title { font-size: 0.75rem; }
            .stat-label { font-size: 0.625rem; }
            .stat-value { font-size: 0.75rem; }
            .stat-pct { font-size: 0.625rem; }
        }

        /* Breakpoint: 375-479px (SM) - 2 columns */
        @media (min-width: 375px) and (max-width: 479px) {
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.5rem;
            }
        }

        /* Breakpoint: 480-767px (MD) - 2 columns, larger fonts */
        @media (min-width: 480px) and (max-width: 767px) {
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.75rem;
            }
            .stat-card { padding: 0.625rem 0.75rem; }
            .stat-title { font-size: 0.875rem; }
            .stat-label { font-size: 0.75rem; }
            .stat-value { font-size: 0.875rem; }
            .stat-pct { font-size: 0.75rem; }
        }

        /* Breakpoint: 768-1023px (LG) - 4 columns, desktop values */
        @media (min-width: 768px) and (max-width: 1023px) {
            .mobile-value { display: none; }
            .desktop-value { display: inline; }
            .stats-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 0.75rem;
            }
            .stat-card { padding: 0.625rem 0.75rem; }
            .stat-title { font-size: 0.9375rem; }
            .stat-label { font-size: 0.75rem; }
            .stat-value { font-size: 0.9375rem; }
            .stat-pct { font-size: 0.75rem; }
        }

        /* Breakpoint: >=1024px (XL) - 4 columns, full desktop */
        @media (min-width: 1024px) {
            .mobile-value { display: none; }
            .desktop-value { display: inline; }
            .stats-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 1rem;
            }
            .stat-card { padding: 0.75rem 1rem; }
            .stat-title { font-size: 1rem; }
            .stat-label { font-size: 0.8125rem; }
            .stat-value { font-size: 1rem; }
            .stat-pct { font-size: 0.8125rem; }
        }
    """


def _get_balances_css() -> str:
    """Return inline CSS for balances HTMX fragment (5 breakpoints)."""
    return """
        /* === BALANCES: 5 Breakpoints Grid Layout (fixed like quick-stats) === */
        .balances-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
        }
        .balance-card {
            background: oklch(var(--b2));
            border-radius: 0.5rem;
            padding: 0.5rem 0.625rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid oklch(var(--b3));
        }
        .balance-title {
            font-weight: 600;
            font-size: 0.75rem;
            margin-bottom: 0.25rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .balance-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 0.25rem;
            white-space: nowrap;
            line-height: 1.2;
        }
        .balance-label {
            font-size: 0.625rem;
            opacity: 0.6;
            flex-shrink: 0;
        }
        .balance-value {
            font-size: 0.75rem;
            font-weight: 600;
        }
        .balance-divider {
            border-top: 1px solid oklch(var(--b3));
            margin-top: 0.25rem;
            padding-top: 0.25rem;
        }
        /* Mobile/Desktop value toggle */
        .mobile-value { display: inline; }
        .desktop-value { display: none; }

        /* Breakpoint: <375px (XS) - 1 column */
        @media (max-width: 374px) {
            .balances-grid {
                grid-template-columns: 1fr;
                gap: 0.375rem;
            }
            .balance-card { padding: 0.375rem 0.5rem; }
            .balance-title { font-size: 0.6875rem; }
            .balance-label { font-size: 0.5625rem; }
            .balance-value { font-size: 0.6875rem; }
        }

        /* Breakpoint: 375-479px (SM) - 2 columns */
        @media (min-width: 375px) and (max-width: 479px) {
            .balances-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.5rem;
            }
        }

        /* Breakpoint: 480-767px (MD) - 2 columns */
        @media (min-width: 480px) and (max-width: 767px) {
            .balances-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.75rem;
            }
            .balance-card { padding: 0.625rem 0.75rem; }
            .balance-title { font-size: 0.8125rem; }
            .balance-label { font-size: 0.6875rem; }
            .balance-value { font-size: 0.8125rem; }
        }

        /* Breakpoint: 768-1023px (LG) - 4 columns, desktop values */
        @media (min-width: 768px) and (max-width: 1023px) {
            .mobile-value { display: none; }
            .desktop-value { display: inline; }
            .balances-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 0.75rem;
            }
            .balance-card { padding: 0.625rem 0.75rem; }
            .balance-title { font-size: 0.875rem; }
            .balance-label { font-size: 0.75rem; }
            .balance-value { font-size: 0.875rem; }
        }

        /* Breakpoint: >=1024px (XL) - 4 columns, full desktop */
        @media (min-width: 1024px) {
            .mobile-value { display: none; }
            .desktop-value { display: inline; }
            .balances-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 1rem;
            }
            .balance-card { padding: 0.75rem 1rem; }
            .balance-title { font-size: 0.9375rem; }
            .balance-label { font-size: 0.75rem; }
            .balance-value { font-size: 0.9375rem; }
        }
    """
