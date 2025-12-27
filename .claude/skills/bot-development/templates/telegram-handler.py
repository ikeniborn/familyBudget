"""
Telegram Bot Handler Template
"""

from telegram import Update
from telegram.ext import ContextTypes

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    await update.message.reply_text(
        "Привет! Я бот для управления бюджетом."
    )
