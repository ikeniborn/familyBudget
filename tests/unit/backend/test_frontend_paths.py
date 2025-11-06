"""
Unit tests for frontend paths configuration.

Tests that all frontend paths are correctly configured and exist.
"""

import pytest
from pathlib import Path


pytestmark = pytest.mark.unit


def test_frontend_paths_class_exists():
    """Test that FrontendPaths class can be imported"""
    try:
        from backend.app.core.paths import FrontendPaths

        assert FrontendPaths is not None
    except ImportError:
        pytest.fail("Cannot import FrontendPaths from backend.app.core.paths")


def test_frontend_root_path_exists():
    """Test that frontend root directory exists"""
    from backend.app.core.paths import FrontendPaths

    assert FrontendPaths.FRONTEND_ROOT.exists(), f"Frontend root not found: {FrontendPaths.FRONTEND_ROOT}"
    assert FrontendPaths.FRONTEND_ROOT.is_dir(), f"Frontend root is not a directory: {FrontendPaths.FRONTEND_ROOT}"


def test_web_paths_exist():
    """Test that web UI paths exist"""
    from backend.app.core.paths import FrontendPaths

    # Web static directory
    assert FrontendPaths.WEB_STATIC.exists(), f"Web static not found: {FrontendPaths.WEB_STATIC}"
    assert FrontendPaths.WEB_STATIC.is_dir()

    # Web static/js directory
    web_js = FrontendPaths.WEB_STATIC / "js"
    assert web_js.exists(), f"Web JS directory not found: {web_js}"

    # Web static/css directory
    web_css = FrontendPaths.WEB_STATIC / "css"
    assert web_css.exists(), f"Web CSS directory not found: {web_css}"

    # Web templates directory
    assert FrontendPaths.WEB_TEMPLATES.exists(), f"Web templates not found: {FrontendPaths.WEB_TEMPLATES}"
    assert FrontendPaths.WEB_TEMPLATES.is_dir()

    # Base template
    base_template = FrontendPaths.WEB_TEMPLATES / "base.html"
    assert base_template.exists(), f"Base template not found: {base_template}"


def test_webapp_paths_exist():
    """Test that Telegram Web Apps paths exist"""
    from backend.app.core.paths import FrontendPaths

    # Webapp root directory
    assert FrontendPaths.WEBAPP.exists(), f"Webapp directory not found: {FrontendPaths.WEBAPP}"
    assert FrontendPaths.WEBAPP.is_dir()

    # Webapp static directory
    webapp_static = FrontendPaths.WEBAPP / "static"
    assert webapp_static.exists(), f"Webapp static not found: {webapp_static}"

    # Webapp static/js directory
    webapp_js = webapp_static / "js"
    assert webapp_js.exists(), f"Webapp JS directory not found: {webapp_js}"

    # Webapp static/css directory
    webapp_css = webapp_static / "css"
    assert webapp_css.exists(), f"Webapp CSS directory not found: {webapp_css}"

    # Webapp index.html
    webapp_index = FrontendPaths.WEBAPP / "index.html"
    assert webapp_index.exists(), f"Webapp index.html not found: {webapp_index}"


def test_shared_paths_exist():
    """Test that shared modules paths exist"""
    from backend.app.core.paths import FrontendPaths

    # Shared root directory
    assert FrontendPaths.SHARED.exists(), f"Shared directory not found: {FrontendPaths.SHARED}"
    assert FrontendPaths.SHARED.is_dir()

    # Shared static directory
    shared_static = FrontendPaths.SHARED / "static"
    assert shared_static.exists(), f"Shared static not found: {shared_static}"

    # Shared static/js directory
    shared_js = shared_static / "js"
    assert shared_js.exists(), f"Shared JS directory not found: {shared_js}"

    # Calendar widget module
    calendar_widget = shared_js / "calendar-widget.js"
    assert calendar_widget.exists(), f"Calendar widget not found: {calendar_widget}"

    # Date formatter module
    date_formatter = shared_js / "dateFormatter.js"
    assert date_formatter.exists(), f"Date formatter not found: {date_formatter}"


def test_base_dir_is_absolute():
    """Test that BASE_DIR is an absolute path"""
    from backend.app.core.paths import FrontendPaths

    assert FrontendPaths.BASE_DIR.is_absolute(), "BASE_DIR must be an absolute path"


def test_all_paths_are_pathlib():
    """Test that all paths are pathlib.Path objects"""
    from backend.app.core.paths import FrontendPaths

    assert isinstance(FrontendPaths.BASE_DIR, Path), "BASE_DIR must be Path object"
    assert isinstance(FrontendPaths.FRONTEND_ROOT, Path), "FRONTEND_ROOT must be Path object"
    assert isinstance(FrontendPaths.WEB_STATIC, Path), "WEB_STATIC must be Path object"
    assert isinstance(FrontendPaths.WEB_TEMPLATES, Path), "WEB_TEMPLATES must be Path object"
    assert isinstance(FrontendPaths.WEBAPP, Path), "WEBAPP must be Path object"
    assert isinstance(FrontendPaths.SHARED, Path), "SHARED must be Path object"


def test_paths_are_descendants_of_base():
    """Test that all frontend paths are descendants of BASE_DIR"""
    from backend.app.core.paths import FrontendPaths

    base = FrontendPaths.BASE_DIR

    assert FrontendPaths.FRONTEND_ROOT.is_relative_to(base), "FRONTEND_ROOT must be under BASE_DIR"
    assert FrontendPaths.WEB_STATIC.is_relative_to(base), "WEB_STATIC must be under BASE_DIR"
    assert FrontendPaths.WEB_TEMPLATES.is_relative_to(base), "WEB_TEMPLATES must be under BASE_DIR"
    assert FrontendPaths.WEBAPP.is_relative_to(base), "WEBAPP must be under BASE_DIR"
    assert FrontendPaths.SHARED.is_relative_to(base), "SHARED must be under BASE_DIR"
