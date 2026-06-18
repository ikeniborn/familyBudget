"""Medicine bot handlers: open Web App, quick /taken, inline med: callbacks."""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import ContextTypes

from bot.handlers.start import get_webapp_url
from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager

logger = get_logger(__name__)


async def medicine_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/medicines — open the medicines Web App."""
    user = update.effective_user
    if not user:
        return
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "Требуется авторизация.\n\nИспользуйте /start для входа."
        )
        return
    # get_webapp_url() returns e.g. https://DOMAIN/webapp/index.html
    # The medicines SPA is reached by replacing index.html with the medicines page.
    base = get_webapp_url().rsplit("/", 1)[0]  # strip /index.html → https://DOMAIN/webapp
    url = f"{base}/index.html#/medicines"
    kb = InlineKeyboardMarkup([[
        InlineKeyboardButton("Открыть аптечку", web_app=WebAppInfo(url=url))
    ]])
    await update.message.reply_text("Открыть управление лекарствами:", reply_markup=kb)


async def taken_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/taken — mark the nearest scheduled intake today as taken."""
    user = update.effective_user
    if not user or not SessionManager.is_authenticated(context):
        await update.message.reply_text("Требуется авторизация. /start")
        return
    token = SessionManager.get_access_token(context)
    api = await get_api_client()
    try:
        data = await api.get("/api/v1/medicine-intakes", token=token, params={"date": "today"})
    except Exception as e:
        logger.error("taken_handler: failed to list intakes: %s", e)
        await update.message.reply_text("Не удалось загрузить список приёмов. Попробуйте позже.")
        return
    pending = [i for i in data.get("intakes", []) if i["status"] in ("scheduled", "late")]
    if not pending:
        await update.message.reply_text("Нет запланированных приёмов на сегодня")
        return
    nearest = pending[0]
    try:
        await api.post(
            f"/api/v1/medicine-intakes/{nearest['id']}/take",
            token=token,
            json={"version": nearest["version"]},
        )
    except Exception as e:
        logger.error("taken_handler: mark intake %s failed: %s", nearest["id"], e)
        await update.message.reply_text(
            "Не удалось отметить приём. Откройте приложение: /medicines"
        )
        return
    scheduled = nearest.get("scheduled_at", "")
    time_part = scheduled[11:16] if len(scheduled) >= 16 else ""
    name = nearest.get("medicine_name", "")
    suffix = f" ({time_part})" if time_part else ""
    await update.message.reply_text(f"Отмечено: {name}{suffix}")


async def medicine_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle med:take/skip/snooze:{log_id} inline buttons."""
    query = update.callback_query
    await query.answer()
    if not SessionManager.is_authenticated(context):
        await query.edit_message_text("Сессия истекла. /start")
        return
    try:
        _, action, log_id_str = query.data.split(":", 2)
        log_id = int(log_id_str)
    except (ValueError, IndexError):
        logger.warning("medicine_callback: bad callback data: %s", query.data)
        return
    token = SessionManager.get_access_token(context)
    api = await get_api_client()
    try:
        if action == "snooze":
            await api.post(f"/api/v1/medicine-intakes/{log_id}/snooze", token=token, json={})
            await query.edit_message_text("Отложено")
            return
        intake = await api.get(f"/api/v1/medicine-intakes/{log_id}", token=token)
        await api.post(
            f"/api/v1/medicine-intakes/{log_id}/{action}",
            token=token,
            json={"version": intake["version"]},
        )
        await query.edit_message_text("Принято" if action == "take" else "Пропущено")
    except Exception as e:
        logger.error("medicine_callback %s failed: %s", query.data, e)
        await query.edit_message_text(
            "Не удалось обработать. Откройте приложение: /medicines"
        )
