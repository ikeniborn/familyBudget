import streamlit as st
import src.function as function
import plotly.express as px
from src.postgres import Postgres


def form(connection_db: Postgres = None):

    db_budget = connection_db.connect()
    t_d_period = db_budget.select(sql="select period_key,period_dt,period_ru_name from t_d_period order by period_dt", ttl=300)
    t_d_financial_center = db_budget.select(
        sql="select  financial_center_key, financial_center_name from t_d_financial_center", ttl=300
    )
    report_selector = st.selectbox(label="Выбор отчета", options=["План/Факт", "Бюджет"], index=None)
    if report_selector:
        financial_center_name = st.selectbox(
            label="ЦФО*", options=t_d_financial_center["financial_center_name"].to_list(), index=None
        )
        financial_center_key = None
        if financial_center_name:
            financial_center_key = t_d_financial_center[t_d_financial_center["financial_center_name"] == financial_center_name][
                "financial_center_key"
            ].values[0]
        period_ru_name = st.selectbox(
            "Период",
            options=t_d_period[
                (t_d_period["period_dt"] >= function.get_period(-1)) & (t_d_period["period_dt"] <= function.get_period(2))
            ]["period_ru_name"].to_list(),
            index=1,
        )
        period_key = t_d_period[t_d_period["period_ru_name"] == period_ru_name]["period_key"].values[0]
        if financial_center_key and report_selector:
            if report_selector == "Бюджет":
                total = db_budget.select(
                    sql=f"""
            SELECT
              sum(t0.cost_sum) AS "Сумма"
            FROM
              t_f_registry t0
            WHERE
              t0.financial_center_key = \'{financial_center_key}\'
            AND t0.period_key = \'{period_key}\'
            AND t0.row_type_key = \'f003e80f-57d7-6757-bd6a-24170e1f75a4\'
            """
                )["Сумма"].values[0]
                st.write(f"Итого бюджет на {period_ru_name} составляет {total} руб.")
                df = db_budget.select(
                    sql=f"""
            SELECT
              t1.bill_name AS "Счет",
              t1.account_name AS "Статья",
              sum(t0.cost_sum) AS "Сумма"
            FROM
              t_f_registry t0
            join t_d_nomenclature t1 using(nomenclature_key) 
            WHERE
              t0.financial_center_key = \'{financial_center_key}\'
              AND t0.period_key = \'{period_key}\'
              AND t0.row_type_key = \'f003e80f-57d7-6757-bd6a-24170e1f75a4\'
            GROUP BY
              t1.bill_name,
              t1.account_name
            ORDER BY
              t1.bill_name,
              t1.account_name
              """
                )
                fig = px.bar(df, x="Статья", y="Сумма", color="Счет", barmode="group", text_auto=True)
                st.plotly_chart(fig, use_container_width=True)
            elif report_selector == "План/Факт":
                if financial_center_key:
                    grouping = st.selectbox(label="Группировка", options=["Операция", "Счет", "Статья", "Номенклатура"], index=2)
                    ## Add a select box for choosing the chart type
                    # chart_type = st.selectbox('Choose a chart type', ['Bar', 'Line'])
                    chart_type = "Bar"
                    if grouping == "Операция":
                        df = db_budget.select(
                            f"""
              SELECT
                t2.row_type_name AS "Тип",
                t1.operation_name AS "Операция",
                sum(t0.cost_sum) AS "Сумма"
              FROM
                t_f_registry t0
              join t_d_nomenclature t1 using(nomenclature_key)
              join t_d_row_type t2 using(row_type_key)
              WHERE
                t0.financial_center_key = \'{financial_center_key}\'
                AND t0.period_key = \'{period_key}\'
              GROUP BY 
                t2.row_type_name,
                t1.operation_name
              ORDER BY
                t2.row_type_name,
                t1.operation_name
                """
                        )
                        ## Create the chart
                        if chart_type == "Bar":
                            fig = px.bar(df, x="Операция", y="Сумма", color="Тип", barmode="group", text_auto=True)
                        elif chart_type == "Line":
                            fig = px.line(df, x="Операция", y="Сумма", color="Тип")
                        ## Display the chart
                        st.plotly_chart(fig, use_container_width=True)
                    elif grouping == "Счет":
                        df = db_budget.select(
                            f"""
              SELECT
                t2.row_type_name AS "Тип",
                t1.bill_name AS "Счет",
                sum(t0.cost_sum) AS "Сумма"
              FROM
                t_f_registry t0
              join t_d_nomenclature t1 using(nomenclature_key)
              join t_d_row_type t2 using(row_type_key)
              WHERE
                t0.financial_center_key = \'{financial_center_key}\'
                AND t0.period_key = \'{period_key}\'
              GROUP BY row_type_name,
                t1.bill_name
              ORDER BY
                t2.row_type_name,
                t1.bill_name
                """
                        )
                        ## Create the chart
                        if chart_type == "Bar":
                            fig = px.bar(df, x="Счет", y="Сумма", color="Тип", barmode="group", text_auto=True)
                        elif chart_type == "Line":
                            fig = px.line(df, x="Счет", y="Сумма", color="Тип")
                        ## Display the chart
                        st.plotly_chart(fig, use_container_width=True)
                    elif grouping == "Статья":
                        df = db_budget.select(
                            f"""
              SELECT
                t2.row_type_name AS "Тип",
                t1.account_name AS "Статья",
                sum(t0.cost_sum) AS "Сумма"
              FROM
                t_f_registry t0
              join t_d_nomenclature t1 using(nomenclature_key)
              join t_d_row_type t2 using(row_type_key)
              WHERE
                t0.financial_center_key = \'{financial_center_key}\'
                AND t0.period_key = \'{period_key}\'
              GROUP BY row_type_name,
                t1.account_name
              ORDER BY
                t2.row_type_name,
                t1.account_name
                """
                        )
                        if chart_type == "Bar":
                            fig = px.bar(df, x="Статья", y="Сумма", color="Тип", barmode="group", text_auto=True)
                        elif chart_type == "Line":
                            fig = px.line(df, x="Статья", y="Сумма", color="Тип")
                        ## Display the chart
                        st.plotly_chart(fig, use_container_width=True)
                    elif grouping == "Номенклатура":
                        df = db_budget.select(
                            sql=f"""
              SELECT
                t2.row_type_name AS "Тип",
                t1.nomenclature_name AS "Номенклатура",
                sum(t0.cost_sum) AS "Сумма"
              FROM
                t_f_registry t0
              join t_d_nomenclature t1 using(nomenclature_key)
              join t_d_row_type t2 using(row_type_key)
              WHERE
                t0.financial_center_key = \'{financial_center_key}\'
                AND t0.period_key = \'{period_key}\'
              GROUP BY row_type_name,
                t1.nomenclature_name
              ORDER BY
                t2.row_type_name,
                t1.nomenclature_name
                """
                        )
                        ## Create the chart
                        if chart_type == "Bar":
                            fig = px.bar(df, x="Номенклатура", y="Сумма", color="Тип", barmode="group", text_auto=True)
                        elif chart_type == "Line":
                            fig = px.line(df, x="Номенклатура", y="Сумма", color="Тип")
                        ## Display the chart
                        st.plotly_chart(fig, use_container_width=True)
                    else:
                        pass
