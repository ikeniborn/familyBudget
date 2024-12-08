import secrets
import uuid
import hashlib
from datetime import datetime
from dateutil.relativedelta import relativedelta
import pytz


class Functions:

    # def __new__(cls, *args, **kwargs):
    #     return super().__new__(cls)

    # def __init__(self) -> None:
    #     pass

    def get_uuid(string: str = "-1"):
        hex_string = hashlib.md5(string.encode("UTF-8").lower()).hexdigest()
        return uuid.UUID(hex=hex_string)

    def get_random_uuid():
        hex_string = secrets.token_hex(16)
        # return uuid.UUID(hex=hex_string)
        return hex_string

    def get_period(shuffle: int = 0) -> str:
        shuffle_dttm = datetime.now(tz=pytz.timezone("Europe/Moscow")) + relativedelta(months=shuffle)
        return shuffle_dttm.strftime("%Y-%m-%d")
