import datetime
import streamlit as st

# import pandas as pd
from utils.functions import Functions

# import pytz
from pandas import DataFrame
from utils.dimensions import Users, Periods, FinancialCenters, CostCenter, Nomenclatures, RowTypes
from utils.facts import Registry
from utils.models import Models
import json


def form(
    users: DataFrame = None,
    financial_centers: DataFrame = None,
    cost_centers: DataFrame = None,
    row_types: DataFrame = None,
    nomenclatures: DataFrame = None,
):

    t_d_user = users
    t_d_period = Periods().fetchMany(start_date=Functions.get_period(shuffle=-1), end_date=Functions.get_period(shuffle=1), ttl=1)
    t_d_financial_center = financial_centers
    t_d_cost_center = cost_centers
    t_d_row_type = row_types
    t_d_nomenclature = nomenclatures
    user_key = t_d_user[t_d_user["user_name"] == st.session_state.username].reset_index()["user_key"].values[0]

    with st.form(key="budget_form", clear_on_submit=False):

        st.info("Поля с * обязательные для заполнения!")

        row_type_name = "Бюджет"
        # operation_dttm = datetime.datetime.now(tz=pytz.timezone("Europe/Moscow")).strftime("%Y-%m-%d %H:%M:%S.%f")
        col1, col2 = st.columns(2)
        with col1:
            dt = st.date_input(label="Дата операции", value="today", format="YYYY-MM-DD")
        with col2:
            tm = st.time_input(label="Время операции", value="now", step=60)
        operation_dttm = datetime.datetime(
            year=dt.year, month=dt.month, day=dt.day, hour=tm.hour, minute=tm.minute, second=0, microsecond=0
        ).strftime("%Y-%m-%d %H:%M:%S.%f")
        period_ru_name = st.selectbox(
            "Период",
            options=t_d_period["period_ru_name"].to_list(),
            index=1,
        )
        financial_center_name = st.selectbox(
            label="ЦФО*", options=t_d_financial_center["financial_center_name"].to_list(), index=None
        )
        cost_center_name = financial_center_name
        nomenclature_name = st.selectbox(
            label="Номенклатура*", options=t_d_nomenclature["nomenclature_name"].to_list(), index=None
        )
        cost_sum = st.number_input(label="Сумма*", min_value=0, value=0)
        comment_description = st.text_area(label="Комментарий")

        add_row = st.form_submit_button(label="Сохранить", type="primary")

        if add_row:
            if cost_sum > 0 and financial_center_name != None and nomenclature_name != None:
                registry_key = Functions.get_random_uuid()
                period_key = t_d_period[t_d_period["period_ru_name"] == period_ru_name].reset_index()["period_key"].values[0]
                financial_center_key = (
                    t_d_financial_center[t_d_financial_center["financial_center_name"] == financial_center_name]
                    .reset_index()["financial_center_key"]
                    .values[0]
                )
                cost_center_key = (
                    t_d_cost_center[t_d_cost_center["cost_center_name"] == cost_center_name]
                    .reset_index()["cost_center_key"]
                    .values[0]
                )
                nomenclature_key = (
                    t_d_nomenclature[t_d_nomenclature["nomenclature_name"] == nomenclature_name]
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
                    "cost_sum": cost_sum,
                    "comment_description": comment_description,
                    "row_type_key": row_type_key,
                    "user_key": user_key,
                }
                st.write(row)
                Registry.insertOne(row=row)
            #       st.info("Последние пять записей:")
            #       st.dataframe(
            #           data=db_budget.select(
            #               sql=f"""
            #   select
            #     t0.operation_dttm as "Дата операции",
            #     t1.period_ru_name as "Период",
            #     t2.financial_center_name as "ЦФО",
            #     t3.cost_center_name as "МВЗ",
            #     t4.nomenclature_name as "Номенклатура",
            #     t0.cost_sum as "Сумма",
            #     t0.comment_description as "Комментарий"
            #   from t_f_registry t0
            #   join t_d_period t1 using(period_key)
            #   join t_d_financial_center t2 using(financial_center_key)
            #   join t_d_cost_center t3 using(cost_center_key)
            #   join t_d_nomenclature t4 using(nomenclature_key)
            #   where
            #     t0.row_type_key = \'{row_type_key}\'
            #   order by
            #     t0.operation_dttm desc
            #   limit 5"""
            #           ),
            #           hide_index=True,
            #           use_container_width=True,
            #       )
            #       db_budget.close()
            else:
                if financial_center_name == None:
                    st.error("Не указан ЦФО")
                if nomenclature_name == None:
                    st.error("Не указана Номенклатура")
                if cost_sum == 0:
                    st.error("Не указана Сумма")
