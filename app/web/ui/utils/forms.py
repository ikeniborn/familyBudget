import streamlit as st
from utils.functions import Functions
from pandas import DataFrame
from utils.api import Periods, Registry, Report
import pytz
from datetime import datetime
import plotly.express as px


class Forms:

    def __new__(cls, *args, **kwargs):
        return super().__new__(cls)

    def __init__(self) -> None:
        pass

    class Budget:

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

        @st.experimental_fragment
        def form(self):

            t_d_user = self._users
            t_d_period = Periods().fetchMany(
                start_date=Functions.get_period(shuffle=0), end_date=Functions.get_period(shuffle=1), ttl=360
            )
            t_d_financial_center = self._financial_centers
            t_d_cost_center = self._cost_centers
            t_d_row_type = self._row_types
            t_d_nomenclature = self._nomenclatures
            user_key = t_d_user[t_d_user["user_name"] == st.session_state.username].reset_index()["user_key"].values[0]

            st.info("Поля с * обязательные для заполнения!")

            row_type_name = "Бюджет"

            start_dttm = datetime.now(tz=pytz.timezone("Europe/Moscow"))

            col1, col2 = st.columns(2)

            with col1:
                dt = st.date_input(label="Дата операции", value=start_dttm, format="YYYY-MM-DD", key="budget_date_input")
            with col2:
                tm = st.time_input(label="Время операции", value=start_dttm, step=60, key="budget_time_input")

            operation_dttm = datetime(
                year=dt.year, month=dt.month, day=dt.day, hour=tm.hour, minute=tm.minute, second=0, microsecond=0
            ).strftime("%Y-%m-%d %H:%M:%S.%f")

            st.selectbox("Период", options=t_d_period["period_ru_name"].to_list(), index=1, key="budget_period_ru_name")

            financial_center_name = st.selectbox(
                label="ЦФО*",
                options=t_d_financial_center["financial_center_name"].to_list(),
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
                        options=t_d_nomenclature[t_d_nomenclature["is_budget"]]["operation_name"].drop_duplicates().to_list(),
                        horizontal=False,
                        index=None,
                    )

                with col4:
                    st.radio(
                        "Счет",
                        key="budget_bill_name",
                        options=t_d_nomenclature[
                            (
                                t_d_nomenclature["is_budget"]
                                & (t_d_nomenclature["operation_name"] == st.session_state.budget_operation_name)
                            )
                        ]["bill_name"]
                        .sort_values()
                        .drop_duplicates()
                        .to_list(),
                        horizontal=False,
                        index=None,
                    )

                col5, col6 = st.columns(2)

                with col5:
                    st.radio(
                        label="Статья",
                        key="budget_account_name",
                        options=t_d_nomenclature[
                            (t_d_nomenclature["is_budget"] == True)
                            & (t_d_nomenclature["operation_name"] == st.session_state.budget_operation_name)
                            & (t_d_nomenclature["bill_name"] == st.session_state.budget_bill_name)
                        ]["account_name"]
                        .sort_values()
                        .drop_duplicates()
                        .to_list(),
                        index=None,
                    )
                with col6:
                    st.radio(
                        label="Номенклатура*",
                        key="budget_nomenclature_name",
                        options=t_d_nomenclature[
                            (t_d_nomenclature["is_budget"] == True)
                            & (t_d_nomenclature["operation_name"] == st.session_state.budget_operation_name)
                            & (t_d_nomenclature["bill_name"] == st.session_state.budget_bill_name)
                            & (t_d_nomenclature["account_name"] == st.session_state.budget_account_name)
                        ]["nomenclature_name"]
                        .sort_values()
                        .to_list(),
                        index=None,
                    )

            st.info(f"Номенлатура: {st.session_state.budget_nomenclature_name}")
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
                            t_d_period[t_d_period["period_ru_name"] == st.session_state.budget_period_ru_name]
                            .reset_index()["period_key"]
                            .values[0]
                        )
                        financial_center_key = (
                            t_d_financial_center[
                                t_d_financial_center["financial_center_name"] == st.session_state.budget_financial_center_name
                            ]
                            .reset_index()["financial_center_key"]
                            .values[0]
                        )
                        cost_center_key = (
                            t_d_cost_center[t_d_cost_center["cost_center_name"] == cost_center_name]
                            .reset_index()["cost_center_key"]
                            .values[0]
                        )
                        nomenclature_key = (
                            t_d_nomenclature[t_d_nomenclature["nomenclature_name"] == st.session_state.budget_nomenclature_name]
                            .reset_index()["nomenclature_key"]
                            .values[0]
                        )
                        row_type_key = (
                            t_d_row_type[t_d_row_type["row_type_name"] == row_type_name].reset_index()["row_type_key"].values[0]
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
                            "user_key": user_key,
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

    class Fact:

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

        @st.experimental_fragment
        def form(self):

            t_d_user = self._users
            t_d_period = Periods().fetchMany(
                start_date=Functions.get_period(shuffle=-1), end_date=Functions.get_period(shuffle=0), ttl=360
            )
            t_d_financial_center = self._financial_centers
            t_d_cost_center = self._cost_centers
            t_d_row_type = self._row_types
            t_d_nomenclature = self._nomenclatures
            user_key = t_d_user[t_d_user["user_name"] == st.session_state.username].reset_index()["user_key"].values[0]

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

            st.selectbox("Период", options=t_d_period["period_ru_name"].to_list(), index=1, key="fact_period_ru_name")

            def update_cost_center_name():
                if "fact_financial_center_name" not in st.session_state:
                    st.session_state["fact_financial_center_name"] = None
                if "fact_cost_center_name" not in st.session_state:
                    st.session_state["fact_cost_center_name"] = st.session_state["fact_financial_center_name"]
                elif st.session_state["fact_cost_center_toggle"] == False:
                    st.session_state["fact_cost_center_name"] = st.session_state["fact_financial_center_name"]

            update_cost_center_name()

            st.selectbox(
                label="ЦФО*",
                options=t_d_financial_center["financial_center_name"].to_list(),
                index=0,
                key="fact_financial_center_name",
                on_change=update_cost_center_name,
            )

            st.toggle("МВЗ", key="fact_cost_center_toggle")

            if st.session_state.fact_cost_center_toggle:
                st.selectbox(
                    label="МВЗ", options=t_d_cost_center["cost_center_name"].to_list(), index=None, key="fact_cost_center_name"
                )

            with st.popover("Выбор номенлатуры", use_container_width=True):

                col3, col4 = st.columns(2)

                with col3:
                    st.radio(
                        "Операция",
                        key="fact_operation_name",
                        options=t_d_nomenclature[t_d_nomenclature["is_fact"]]["operation_name"].drop_duplicates().to_list(),
                        horizontal=False,
                        index=None,
                    )

                with col4:
                    st.radio(
                        "Счет",
                        key="fact_bill_name",
                        options=t_d_nomenclature[
                            (
                                t_d_nomenclature["is_fact"]
                                & (t_d_nomenclature["operation_name"] == st.session_state.fact_operation_name)
                            )
                        ]["bill_name"]
                        .sort_values()
                        .drop_duplicates()
                        .to_list(),
                        horizontal=False,
                        index=None,
                    )

                col5, col6 = st.columns(2)

                with col5:
                    st.radio(
                        label="Статья",
                        key="fact_account_name",
                        options=t_d_nomenclature[
                            (t_d_nomenclature["is_fact"] == True)
                            & (t_d_nomenclature["operation_name"] == st.session_state.fact_operation_name)
                            & (t_d_nomenclature["bill_name"] == st.session_state.fact_bill_name)
                        ]["account_name"]
                        .sort_values()
                        .drop_duplicates()
                        .to_list(),
                        index=None,
                    )
                with col6:
                    st.radio(
                        label="Номенклатура*",
                        key="fact_nomenclature_name",
                        options=t_d_nomenclature[
                            (t_d_nomenclature["is_fact"] == True)
                            & (t_d_nomenclature["operation_name"] == st.session_state.fact_operation_name)
                            & (t_d_nomenclature["bill_name"] == st.session_state.fact_bill_name)
                            & (t_d_nomenclature["account_name"] == st.session_state.fact_account_name)
                        ]["nomenclature_name"]
                        .sort_values()
                        .to_list(),
                        index=None,
                    )

            st.info(f"Номенлатура: {st.session_state.fact_nomenclature_name}")

            with st.form("fact_data", clear_on_submit=True):

                st.number_input(label="Сумма*", min_value=0, value=0, key="fact_cost_sum")
                st.text_area(label="Комментарий", key="fact_comment_description")

                add_row = st.form_submit_button(label="Сохранить", type="primary")

                if add_row:
                    if (
                        st.session_state.fact_cost_sum > 0
                        and st.session_state.fact_financial_center_name != None
                        and st.session_state.fact_nomenclature_name != None
                    ):
                        registry_key = Functions.get_random_uuid()
                        period_key = (
                            t_d_period[t_d_period["period_ru_name"] == st.session_state.fact_period_ru_name]
                            .reset_index()["period_key"]
                            .values[0]
                        )
                        financial_center_key = (
                            t_d_financial_center[
                                t_d_financial_center["financial_center_name"] == st.session_state.fact_financial_center_name
                            ]
                            .reset_index()["financial_center_key"]
                            .values[0]
                        )
                        cost_center_key = (
                            t_d_cost_center[t_d_cost_center["cost_center_name"] == st.session_state.fact_cost_center_name]
                            .reset_index()["cost_center_key"]
                            .values[0]
                        )
                        nomenclature_key = (
                            t_d_nomenclature[t_d_nomenclature["nomenclature_name"] == st.session_state.fact_nomenclature_name]
                            .reset_index()["nomenclature_key"]
                            .values[0]
                        )
                        row_type_key = (
                            t_d_row_type[t_d_row_type["row_type_name"] == row_type_name].reset_index()["row_type_key"].values[0]
                        )

                        row = {
                            "registry_key": registry_key,
                            "operation_dttm": operation_dttm,
                            "period_key": period_key,
                            "financial_center_key": financial_center_key,
                            "cost_center_key": cost_center_key,
                            "nomenclature_key": nomenclature_key,
                            "cost_sum": st.session_state.fact_cost_sum,
                            "comment_description": st.session_state.fact_comment_description,
                            "row_type_key": row_type_key,
                            "user_key": user_key,
                        }
                        Registry.insertOne(row=row)
                        st.info("Последние пять записей:")
                        st.dataframe(
                            data=Registry.getLastRows(row_type_key=row_type_key, limit_rows=5),
                            hide_index=True,
                            use_container_width=True,
                        )
                        # График
                        df = Report.getReportPerfomancetRowTypeNomenclature(
                            financial_center_key=financial_center_key, period_key=period_key, nomenclature_key=nomenclature_key
                        )
                        fig = px.bar(df, x="Номенклатура", y="Сумма", color="Тип", barmode="group", text_auto=True)
                        st.plotly_chart(fig, use_container_width=True)
                    else:
                        if st.session_state.fact_financial_center_name == None:
                            st.error("Не указан ЦФО")
                        if st.session_state.fact_nomenclature_name == None:
                            st.error("Не указана Номенклатура")
                        if st.session_state.fact_cost_sum == 0:
                            st.error("Не указана Сумма")

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

        @st.experimental_fragment
        def report(self):

            t_d_period = Periods().fetchMany(
                start_date=Functions.get_period(shuffle=-1), end_date=Functions.get_period(shuffle=1), ttl=360
            )
            t_d_financial_center = self._financial_centers

            st.selectbox(
                label="ЦФО*",
                options=t_d_financial_center["financial_center_name"].to_list(),
                index=None,
                key="report_financial_center_name",
            )

            st.selectbox(
                "Период",
                options=t_d_period["period_ru_name"].to_list(),
                index=None,
                key="report_period_ru_name",
            )

            report_budget, report_budget_fact = st.tabs(["Бюджет", "План/Факт"])

            if st.session_state.report_financial_center_name and st.session_state.report_period_ru_name:

                financial_center_key = (
                    t_d_financial_center[
                        t_d_financial_center["financial_center_name"] == st.session_state.report_financial_center_name
                    ]
                    .reset_index()["financial_center_key"]
                    .values[0]
                )
                period_key = (
                    t_d_period[t_d_period["period_ru_name"] == st.session_state.report_period_ru_name]
                    .reset_index()["period_key"]
                    .values[0]
                )

                with report_budget:
                    total = Report.getReportBudgetTotal(period_key=period_key, financial_center_key=financial_center_key)[
                        "Сумма"
                    ].values[0]
                    if total:
                        st.write(f"Итого бюджет на {st.session_state.report_period_ru_name} составляет {total} руб.")
                        df = Report.getReportBudgetBillAccount(period_key=period_key, financial_center_key=financial_center_key)
                        fig = px.bar(df, x="Статья", y="Сумма", color="Счет", barmode="group", text_auto=True)
                        st.plotly_chart(fig, use_container_width=True)
                    else:
                        st.info(f"Бюджет на {st.session_state.report_period_ru_name} отсутсвует.")

                with report_budget_fact:
                    bill, account, nomenclature = st.tabs(["Счет", "Статья", "Номенклатура"])

                    with bill:
                        df = Report.getReportCompareRowTypeBill(period_key=period_key, financial_center_key=financial_center_key)
                        fig = px.bar(df, x="Счет", y="Сумма", color="Тип", barmode="group", text_auto=True)
                        st.plotly_chart(fig, use_container_width=True)
                    with account:
                        df = Report.getReportCompareRowTypeAccount(
                            period_key=period_key, financial_center_key=financial_center_key
                        )
                        fig = px.bar(df, x="Статья", y="Сумма", color="Тип", barmode="group", text_auto=True)
                        st.plotly_chart(fig, use_container_width=True)
                    with nomenclature:
                        df = Report.getReportCompareRowTypeNomenclature(
                            period_key=period_key, financial_center_key=financial_center_key
                        )
                        fig = px.bar(df, x="Номенклатура", y="Сумма", color="Тип", barmode="group", text_auto=True)
                        st.plotly_chart(fig, use_container_width=True)
