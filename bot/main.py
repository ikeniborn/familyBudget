"""
Telegram bot entry point.

Starts the Telegram bot application.
"""

import asyncio
import signal
import sys
import warnings

# Suppress PTBUserWarning for per_message=False with CallbackQueryHandler
# This must be set BEFORE importing bot modules that create ConversationHandlers
warnings.filterwarnings("ignore", message=".*per_message.*CallbackQueryHandler.*", category=UserWarning)

from bot.bot import get_bot_app
from bot.config.settings import get_settings
from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


async def shutdown(bot_app):
    """
    Graceful shutdown handler.

    Args:
        bot_app: Bot application instance
    """
    logger.info("Received shutdown signal, cleaning up...")

    # Stop bot
    await bot_app.stop()

    # Close API client
    api_client = await get_api_client()
    await api_client.close()

    logger.info("Shutdown complete")


async def main():
    """
    Main entry point for the bot.

    Initializes and runs the bot application.
    """
    try:
        # Validate configuration
        logger.info("Starting Telegram Bot...")
        settings.validate()
        logger.info("Configuration validated")

        # Get bot application
        bot_app = get_bot_app()

        # Setup signal handlers for graceful shutdown
        loop = asyncio.get_running_loop()

        def signal_handler(sig):
            logger.info(f"Received signal {sig}, initiating shutdown...")
            asyncio.create_task(shutdown(bot_app))

        # Register signal handlers (Unix only)
        if sys.platform != "win32":
            for sig in (signal.SIGTERM, signal.SIGINT):
                loop.add_signal_handler(sig, lambda s=sig: signal_handler(s))

        # Start bot
        await bot_app.start()

        # Keep bot running
        logger.info("Bot is running. Press Ctrl+C to stop.")

        # Wait indefinitely (until shutdown signal)
        await asyncio.Event().wait()

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)

    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
        bot_app = get_bot_app()
        await shutdown(bot_app)

    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)


def run():
    """
    Run the bot using asyncio.

    This is the synchronous entry point that starts the async main loop.
    """
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    run()
