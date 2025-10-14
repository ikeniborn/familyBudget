"""
Telegram bot application initialization.

Initializes the bot application with handlers, middleware, and error handling.
"""

from typing import Optional

from telegram import Update
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
)

from bot.config.settings import get_settings
from bot.utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


class BotApplication:
    """
    Telegram bot application wrapper.

    Manages bot initialization, handlers, and lifecycle.
    """

    def __init__(self):
        """Initialize bot application."""
        self.application: Optional[Application] = None
        self.settings = settings
        logger.info("BotApplication initialized")

    def build_application(self) -> Application:
        """
        Build and configure bot application.

        Returns:
            Application: Configured Telegram Application instance

        Raises:
            ValueError: If TELEGRAM_BOT_TOKEN is not configured
        """
        # Validate settings
        self.settings.validate()

        # Build application
        builder = ApplicationBuilder().token(self.settings.TELEGRAM_BOT_TOKEN)

        # Configure application settings
        if self.settings.USE_WEBHOOK:
            logger.info("Bot configured for webhook mode")
        else:
            logger.info("Bot configured for polling mode")

        self.application = builder.build()

        # Register error handler
        self.application.add_error_handler(self.error_handler)

        # Register command handlers
        self.register_handlers()

        logger.info("Bot application built successfully")
        return self.application

    def register_handlers(self):
        """Register bot command and message handlers."""
        if not self.application:
            raise RuntimeError("Application not built. Call build_application() first.")

        # Import handlers
        from bot.handlers.start import start_handler
        from bot.handlers.add import add_conversation_handler
        from bot.handlers.today import today_handler
        from bot.handlers.stats import stats_handler
        from bot.handlers.help import help_handler
        from bot.handlers.settings import settings_conversation_handler
        from bot.handlers.export import export_handler
        from bot.handlers.list import list_conversation_handler
        from bot.handlers.delete import delete_conversation_handler
        from bot.handlers.search import search_conversation_handler
        from bot.handlers.edit import edit_conversation_handler

        # Register command handlers
        self.application.add_handler(CommandHandler("start", start_handler))
        logger.info("Registered /start handler")

        self.application.add_handler(CommandHandler("help", help_handler))
        logger.info("Registered /help handler")

        self.application.add_handler(CommandHandler("today", today_handler))
        logger.info("Registered /today handler")

        self.application.add_handler(CommandHandler("stats", stats_handler))
        logger.info("Registered /stats handler")

        self.application.add_handler(CommandHandler("export", export_handler))
        logger.info("Registered /export handler")

        # Register conversation handlers
        self.application.add_handler(add_conversation_handler)
        logger.info("Registered /add conversation handler")

        self.application.add_handler(settings_conversation_handler)
        logger.info("Registered /settings conversation handler")

        self.application.add_handler(list_conversation_handler)
        logger.info("Registered /list conversation handler")

        self.application.add_handler(delete_conversation_handler)
        logger.info("Registered /delete conversation handler")

        self.application.add_handler(search_conversation_handler)
        logger.info("Registered /search conversation handler")

        self.application.add_handler(edit_conversation_handler)
        logger.info("Registered /edit conversation handler")

        logger.info("All handlers registered")

    async def error_handler(self, update: Optional[Update], context: ContextTypes.DEFAULT_TYPE):
        """
        Handle errors that occur during update processing.

        Args:
            update: Telegram update that caused the error
            context: Callback context containing error information
        """
        logger.error(f"Exception while handling an update: {context.error}", exc_info=context.error)

        # Log update details for debugging
        if update:
            logger.error(f"Update: {update}")

    async def start(self):
        """
        Start the bot application.

        Uses polling or webhook based on configuration.
        """
        if not self.application:
            self.build_application()

        # Initialize application
        await self.application.initialize()
        logger.info("Bot initialized")

        # Start application
        if self.settings.USE_WEBHOOK:
            await self.start_webhook()
        else:
            await self.start_polling()

    async def start_polling(self):
        """Start bot with long polling."""
        logger.info("Starting bot with polling...")

        # Start polling
        await self.application.start()
        await self.application.updater.start_polling(
            poll_interval=self.settings.POLL_INTERVAL,
            timeout=self.settings.POLL_TIMEOUT,
            drop_pending_updates=True
        )

        logger.info("Bot started (polling mode)")

    async def start_webhook(self):
        """Start bot with webhook."""
        if not self.settings.WEBHOOK_URL:
            raise ValueError("WEBHOOK_URL must be set for webhook mode")

        logger.info(f"Starting bot with webhook: {self.settings.WEBHOOK_URL}")

        # Start webhook
        await self.application.start()
        await self.application.updater.start_webhook(
            listen=self.settings.WEBHOOK_LISTEN,
            port=self.settings.WEBHOOK_PORT,
            url_path=f"/{self.settings.TELEGRAM_BOT_TOKEN}",
            webhook_url=f"{self.settings.WEBHOOK_URL}/{self.settings.TELEGRAM_BOT_TOKEN}"
        )

        logger.info(f"Bot started (webhook mode on port {self.settings.WEBHOOK_PORT})")

    async def stop(self):
        """Stop the bot application gracefully."""
        if not self.application:
            logger.warning("Application not started, nothing to stop")
            return

        logger.info("Stopping bot...")

        # Stop updater
        if self.application.updater:
            await self.application.updater.stop()

        # Stop application
        await self.application.stop()

        # Shutdown application
        await self.application.shutdown()

        logger.info("Bot stopped")

    def run(self):
        """
        Run the bot application (blocking).

        This is a convenience method that starts the bot and blocks until shutdown.
        """
        if not self.application:
            self.build_application()

        logger.info("Running bot application...")

        # Run polling (this blocks until stopped)
        self.application.run_polling(
            poll_interval=self.settings.POLL_INTERVAL,
            timeout=self.settings.POLL_TIMEOUT,
            drop_pending_updates=True
        )


# Global bot application instance
bot_app = BotApplication()


def get_bot_app() -> BotApplication:
    """
    Get bot application instance.

    Returns:
        BotApplication: Bot application instance
    """
    return bot_app
