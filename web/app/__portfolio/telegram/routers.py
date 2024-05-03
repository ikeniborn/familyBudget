import os
import nicegui as ui

from fastapi import APIRouter, Depends, Request, status
from starlette.responses import HTMLResponse, RedirectResponse

from telegram.config import load_config, AppConfig
from telegram.auth.exceptions import TelegramDataError, TelegramDataIsOutdated
from telegram.auth.schemes import TelegramAuth
from telegram.auth.validators import validate_telegram_data
from telegram.auth.widget import Size, TelegramLoginWidget
from starlette.templating import Jinja2Templates

router = APIRouter()

templates = Jinja2Templates(directory=os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates"))


def create_jwt_token():
    # here your code
    "e42e16806918d48eb122fb950030d75e0277ec313e40cdce8a282c200813b3b4929ca7ac8439b313e4c38b3ae4c1131ef7314d6a418e396557555365878e6b54"
    pass


def set_cookies():
    "ikeniborn-060284fd989753149b6939cbd0f1a7c9fe60ea066fd9d19cc6dbc715d08b5d2b"
    pass


@router.get("/", name="index")
async def index(request: Request):
    """
    Index page just redirects to login page.
    """
    return RedirectResponse(url=request.url_for("login"))


@router.get("/main", name="main")
async def form():
    ui.App()


@router.get("/login", name="login")
async def login(request: Request, query_params: TelegramAuth = Depends(TelegramAuth), config: AppConfig = Depends(load_config)):
    """
    Endpoint for authorization through Telegram API.

    If there is no "hash" in the query, it is automatically
    redirected to the 'login' authorization page.

    If a "hash" is received in the query parameters,
    a function is called to validate the received data and, if successful
    it renders a page with information about the authorized user.
    """
    telegram_token = config.bot.telegram_token
    telegram_login = config.bot.telegram_login

    login_widget = TelegramLoginWidget(telegram_login=telegram_login, size=Size.LARGE, user_photo=False, corner_radius=20)

    redirect_url = str(request.url_for("login"))
    redirect_widget = login_widget.redirect_telegram_login_widget(redirect_url=redirect_url)

    if not query_params.model_dump().get("hash"):
        return templates.TemplateResponse(
            "login.html",
            context={
                "request": request,
                "redirect_telegram_login_widget": redirect_widget,
            },
        )

    try:
        validated_data = validate_telegram_data(telegram_token, query_params)

        if validated_data:
            create_jwt_token()
            set_cookies()
            return templates.TemplateResponse("profile.html", context={"request": request, **validated_data})
    except TelegramDataIsOutdated:
        return HTMLResponse("The authentication data is expired.", status_code=status.HTTP_401_UNAUTHORIZED)
    except TelegramDataError:
        return HTMLResponse("The request contains invalid data.", status_code=status.HTTP_400_BAD_REQUEST)
