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

            t_d_period = Periods().fetchMany(start_date=Functions.get_period(shuffle=0), end_date=Functions.get_period(shuffle=1), ttl=60)
            t_d_financial_center = self._financial_centers
            t_d_cost_center = self._cost_centers
            t_d_row_type = self._row_types
            t_d_nomenclature = self._nomenclatures

            st.info("Поля с * обязательные для заполнения!")

            row_type_name = "Бюджет"

            start_dttm = datetime.now(tz=pytz.timezone("Europe/Moscow"))

            col1, col2 = st.columns(2)

            with col1:
                dt = st.date_input(label="Дата операции", value=start_dttm, format="YYYY-MM-DD", key="budget_date_input")
            with col2:
                tm = st.time_input(label="Время операции", value=start_dttm, step=60, key="budget_time_input")

            operation_dttm = datetime(year=dt.year, month=dt.month, day=dt.day, hour=tm.hour, minute=tm.minute, second=0, microsecond=0).strftime("%Y-%m-%d %H:%M:%S.%f")

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
                        .filter((pl.col("is_budget") == True) & (pl.col("operation_name") == st.session_state.budget_operation_name))
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

                _budget_cost_sum = st.number_input(label="Сумма*", min_value=0, value=0, key="budget_cost_sum")
                _budget_comment_description = st.text_area(label="Комментарий", key="budget_comment_description")

                add_row = st.form_submit_button(label="Сохранить", type="primary")

                if add_row:
                    if _budget_cost_sum > 0 and st.session_state.budget_financial_center_name != None and st.session_state.budget_nomenclature_name != None:

                        period_id = (
                            t_d_period.lazy()
                            .select("period_id", "period_ru_name")
                            .filter(pl.col("period_ru_name") == st.session_state.budget_period_ru_name)
                            .collect()["period_id"][0]
                        )

                        financial_center_id = (
                            t_d_financial_center.lazy()
                            .select("financial_center_id", "financial_center_name")
                            .filter(pl.col("financial_center_name") == st.session_state.budget_financial_center_name)
                            .collect()["financial_center_id"][0]
                        )
                        cost_center_id = (
                            t_d_cost_center.lazy()
                            .select("cost_center_id", "cost_center_name")
                            .filter(pl.col("cost_center_name") == cost_center_name)
                            .collect()["cost_center_id"][0]
                        )

                        nomenclature_id = (
                            t_d_nomenclature.lazy()
                            .select("nomenclature_id", "nomenclature_name")
                            .filter(pl.col("nomenclature_name") == st.session_state.budget_nomenclature_name)
                            .collect()["nomenclature_id"][0]
                        )

                        row_type_id = t_d_row_type.lazy().select("row_type_id", "row_type_name").filter(pl.col("row_type_name") == row_type_name).collect()["row_type_id"][0]

                        row = {
                            "operation_dttm": operation_dttm,
                            "period_id": period_id,
                            "financial_center_id": financial_center_id,
                            "cost_center_id": cost_center_id,
                            "nomenclature_id": nomenclature_id,
                            "cost_sum": _budget_cost_sum,
                            "comment_description": _budget_comment_description,
                            "row_type_id": row_type_id,
                            "user_id": st.session_state.user_id,
                        }
                        Registry.insertOne(row=row)
                        st.info("Последние пять записей:")
                        st.dataframe(
                            data=Registry.getLastRows(row_type_id=row_type_id, limit_rows=5),
                            hide_index=True,
                            use_container_width=True,
                        )
                    else:
                        if st.session_state.budget_financial_center_name == None:
                            st.error("Не указан ЦФО")
                        if st.session_state.budget_nomenclature_name == None:
                            st.error("Не указана Номенклатура")
                        if _budget_cost_sum == 0:
                            st.error("Не указана Сумма")

    class Fact:

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

            t_d_period = Periods().fetchMany(start_date=Functions.get_period(shuffle=-1), end_date=Functions.get_period(shuffle=0), ttl=60)
            t_d_financial_center = self._financial_centers
            t_d_cost_center = self._cost_centers
            t_d_row_type = self._row_types
            t_d_nomenclature = self._nomenclatures

            st.info("Поля с * обязательные для заполнения!")

            row_type_name = "Факт"

            start_dttm = datetime.now(tz=pytz.timezone("Europe/Moscow"))

            col1, col2 = st.columns(2)

            with col1:
                dt = st.date_input(label="Дата операции", value=start_dttm, format="YYYY-MM-DD", key="fact_date_input")
            with col2:
                tm = st.time_input(label="Время операции", value=start_dttm, step=60, key="fact_time_input")

            operation_dttm = datetime(
                year=dt.year,
                month=dt.month,
                day=dt.day,
                hour=tm.hour,
                minute=tm.minute,
                second=0,
                microsecond=0,
            ).strftime("%Y-%m-%d %H:%M:%S.%f")

            st.selectbox(
                "Период",
                options=t_d_period.lazy().select("period_ru_name").collect()["period_ru_name"].to_list(),
                index=1,
                key="fact_period_ru_name",
            )

            def update_cost_center_name():
                if "fact_cost_center_toggle" not in st.session_state:
                    st.session_state["fact_cost_center_toggle"] = False
                if "fact_financial_center_name" not in st.session_state:
                    st.session_state["fact_financial_center_name"] = None

                if "fact_cost_center_name" not in st.session_state:
                    st.session_state["fact_cost_center_name"] = st.session_state["fact_financial_center_name"]
                elif st.session_state["fact_cost_center_toggle"] == False:
                    st.session_state["fact_cost_center_name"] = st.session_state["fact_financial_center_name"]

            update_cost_center_name()

            st.selectbox(
                label="ЦФО*",
                options=t_d_financial_center.lazy().select("financial_center_name").collect()["financial_center_name"].to_list(),
                index=0,
                key="fact_financial_center_name",
                on_change=update_cost_center_name,
            )

            st.toggle("МВЗ", key="fact_cost_center_toggle")

            if st.session_state.fact_cost_center_toggle:
                st.selectbox(
                    label="МВЗ",
                    options=t_d_cost_center.lazy().select("cost_center_name").collect()["cost_center_name"].to_list(),
                    index=None,
                    key="fact_cost_center_name",
                )

            with st.popover("Выбор номенлатуры", use_container_width=True):

                col3, col4 = st.columns(2)

                with col3:
                    st.radio(
                        "Операция",
                        key="fact_operation_name",
                        options=t_d_nomenclature.lazy()
                        .filter(pl.col("is_fact") == True)
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
                        key="fact_bill_name",
                        options=t_d_nomenclature.lazy()
                        .filter((pl.col("is_fact") == True) & (pl.col("operation_name") == st.session_state.fact_operation_name))
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
                        key="fact_account_name",
                        options=t_d_nomenclature.lazy()
                        .filter(
                            (pl.col("is_fact") == True)
                            & (pl.col("operation_name") == st.session_state.fact_operation_name)
                            & (pl.col("bill_name") == st.session_state.fact_bill_name)
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
                        key="fact_nomenclature_name",
                        options=t_d_nomenclature.lazy()
                        .filter(
                            (pl.col("is_fact") == True)
                            & (pl.col("operation_name") == st.session_state.fact_operation_name)
                            & (pl.col("bill_name") == st.session_state.fact_bill_name)
                            & (pl.col("account_name") == st.session_state.fact_account_name)
                        )
                        .select("nomenclature_name")
                        .group_by("nomenclature_name", maintain_order=True)
                        .n_unique()
                        .collect()["nomenclature_name"]
                        .to_list(),
                        index=None,
                    )
            if st.session_state.fact_account_name and st.session_state.fact_nomenclature_name:
                st.info(f"Статья: {st.session_state.fact_account_name}, Номенлатура: {st.session_state.fact_nomenclature_name}")

            with st.form("fact_data", clear_on_submit=True):

                _fact_cost_sum = st.number_input(label="Сумма*", min_value=0, value=0, key="fact_cost_sum")
                _fact_comment_description = st.text_area(label="Комментарий", key="fact_comment_description")

                add_row = st.form_submit_button(label="Сохранить", type="primary")

                if add_row:
                    if _fact_cost_sum > 0 and st.session_state.fact_financial_center_name != None and st.session_state.fact_nomenclature_name != None:

                        period_id = (
                            t_d_period.lazy()
                            .select("period_id", "period_ru_name")
                            .filter(pl.col("period_ru_name") == st.session_state.fact_period_ru_name)
                            .collect()["period_id"][0]
                        )

                        financial_center_id = (
                            t_d_financial_center.lazy()
                            .select("financial_center_id", "financial_center_name")
                            .filter(pl.col("financial_center_name") == st.session_state.fact_financial_center_name)
                            .collect()["financial_center_id"][0]
                        )

                        cost_center_id = (
                            t_d_cost_center.lazy()
                            .select("cost_center_id", "cost_center_name")
                            .filter(pl.col("cost_center_name") == st.session_state.fact_cost_center_name)
                            .collect()["cost_center_id"][0]
                        )

                        nomenclature_id = (
                            t_d_nomenclature.lazy()
                            .select("nomenclature_id", "nomenclature_name")
                            .filter(pl.col("nomenclature_name") == st.session_state.fact_nomenclature_name)
                            .collect()["nomenclature_id"][0]
                        )

                        row_type_id = t_d_row_type.lazy().select("row_type_id", "row_type_name").filter(pl.col("row_type_name") == row_type_name).collect()["row_type_id"][0]

                        row = {
                            "operation_dttm": operation_dttm,
                            "period_id": period_id,
                            "financial_center_id": financial_center_id,
                            "cost_center_id": cost_center_id,
                            "nomenclature_id": nomenclature_id,
                            "cost_sum": _fact_cost_sum,
                            "comment_description": _fact_comment_description,
                            "row_type_id": row_type_id,
                            "user_id": st.session_state.user_id,
                        }
                        Registry.insertOne(row=row)
                        st.info("Последние пять записей:")
                        st.dataframe(
                            data=Registry.getLastRows(row_type_id=row_type_id, limit_rows=5),
                            hide_index=True,
                            use_container_width=True,
                        )
                        # График
                        df = Report.getReportPerfomancetRowTypeNomenclature(financial_center_id=financial_center_id, period_id=period_id, nomenclature_id=nomenclature_id)
                        fig = px.bar(df, x="Номенклатура", y="Сумма", color="Тип", barmode="group", text_auto=True)
                        st.plotly_chart(fig, use_container_width=True)
                    else:
                        if st.session_state.fact_financial_center_name == None:
                            st.error("Не указан ЦФО")
                        if st.session_state.fact_nomenclature_name == None:
                            st.error("Не указана Номенклатура")
                        if _fact_cost_sum == 0:
                            st.error("Не указана Сумма")

                show_last_row = st.button(label="Последние записи")
                if show_last_row:
                    st.dataframe(
                        data=Registry.getLastRows(row_type_id=row_type_id, limit_rows=5),
                        hide_index=True,
                        use_container_width=True,
                    )

    class Report:

        def __init__(
            self,
            users: DataFrame = None,
            financial_centers: DataFrame = None,
            cost_centers: DataFrame = None,
            row_types: DataFrame = None,
            nomenclatures: DataFrame = None,
        ) -> None:
            self._users = users
            self._financial_centers = financial_centers
            self._cost_centers = cost_centers
            self._row_types = row_types
            self._nomenclatures = nomenclatures

        @st.fragment
        def report(self):

            t_d_period = Periods().fetchMany(start_date=Functions.get_period(shuffle=-1), end_date=Functions.get_period(shuffle=1), ttl=60)
            t_d_financial_center = self._financial_centers

            st.selectbox(
                label="ЦФО*",
                options=t_d_financial_center.lazy().select("financial_center_name").collect()["financial_center_name"].to_list(),
                index=None,
                key="report_financial_center_name",
            )

            st.selectbox(
                "Период",
                options=t_d_period.lazy().select("period_ru_name").collect()["period_ru_name"].to_list(),
                index=None,
                key="report_period_ru_name",
            )

            report_budget, report_budget_fact = st.tabs(["Бюджет", "План/Факт"])

            if st.session_state.report_financial_center_name and st.session_state.report_period_ru_name:

                financial_center_id = (
                    t_d_financial_center.lazy()
                    .select("financial_center_id", "financial_center_name")
                    .filter(pl.col("financial_center_name") == st.session_state.report_financial_center_name)
                    .collect()["financial_center_id"][0]
                )
                period_id = (
                    t_d_period.lazy().select("period_id", "period_ru_name").filter(pl.col("period_ru_name") == st.session_state.report_period_ru_name).collect()["period_id"][0]
                )

                with report_budget:
                    total = Report.getReportBudgetTotal(period_id=period_id, financial_center_id=financial_center_id)["Сумма"][0]
                    if total:
                        st.write(f"Итого бюджет на {st.session_state.report_period_ru_name} составляет {total} руб.")
                        df = Report.getReportBudgetBillAccount(period_id=period_id, financial_center_id=financial_center_id)
                        fig = px.bar(df, x="Статья", y="Сумма", color="Счет", barmode="group", text_auto=True)
                        st.plotly_chart(fig, use_container_width=True)
                    else:
                        st.info(f"Бюджет на {st.session_state.report_period_ru_name} отсутсвует.")

                with report_budget_fact:
                    bill, account, nomenclature = st.tabs(["Счет", "Статья", "Номенклатура"])

                    with bill:
                        df = Report.getReportCompareRowTypeBill(period_id=period_id, financial_center_id=financial_center_id)
                        if df.shape[0] > 0:
                            fig = px.bar(df, x="Счет", y="Сумма", color="Тип", barmode="group", text_auto=True)
                            st.plotly_chart(fig, use_container_width=True)
                    with account:
                        df = Report.getReportCompareRowTypeAccount(period_id=period_id, financial_center_id=financial_center_id)
                        if df.shape[0] > 0:
                            fig = px.bar(df, x="Статья", y="Сумма", color="Тип", barmode="group", text_auto=True)
                            st.plotly_chart(fig, use_container_width=True)
                    with nomenclature:
                        df = Report.getReportCompareRowTypeNomenclature(period_id=period_id, financial_center_id=financial_center_id)
                        if df.shape[0] > 0:
                            fig = px.bar(df, x="Номенклатура", y="Сумма", color="Тип", barmode="group", text_auto=True)
                            st.plotly_chart(fig, use_container_width=True)
