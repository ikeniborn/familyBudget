"""
Telegram bot application initialization.

Initializes the bot application with handlers, middleware, and error handling.
"""

from typing import Optional

from telegram import MenuButtonWebApp, Update, WebAppInfo
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CallbackQueryHandler,
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
        self.scheduler = None  # Will be initialized when bot starts
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

        # Configure proxy if set
        if self.settings.TELEGRAM_PROXY_URL:
            proxy_url = self.settings.TELEGRAM_PROXY_URL
            if proxy_url.startswith("tg://"):
                # tg://proxy?server=...&port=...&secret=... is Telegram client format — NOT supported
                # by python-telegram-bot v21 (httpx backend). Use http://, https://, or socks5:// instead.
                logger.error(
                    "TELEGRAM_PROXY_URL uses unsupported tg:// MTProxy format. "
                    "Use http://, https://, or socks5://host:port instead. Proxy NOT applied."
                )
            else:
                builder = builder.proxy(proxy_url).get_updates_proxy(proxy_url)
                logger.info(f"Telegram proxy configured: {proxy_url}")

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
        from bot.handlers.start import start_handler, menu_callback_handler
        from bot.handlers.add_plan import addplan_conversation_handler
        from bot.handlers.today import today_handler
        from bot.handlers.summary import summary_conversation_handler
        from bot.handlers.help import help_handler
        from bot.handlers.settings import settings_conversation_handler
        from bot.handlers.export import export_handler
        from bot.handlers.list import list_conversation_handler
        from bot.handlers.delete import delete_conversation_handler
        from bot.handlers.search import search_conversation_handler
        from bot.handlers.edit import edit_conversation_handler
        from bot.handlers.balance import balance_handler

        # Register command handlers
        self.application.add_handler(CommandHandler("start", start_handler))
        logger.info("Registered /start handler")

        # Register callback query handler for main menu buttons
        self.application.add_handler(CallbackQueryHandler(menu_callback_handler, pattern="^menu:"))
        logger.info("Registered menu callback handler")

        self.application.add_handler(CommandHandler("help", help_handler))
        logger.info("Registered /help handler")

        self.application.add_handler(CommandHandler("today", today_handler))
        logger.info("Registered /today handler")

        self.application.add_handler(CommandHandler("export", export_handler))
        logger.info("Registered /export handler")

        self.application.add_handler(CommandHandler("balance", balance_handler))
        logger.info("Registered /balance handler")

        from bot.handlers.medicine import medicine_handler, taken_handler, medicine_callback

        self.application.add_handler(CommandHandler("medicines", medicine_handler))
        logger.info("Registered /medicines handler")
        self.application.add_handler(CommandHandler("taken", taken_handler))
        logger.info("Registered /taken handler")
        self.application.add_handler(CallbackQueryHandler(medicine_callback, pattern="^med:"))
        logger.info("Registered medicine callback handler")

        # Register conversation handlers
        self.application.add_handler(addplan_conversation_handler)
        logger.info("Registered /addplan conversation handler")

        self.application.add_handler(summary_conversation_handler)
        logger.info("Registered /summary conversation handler")

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

        # Log sanitized update details for debugging (exclude PII/sensitive data)
        if update:
            # Only log non-sensitive identifiers, not full message content or user data
            sanitized_info = {
                "update_id": update.update_id,
                "chat_id": update.effective_chat.id if update.effective_chat else None,
                "user_id": update.effective_user.id if update.effective_user else None,
                "message_type": type(update.effective_message).__name__ if update.effective_message else None,
            }
            logger.error(f"Update context: {sanitized_info}")

    async def setup_menu_button(self):
        """
        Setup Telegram Menu Button for Web Apps access.

        Configures the bot's menu button to open the Web App interface.
        This replaces the traditional bot commands with a modern Web App UI.
        """
        if not self.application:
            raise RuntimeError("Application not built. Call build_application() first.")

        try:
            # Build Web App URL using DOMAIN (public URL accessible from Telegram)
            # IMPORTANT: Cannot use BACKEND_API_URL as it's internal Docker network name
            # Example: https://budget-dev.ikeniborn.ru/webapp/index.html
            protocol = "https" if self.settings.DOMAIN != "localhost" else "http"
            port_suffix = ":8000" if self.settings.DOMAIN == "localhost" else ""
            webapp_url = f"{protocol}://{self.settings.DOMAIN}{port_suffix}/webapp/index.html"

            # Create Web App info
            web_app_info = WebAppInfo(url=webapp_url)

            # Create Menu Button
            menu_button = MenuButtonWebApp(
                text="Start",
                web_app=web_app_info
            )

            # Set Menu Button for all users
            await self.application.bot.set_chat_menu_button(menu_button=menu_button)

            logger.info(f"Menu Button configured successfully: {webapp_url}")

        except Exception as e:
            logger.error(f"Failed to setup Menu Button: {e}")
            # Don't raise - this is not critical for bot operation
            # Bot can still work with commands even if Menu Button setup fails

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

        # Setup Menu Button for Web Apps
        await self.setup_menu_button()

        # Initialize and start scheduler
        from bot.utils.scheduler import init_scheduler
        self.scheduler = init_scheduler(self.application.bot)
        self.scheduler.start()
        logger.info("Scheduler started")

        # Initialize notification service
        from bot.utils.notification_service import init_notification_service
        from bot.utils.api_client import get_api_client
        api_client = await get_api_client()
        init_notification_service(self.application.bot, api_client)
        logger.info("Notification service initialized")

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

        # Stop scheduler
        if self.scheduler:
            self.scheduler.shutdown(wait=True)
            logger.info("Scheduler stopped")

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
