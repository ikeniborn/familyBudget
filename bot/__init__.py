"""
Family Budget - Telegram Bot Module
Placeholder for Phase 2 implementation
"""


import warnings

# Suppress PTBUserWarning for per_message=False with CallbackQueryHandler
# This must be set at package import time, BEFORE ConversationHandlers are created
warnings.filterwarnings("ignore", message=".*per_message.*CallbackQueryHandler.*", category=UserWarning)
__version__ = "0.1.0"
__status__ = "Placeholder - Phase 2"

# Bot implementation will be added in Phase 2
# This file maintains the bot/ directory structure for deployment
