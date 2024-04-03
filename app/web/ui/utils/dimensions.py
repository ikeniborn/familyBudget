import requests
import streamlit as st
import os
from pandas import DataFrame


API_URL = os.getenv("API_URL")


class Users:

    def __new__(cls, *args, **kwargs):
        return super().__new__(cls)

    def __init__(self) -> None:
        pass

    def fetchAll(self, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchAll():
            rows = requests.get(f"""{API_URL}/users""").json()
            return DataFrame(data=rows["rows"]).set_index("user_key")

        return _fetchAll()

    def fetchOne(self, key: str = None, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchOne(key):
            rows = requests.get(f"""{API_URL}/users/{key}""").json()
            return DataFrame(data=rows["rows"]).set_index("user_key").loc[key]

        return _fetchOne(key=key)


class FinancialCenters:

    def __new__(cls, *args, **kwargs):
        return super().__new__(cls)

    def __init__(self) -> None:
        pass

    def fetchAll(self, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchAll():
            rows = requests.get(f"""{API_URL}/financial_centers""").json()
            return DataFrame(data=rows["rows"]).set_index("financial_center_key")

        return _fetchAll()

    def fetchOne(self, key: str = None, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchOne(key):
            rows = requests.get(f"""{API_URL}/financial_centers/{key}""").json()
            return DataFrame(data=rows["rows"]).set_index("financial_center_key").loc[key]

        return _fetchOne(key=key)


class Periods:

    def __new__(cls, *args, **kwargs):
        return super().__new__(cls)

    def __init__(self) -> None:
        pass

    def fetchAll(self, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchAll():
            rows = requests.get(f"""{API_URL}/periods""").json()
            return DataFrame(data=rows["rows"]).set_index("period_key")

        return _fetchAll()

    def fetchOne(self, key: str = None, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchOne(key):
            rows = requests.get(f"""{API_URL}/periods/{key}""").json()
            return DataFrame(data=rows["rows"]).set_index("period_key").loc[key]

        return _fetchOne(key=key)


class CostCenter:

    def __new__(cls, *args, **kwargs):
        return super().__new__(cls)

    def __init__(self) -> None:
        pass

    def fetchAll(self, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchAll():
            rows = requests.get(f"""{API_URL}/cost_centers""").json()
            return DataFrame(data=rows["rows"]).set_index("cost_center_key")

        return _fetchAll()

    def fetchOne(self, key: str = None, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchOne(key):
            rows = requests.get(f"""{API_URL}/cost_centers/{key}""").json()
            return DataFrame(data=rows["rows"]).set_index("cost_center_key").loc[key]

        return _fetchOne(key=key)


class Nomenclatures:

    def __new__(cls, *args, **kwargs):
        return super().__new__(cls)

    def __init__(self) -> None:
        pass

    def fetchAll(self, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchAll():
            rows = requests.get(f"""{API_URL}/nomenclatures""").json()
            return DataFrame(data=rows["rows"]).set_index("nomenclature_key")

        return _fetchAll()

    def fetchOne(self, key: str = None, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchOne(key):
            rows = requests.get(f"""{API_URL}/nomenclatures/{key}""").json()
            return DataFrame(data=rows["rows"]).set_index("nomenclature_key").loc[key]

        return _fetchOne(key=key)


class RowTypes:

    def __new__(cls, *args, **kwargs):
        return super().__new__(cls)

    def __init__(self) -> None:
        pass

    def fetchAll(self, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchAll():
            rows = requests.get(f"""{API_URL}/row_types""").json()
            return DataFrame(data=rows["rows"]).set_index("row_type_key")

        return _fetchAll()

    def fetchOne(self, key: str = None, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchOne(key):
            rows = requests.get(f"""{API_URL}/row_types/{key}""").json()
            return DataFrame(data=rows["rows"]).set_index("row_type_key").loc[key]

        return _fetchOne(key=key)
