import requests
import os


API_URL = os.getenv("API_URL")


class Registry:

    def insertOne(row: str = None):
        def _insertOne(row: str):
            requests.post(f"""{API_URL}/registry""", json=row)

        return _insertOne(row)
