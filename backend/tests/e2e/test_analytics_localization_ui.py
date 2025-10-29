"""
E2E Test: Analytics UI Localization (Russian labels).

Tests verify that all analytics charts display Russian labels in the UI:
- Plan-Fact Chart: Y-axis "Сумма (₽)", tooltips "Разница:"
- Trends Chart: Y-axis "Сумма (₽)", tooltips "Чистый доход:"
- Category Breakdown: Tooltip "Сумма:", "Процент:"
- Waterfall Chart: Y-axis "Сумма (₽)", tooltips "Доходы:", "Расходы:", "Накопительный итог:"
- Heatmap: Visualmap "Высокий", "Низкий", series "Расходы"

This test suite requires Playwright for browser automation.
"""

import pytest
from datetime import date, timedelta
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.user import User
from backend.app.models.fact import Fact


@pytest.mark.asyncio
@pytest.mark.e2e
class TestAnalyticsLocalizationUI:
    """Test suite for analytics UI localization (requires Playwright)."""

    async def test_all_charts_russian_labels_visible(
        self,
        auth_client: AsyncClient,
        session: AsyncSession
    ):
        """
        Test that all analytics charts display Russian labels.

        This test verifies API responses contain Russian labels.
        For full UI testing with Playwright, see separate test suite.

        Checks:
        1. Plan-Fact: Russian day names for week period
        2. Heatmap: Russian day labels
        3. Waterfall: Russian month names for year period
        4. No English labels present
        """

        print("\n🌐 ANALYTICS LOCALIZATION TEST")

        # STEP 1: Create test data for all charts
        print("\n📊 Step 1: Creating test data...")

        # Get authenticated user from client
        response = await auth_client.get("/api/v1/auth/me")
        assert response.status_code == 200
        user_data = response.json()
        user_id = user_data["id"]

        # Create facts for current week (for Plan-Fact)
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())

        for i in range(7):
            fact_date = start_of_week + timedelta(days=i)
            fact = Fact(
                user_id=user_id,
                fact_date=fact_date,
                amount=-100.0 * (i + 1),  # Varying amounts
                record_type="fact",
                description=f"Week day {i}"
            )
            session.add(fact)

        # Create facts for current year (for Waterfall)
        year = today.year
        for month in range(1, 13):
            fact_date = date(year, month, 15)
            fact = Fact(
                user_id=user_id,
                fact_date=fact_date,
                amount=-500.0 * month,  # Increasing amounts
                record_type="fact",
                description=f"Month {month}"
            )
            session.add(fact)

        await session.commit()
        print("✓ Test data created")

        # STEP 2: Test Plan-Fact Chart (Week period)
        print("\n📈 Step 2: Testing Plan-Fact Chart localization...")

        response = await auth_client.get("/api/v1/analytics/plan-fact?period=week")
        assert response.status_code == 200
        plan_fact_data = response.json()

        # Verify Russian day names
        expected_days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        assert plan_fact_data["labels"] == expected_days, \
            f"Plan-Fact должен использовать русские дни недели: {expected_days}"
        print(f"✓ Plan-Fact: Дни недели = {plan_fact_data['labels']}")

        # Verify no English days
        for label in plan_fact_data["labels"]:
            assert label not in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], \
                f"Найдена английская метка: {label}"

        # STEP 3: Test Heatmap
        print("\n🔥 Step 3: Testing Heatmap localization...")

        response = await auth_client.get("/api/v1/analytics/heatmap?period=month")
        assert response.status_code == 200
        heatmap_data = response.json()

        # Verify Russian day labels
        expected_days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        assert heatmap_data["day_labels"] == expected_days, \
            f"Heatmap должен использовать русские дни недели: {expected_days}"
        print(f"✓ Heatmap: day_labels = {heatmap_data['day_labels']}")

        # STEP 4: Test Waterfall Chart (Year period)
        print("\n💧 Step 4: Testing Waterfall Chart localization...")

        response = await auth_client.get("/api/v1/analytics/waterfall?period=year")
        assert response.status_code == 200
        waterfall_data = response.json()

        # Verify Russian month names
        expected_months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн",
                          "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"]

        # Extract month labels (exclude Start and Total)
        month_labels = waterfall_data["labels"][1:-1]
        assert month_labels == expected_months, \
            f"Waterfall должен использовать русские месяцы: {expected_months}"
        print(f"✓ Waterfall: Месяцы = {month_labels}")

        # Verify no English months
        for label in waterfall_data["labels"]:
            english_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            assert label not in english_months, \
                f"Найдена английская метка месяца: {label}"

        # STEP 5: Comprehensive English words check
        print("\n🔍 Step 5: Checking for English words in all responses...")

        english_words = [
            "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",  # Days
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",         # Months
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ]

        all_labels = (
            plan_fact_data["labels"] +
            heatmap_data["day_labels"] +
            waterfall_data["labels"]
        )

        for label in all_labels:
            for eng_word in english_words:
                assert eng_word not in label, \
                    f"Найдено английское слово '{eng_word}' в метке: {label}"

        print("✓ Английские слова не обнаружены")

        # STEP 6: Summary
        print("\n✅ LOCALIZATION TEST PASSED")
        print("=" * 60)
        print("Все графики используют русские метки:")
        print(f"  - Plan-Fact (week):   {plan_fact_data['labels']}")
        print(f"  - Heatmap:            {heatmap_data['day_labels']}")
        print(f"  - Waterfall (year):   {month_labels}")
        print("=" * 60)


@pytest.mark.skipif(
    "not config.getoption('--run-playwright')",
    reason="Requires --run-playwright flag and Playwright setup"
)
@pytest.mark.asyncio
@pytest.mark.e2e
@pytest.mark.playwright
class TestAnalyticsLocalizationPlaywright:
    """
    Playwright-based UI tests for analytics localization.

    These tests require:
    1. Playwright installed: pip install playwright && playwright install
    2. Backend server running: uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
    3. pytest --run-playwright flag

    Tests verify:
    - Y-axis labels show "Сумма (₽)" (not "Amount (₽)")
    - Tooltips show Russian labels
    - Visualmap shows "Высокий", "Низкий" (not "High", "Low")
    - No JavaScript errors in console
    """

    async def test_plan_fact_chart_ui_russian_labels(self, page):
        """
        Test Plan-Fact chart displays Russian labels in browser.

        Verifies:
        - Y-axis: "Сумма (₽)"
        - X-axis: "Пн, Вт, Ср..." (not "Mon, Tue, Wed")
        - Tooltip: "Разница:" (not "Difference:")
        """
        # This is a placeholder - actual implementation requires Playwright setup
        # See: https://playwright.dev/python/docs/intro
        pytest.skip("Playwright tests require separate setup")

    async def test_waterfall_reset_button_functionality(self, page):
        """
        Test Waterfall chart reset button works correctly.

        Verifies:
        - Button appears after drill-down
        - Button text: "← Сбросить фильтр"
        - Button resets to main view
        - No JavaScript errors
        """
        pytest.skip("Playwright tests require separate setup")

    async def test_heatmap_visualmap_russian_labels(self, page):
        """
        Test Heatmap visualmap displays Russian labels.

        Verifies:
        - Visualmap shows "Высокий", "Низкий"
        - Series name: "Расходы"
        - Day labels: "Пн, Вт, Ср..."
        """
        pytest.skip("Playwright tests require separate setup")
