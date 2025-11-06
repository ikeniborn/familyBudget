"""
Centralized frontend paths configuration.

Provides a single source of truth for all frontend directory paths,
reducing hardcoded path references across the codebase.
"""

from pathlib import Path


class FrontendPaths:
    """
    Centralized configuration for frontend directory paths.

    All paths are pathlib.Path objects for cross-platform compatibility.
    Paths are resolved relative to the backend module location.

    Usage:
        from backend.app.core.paths import FrontendPaths

        static_dir = FrontendPaths.WEB_STATIC
        templates_dir = FrontendPaths.WEB_TEMPLATES
    """

    # Base directory (project root)
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent

    # Frontend root
    FRONTEND_ROOT: Path = BASE_DIR / "frontend"

    # Web UI paths (desktop interface)
    WEB_STATIC: Path = FRONTEND_ROOT / "web" / "static"
    WEB_TEMPLATES: Path = FRONTEND_ROOT / "web" / "templates"

    # Telegram Web Apps paths (mobile interface)
    WEBAPP: Path = FRONTEND_ROOT / "webapp"

    # Shared modules paths (DRY principle)
    SHARED: Path = FRONTEND_ROOT / "shared"

    @classmethod
    def validate(cls) -> bool:
        """
        Validate that all frontend paths exist.

        Returns:
            bool: True if all paths exist, False otherwise

        Raises:
            FileNotFoundError: If any required path is missing
        """
        required_paths = [
            cls.FRONTEND_ROOT,
            cls.WEB_STATIC,
            cls.WEB_TEMPLATES,
            cls.WEBAPP,
            cls.SHARED,
        ]

        missing_paths = [p for p in required_paths if not p.exists()]

        if missing_paths:
            missing_str = "\n  ".join(str(p) for p in missing_paths)
            raise FileNotFoundError(
                f"Missing frontend paths:\n  {missing_str}\n\n"
                "Did you forget to run 'git mv web frontend/web'?"
            )

        return True
