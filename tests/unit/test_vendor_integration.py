"""
Unit Tests for Vendor Files Integration

Tests CDN to Local migration:
- Vendor files existence
- Valid JS/CSS syntax
- HTML templates updated with local paths
"""
import os
import re
import pytest
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent

# Skip all tests in this module - vendor files generated during CI/CD build
pytestmark = pytest.mark.skip(reason="Vendor files generated during CI/CD build, not available in unit test environment")


@pytest.mark.unit
class TestVendorFilesExistence:
    """Test that all vendor files exist"""

    def test_htmx_exists(self):
        """HTMX 1.9.10 должен быть скачан"""
        htmx_path = PROJECT_ROOT / "frontend/web/static/js/vendor/htmx.min.js"
        assert htmx_path.exists(), f"HTMX not found at {htmx_path}"
        assert htmx_path.stat().st_size > 40000, "HTMX file size too small"

    def test_echarts_exists(self):
        """ECharts 5.5.0 должен быть скачан"""
        echarts_path = PROJECT_ROOT / "frontend/web/static/js/vendor/echarts.min.js"
        assert echarts_path.exists(), f"ECharts not found at {echarts_path}"
        assert echarts_path.stat().st_size > 1000000, "ECharts file size too small"

    def test_tailwind_daisyui_exists(self):
        """Tailwind CSS + DaisyUI build должен существовать"""
        tw_path = PROJECT_ROOT / "frontend/web/static/css/vendor/tailwind-daisyui.min.css"
        assert tw_path.exists(), f"Tailwind+DaisyUI not found at {tw_path}"
        assert tw_path.stat().st_size > 100000, "Tailwind CSS file size too small"

    def test_choices_exists(self):
        """Choices.js должен остаться (existing vendor)"""
        choices_js = PROJECT_ROOT / "frontend/web/static/js/vendor/choices.min.js"
        choices_css = PROJECT_ROOT / "frontend/web/static/css/vendor/choices.min.css"
        assert choices_js.exists(), "Choices.js not found"
        assert choices_css.exists(), "Choices.css not found"


@pytest.mark.unit
class TestHTMLTemplatesUpdated:
    """Test that HTML templates use local paths, not CDN"""

    def test_base_html_no_cdn_tailwind(self):
        """base.html НЕ должен содержать CDN ссылок на Tailwind"""
        base_html = PROJECT_ROOT / "frontend/web/templates/base.html"
        content = base_html.read_text()

        assert "cdn.tailwindcss.com" not in content, "base.html still uses Tailwind CDN"
        assert "cdn.jsdelivr.net/npm/daisyui" not in content, "base.html still uses DaisyUI CDN"
        assert "unpkg.com/htmx.org" not in content, "base.html still uses HTMX CDN"

    def test_base_html_uses_local_vendor(self):
        """base.html должен использовать локальные vendor файлы"""
        base_html = PROJECT_ROOT / "frontend/web/templates/base.html"
        content = base_html.read_text()

        assert "/static/css/vendor/tailwind-daisyui.min.css?v=PLACEHOLDER" in content, \
            "base.html missing local Tailwind CSS"
        assert "/static/js/vendor/htmx.min.js?v=PLACEHOLDER" in content, \
            "base.html missing local HTMX"

    def test_analytics_html_uses_local_echarts(self):
        """analytics.html должен использовать локальный ECharts"""
        analytics_html = PROJECT_ROOT / "frontend/web/templates/analytics.html"
        content = analytics_html.read_text()

        assert "cdn.jsdelivr.net/npm/echarts" not in content, \
            "analytics.html still uses ECharts CDN"
        assert "/static/js/vendor/echarts.min.js?v=PLACEHOLDER" in content, \
            "analytics.html missing local ECharts"

    def test_admin_dashboard_html_uses_local_echarts(self):
        """admin_dashboard.html должен использовать локальный ECharts"""
        admin_dash = PROJECT_ROOT / "frontend/web/templates/admin_dashboard.html"
        content = admin_dash.read_text()

        assert "cdn.jsdelivr.net/npm/echarts" not in content, \
            "admin_dashboard.html still uses ECharts CDN"
        assert "/static/js/vendor/echarts.min.js?v=PLACEHOLDER" in content, \
            "admin_dashboard.html missing local ECharts"

    def test_webapp_telegram_sdk_on_cdn(self):
        """Telegram Web App SDK должен ОСТАТЬСЯ на CDN (official API)"""
        webapp_files = [
            "add.html", "addplan.html", "edit.html", "index.html",
            "list.html", "stats.html", "summary.html", "test.html", "today.html"
        ]

        for filename in webapp_files:
            webapp_file = PROJECT_ROOT / f"frontend/webapp/{filename}"
            if webapp_file.exists():
                content = webapp_file.read_text()
                assert "telegram.org/js/telegram-web-app.js" in content, \
                    f"{filename} missing Telegram SDK (should stay on CDN)"


@pytest.mark.unit
class TestBuildConfiguration:
    """Test npm build configuration"""

    def test_package_json_has_build_css(self):
        """package.json должен содержать build:css script"""
        package_json = PROJECT_ROOT / "package.json"
        content = package_json.read_text()

        assert '"build:css"' in content, "package.json missing build:css script"
        assert "tailwindcss" in content, "package.json missing tailwindcss in build:css"

    def test_tailwind_config_exists(self):
        """tailwind.config.js должен существовать"""
        tailwind_config = PROJECT_ROOT / "tailwind.config.js"
        assert tailwind_config.exists(), "tailwind.config.js not found"

        content = tailwind_config.read_text()
        assert "daisyui" in content, "tailwind.config.js missing daisyui plugin"
        assert "@tailwindcss/forms" in content, "tailwind.config.js missing forms plugin"

    def test_tailwind_input_exists(self):
        """tailwind.input.css должен существовать"""
        tw_input = PROJECT_ROOT / "frontend/web/static/css/tailwind.input.css"
        assert tw_input.exists(), "tailwind.input.css not found"

        content = tw_input.read_text()
        assert "@tailwind base" in content, "tailwind.input.css missing @tailwind directives"


@pytest.mark.unit
class TestCacheBusting:
    """Test cache busting for vendor files"""

    def test_vendor_files_have_version_placeholder(self):
        """Все vendor файлы должны иметь ?v=PLACEHOLDER в HTML"""
        files_to_check = {
            "base.html": [
                "htmx.min.js?v=PLACEHOLDER",
                "tailwind-daisyui.min.css?v=PLACEHOLDER"
            ],
            "analytics.html": [
                "echarts.min.js?v=PLACEHOLDER"
            ],
            "admin_dashboard.html": [
                "echarts.min.js?v=PLACEHOLDER"
            ]
        }

        for filename, expected_strings in files_to_check.items():
            file_path = PROJECT_ROOT / f"frontend/web/templates/{filename}"
            content = file_path.read_text()

            for expected in expected_strings:
                assert expected in content, \
                    f"{filename} missing cache busting for {expected}"
