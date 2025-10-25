"""
Statistics API endpoints for Web Apps.

Provides aggregated statistics and analytics for Web App charts and summaries.

Endpoints:
    GET /api/v1/webapp/stats/summary - Aggregated summary (income, expense, balance)
    GET /api/v1/webapp/stats/by-category - Top N categories with totals
    GET /api/v1/webapp/stats/by-day - Daily breakdown for charts

Features:
    - Period filtering (today, week, month, year, custom)
    - Type filtering (expense/income)
    - Aggregations: sum, count, average, min, max
    - Top N categories
    - Chart-ready data format
"""

from fastapi import APIRouter

router = APIRouter(prefix="/stats")


# TODO: Implement endpoints (Phase 2+)
# - GET /stats/summary?period=month
#   - Response: { period: {start, end}, income: {total, count}, expense: {total, count}, balance }
#
# - GET /stats/by-category?period=month&type=expense
#   - Response: { categories: [{ id, name, total, count, percent }, ...], total }
#
# - GET /stats/by-day?period=month
#   - Response: { days: [{ date, income, expense, balance }, ...] }
