import secrets
import uuid
import hashlib
import datetime


class Functions:

    def __new__(cls, *args, **kwargs):
        return super().__new__(cls)

    def __init__(self) -> None:
        pass

    def get_uuid(self, string: str = "-1"):
        hex_string = hashlib.md5(string.encode("UTF-8").lower()).hexdigest()
        return uuid.UUID(hex=hex_string)

    def get_random_uuid(self):
        hex_string = secrets.token_hex(16)
        return uuid.UUID(hex=hex_string)

    def get_period(self, shuffle: int = 0) -> str:
        dttm = datetime.datetime.now()
        month = dttm.month
        year = dttm.year
        dt = datetime.date(year=year, month=month + shuffle, day=1)
        return dt
