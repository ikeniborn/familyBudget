import streamlit as st
from utils.functions import Functions
from utils.api import Periods, Registry, Report
import pytz
from datetime import datetime
import plotly.express as px
import polars as pl
from polars import DataFrame


class Forms:

    def __new__(cls, *args, **kwargs):
        return super().__new__(cls)

    def __init__(self) -> None:
        pass

    class Budget:

        def __init__(
            self,
            financial_centers: DataFrame = None,
            cost_centers: DataFrame = None,
            row_types: DataFrame = None,
            nomenclatures: DataFrame = None,
        ) -> None:
            self._financial_centers = financial_centers
            self._cost_centers = cost_centers
            self._row_types = row_types
            self._nomenclatures = nomenclatures

        @st.fragment
        def form(self):


            st.info("Поля с * обязательные для заполнения!")

            start_dttm = datetime.now(tz=pytz.timezone("Europe/Moscow"))

            col1, col2 = st.columns(2)

            with col1:
                dt = st.date_input(label="Дата операции", value=start_dttm, format="YYYY-MM-DD", key="budget_date_input")
            with col2:
                tm = st.time_input(label="Время операции", value=start_dttm, step=60, key="budget_time_input")

            operation_dttm = datetime(
                year=dt.year, month=dt.month, day=dt.day, hour=tm.hour, minute=tm.minute, second=0, microsecond=0
            ).strftime("%Y-%m-%d %H:%M:%S.%f")

            st.selectbox(
                "Период",
                options=t_d_period.lazy().select("period_ru_name").collect()["period_ru_name"].to_list(),
                index=1,
                key="budget_period_ru_name",
            )

            financial_center_name = st.selectbox(
                label="ЦФО*",
                options=t_d_financial_center.lazy().select("financial_center_name").collect()["financial_center_name"].to_list(),
                index=0,
                key="budget_financial_center_name",
            )

            cost_center_name = financial_center_name

            with st.popover("Выбор номенлатуры", use_container_width=True):

                col3, col4 = st.columns(2)

                with col3:
                    st.radio(
                        "Операция",
                        key="budget_operation_name",
                        options=t_d_nomenclature.lazy()
                        .filter(pl.col("is_budget") == True)
                        .select("operation_name")
                        .group_by("operation_name", maintain_order=True)
                        .n_unique()
                        .collect()["operation_name"]
                        .to_list(),
                        horizontal=False,
                        index=None,
                    )

                with col4:
                    st.radio(
                        "Счет",
                        key="budget_bill_name",
                        options=t_d_nomenclature.lazy()
                        .filter(
                            (pl.col("is_budget") == True) & (pl.col("operation_name") == st.session_state.budget_operation_name)
                        )
                        .select("bill_name")
                        .group_by("bill_name", maintain_order=True)
                        .n_unique()
                        .collect()["bill_name"]
                        .to_list(),
                        horizontal=False,
                        index=None,
                    )

                col5, col6 = st.columns(2)

                with col5:
                    st.radio(
                        label="Статья",
                        key="budget_account_name",
                        options=t_d_nomenclature.lazy()
                        .filter(
                            (pl.col("is_budget") == True)
                            & (pl.col("operation_name") == st.session_state.budget_operation_name)
                            & (pl.col("bill_name") == st.session_state.budget_bill_name)
                        )
                        .select("account_name")
                        .group_by("account_name", maintain_order=True)
                        .n_unique()
                        .collect()["account_name"]
                        .to_list(),
                        index=None,
                    )
                with col6:
                    st.radio(
                        label="Номенклатура*",
                        key="budget_nomenclature_name",
                        options=t_d_nomenclature.lazy()
                        .filter(
                            (pl.col("is_budget") == True)
                            & (pl.col("operation_name") == st.session_state.budget_operation_name)
                            & (pl.col("bill_name") == st.session_state.budget_bill_name)
                            & (pl.col("account_name") == st.session_state.budget_account_name)
                        )
                        .select("nomenclature_name")
                        .group_by("nomenclature_name", maintain_order=True)
                        .n_unique()
                        .collect()["nomenclature_name"]
                        .to_list(),
                        index=None,
                    )

            if st.session_state.budget_account_name and st.session_state.budget_nomenclature_name:
                st.info(f"Статья: {st.session_state.budget_account_name}, Номенлатура: {st.session_state.budget_nomenclature_name}")

            with st.form("budget_data", clear_on_submit=True):

                st.number_input(label="Сумма*", min_value=0, value=0, key="budget_cost_sum")
                st.text_area(label="Комментарий", key="budget_comment_description")

                add_row = st.form_submit_button(label="Сохранить", type="primary")

                if add_row:
                    if (
                        st.session_state.budget_cost_sum > 0
                        and st.session_state.budget_financial_center_name != None
                        and st.session_state.budget_nomenclature_name != None
                    ):
                        registry_key = Functions.get_random_uuid()

                        period_key = (
                            t_d_period.lazy()
                            .select("period_key", "period_ru_name")
                            .filter(pl.col("period_ru_name") == st.session_state.budget_period_ru_name)
                            .collect()["period_key"][0]
                        )

                        financial_center_key = (
                            t_d_financial_center.lazy()
                            .select("financial_center_key", "financial_center_name")
                            .filter(pl.col("financial_center_name") == st.session_state.budget_financial_center_name)
                            .collect()["financial_center_key"][0]
                        )
                        cost_center_key = (
                            t_d_cost_center.lazy()
                            .select("cost_center_key", "cost_center_name")
                            .filter(pl.col("cost_center_name") == cost_center_name)
                            .collect()["cost_center_key"][0]
                        )

                        nomenclature_key = (
                            t_d_nomenclature.lazy()
                            .select("nomenclature_key", "nomenclature_name")
                            .filter(pl.col("nomenclature_name") == st.session_state.budget_nomenclature_name)
                            .collect()["nomenclature_key"][0]
                        )

                        row_type_key = (
                            t_d_row_type.lazy()
                            .select("row_type_key", "row_type_name")
                            .filter(pl.col("row_type_name") == row_type_name)
                            .collect()["row_type_key"][0]
                        )

                        row = {
                            "registry_key": registry_key,
                            "operation_dttm": operation_dttm,
                            "period_key": period_key,
                            "financial_center_key": financial_center_key,
                            "cost_center_key": cost_center_key,
                            "nomenclature_key": nomenclature_key,
                            "cost_sum": st.session_state.budget_cost_sum,
                            "comment_description": st.session_state.budget_comment_description,
                            "row_type_key": row_type_key,
                            "user_key": st.session_state.user_key,
                        }
                        Registry.insertOne(row=row)
                        st.info("Последние пять записей:")
                        st.dataframe(
                            data=Registry.getLastRows(row_type_key=row_type_key, limit_rows=5),
                            hide_index=True,
                            use_container_width=True,
                        )
                    else:
                        if st.session_state.budget_financial_center_name == None:
                            st.error("Не указан ЦФО")
                        if st.session_state.budget_nomenclature_name == None:
                            st.error("Не указана Номенклатура")
                        if st.session_state.budget_cost_sum == 0:
                            st.error("Не указана Сумма")
