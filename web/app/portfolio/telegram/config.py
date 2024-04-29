import os
from dataclasses import dataclass


@dataclass
class BotConfig:
    telegram_token: str
    telegram_login: str


@dataclass
class AppConfig:
    bot: BotConfig


def load_config() -> AppConfig:
    """
    Main configuration.
    """
    return AppConfig(
        bot=BotConfig(
            telegram_token=os.environ.get('TELEGRAM_TOKEN'),
            telegram_login=os.environ.get('TELEGRAM_LOGIN'),
            # telegram_token="06168491:AAE5G1oPobTtfArA0vMOH88S9bqi1EfSrjs",
            # telegram_login="@IkeniGoogleBot",
        ),
    )
