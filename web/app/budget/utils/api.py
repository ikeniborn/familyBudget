import requests
import streamlit as st
import os
import polars as pl
from polars import DataFrame


API_URL = os.getenv("API_URL")


class Users:

    def fetchAll(self, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchAll():
            rows = requests.get(f"""{API_URL}/users""").json()
            return DataFrame(data=rows)

        return _fetchAll()

    def fetchOne(self, key: str = None, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchOne(key):
            rows = requests.get(f"""{API_URL}/users/{key}""").json()
            return DataFrame(data=rows).filter(pl.col("user_id") == key)

        return _fetchOne(key=key)


class FinancialCenters:

    def fetchAll(self, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchAll():
            rows = requests.get(f"""{API_URL}/financial_centers""").json()
            return DataFrame(data=rows)

        return _fetchAll()

    def fetchOne(self, key: str = None, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchOne(key):
            rows = requests.get(f"""{API_URL}/financial_centers/{key}""").json()
            return DataFrame(data=rows).filter(pl.col("financial_center_id") == key)

        return _fetchOne(key=key)


class Periods:

    def fetchAll(self, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchAll():
            rows = requests.get(f"""{API_URL}/periods""").json()
            return DataFrame(data=rows)

        return _fetchAll()

    def fetchOne(self, key: str = None, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchOne(key):
            rows = requests.get(f"""{API_URL}/periods/{key}""").json()
            return DataFrame(data=rows).filter(pl.col("period_id") == key)

        return _fetchOne(key=key)

    def fetchMany(self, start_date: str = None, end_date: str = None, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchOne(start_date, end_date):
            rows = requests.get(f"""{API_URL}/periods?start_date={start_date}&end_date={end_date}""").json()
            return DataFrame(data=rows)

        return _fetchOne(start_date=start_date, end_date=end_date)


class CostCenter:

    def fetchAll(self, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchAll():
            rows = requests.get(f"""{API_URL}/cost_centers""").json()
            return DataFrame(data=rows)

        return _fetchAll()

    def fetchOne(self, key: str = None, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchOne(key):
            rows = requests.get(f"""{API_URL}/cost_centers/{key}""").json()
            return DataFrame(data=rows).filter(pl.col("cost_center_id") == key)

        return _fetchOne(key=key)


class Nomenclatures:

    def fetchAll(self, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchAll():
            rows = requests.get(f"""{API_URL}/nomenclatures""").json()
            return DataFrame(data=rows)

        return _fetchAll()

    def fetchOne(self, key: str = None, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchOne(key):
            rows = requests.get(f"""{API_URL}/nomenclatures/{key}""").json()
            return DataFrame(data=rows).filter(pl.col("nomenclature_id") == key)

        return _fetchOne(key=key)


class RowTypes:

    def fetchAll(self, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchAll():
            rows = requests.get(f"""{API_URL}/row_types""").json()
            return DataFrame(data=rows)

        return _fetchAll()

    def fetchOne(self, key: str = None, ttl=None) -> DataFrame:
        @st.cache_data(ttl=ttl)
        def _fetchOne(key):
            rows = requests.get(f"""{API_URL}/row_types/{key}""").json()
            return DataFrame(data=rows).filter(pl.col("row_type_id") == key)

        return _fetchOne(key=key)


class Registry:

    def insertOne(row: str = None):
        requests.post(f"""{API_URL}/registry""", json=row)

    def getLastRows(row_type_id: str = None, limit_rows: int = 5) -> DataFrame:
        rows = requests.get(f"""{API_URL}/registry/last_row?row_type_id={row_type_id}&limit_rows={limit_rows}""").json()
        return DataFrame(data=rows)


class Report:

    def getReportCompareRowTypeNomenclature(financial_center_id: str = None, period_id: str = None) -> DataFrame:
        rows = requests.get(f"""{API_URL}/report/compare/row_type_nomenclature?financial_center_id={financial_center_id}&period_id={period_id}""").json()
        return DataFrame(data=rows)

    def getReportCompareRowTypeOperation(financial_center_id: str = None, period_id: str = None) -> DataFrame:
        rows = requests.get(f"""{API_URL}/report/compare/row_type_operation?financial_center_id={financial_center_id}&period_id={period_id}""").json()
        return DataFrame(data=rows)

    def getReportCompareRowTypeBill(financial_center_id: str = None, period_id: str = None) -> DataFrame:
        rows = requests.get(f"""{API_URL}/report/compare/row_type_bill?financial_center_id={financial_center_id}&period_id={period_id}""").json()
        return DataFrame(data=rows)

    def getReportCompareRowTypeAccount(financial_center_id: str = None, period_id: str = None) -> DataFrame:
        rows = requests.get(f"""{API_URL}/report/compare/row_type_account?financial_center_id={financial_center_id}&period_id={period_id}""").json()
        return DataFrame(data=rows)

    def getReportBudgetTotal(financial_center_id: str = None, period_id: str = None) -> DataFrame:
        rows = requests.get(f"""{API_URL}/report/budget/total?financial_center_id={financial_center_id}&period_id={period_id}""").json()
        return DataFrame(data=rows)

    def getReportBudgetBillAccount(financial_center_id: str = None, period_id: str = None) -> DataFrame:
        rows = requests.get(f"""{API_URL}/report/budget/bill_account?financial_center_id={financial_center_id}&period_id={period_id}""").json()
        return DataFrame(data=rows)

    def getReportBudgetRowTypeNomenclature(financial_center_id: str = None, period_id: str = None, nomenclature_id: str = None) -> DataFrame:
        rows = requests.get(
            f"""{API_URL}/report/budget/row_type_nomenclature?financial_center_id={financial_center_id}&period_id={period_id}&nomenclature_id={nomenclature_id}"""
        ).json()
        return DataFrame(data=rows)

    def getReportPerfomancetRowTypeNomenclature(financial_center_id: str = None, period_id: str = None, nomenclature_id: str = None) -> DataFrame:
        rows = requests.get(
            f"""{API_URL}/report/perfomance/row_type_nomenclature?financial_center_id={financial_center_id}&period_id={period_id}&nomenclature_id={nomenclature_id}"""
        ).json()
        return DataFrame(data=rows)
