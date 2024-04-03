import datetime
import streamlit as st
import src.function as function
import pytz
import plotly.express as px
from app.web.api.utils.postgres import Postgres


def form(connection_db: Postgres = None, user_name: str = None):

    db_budget = connection_db.connect()

    t_d_user = db_budget.select(sql="select user_key, user_name from t_d_user", ttl=300)
    t_d_period = db_budget.select(sql="select period_key,period_dt,period_ru_name from t_d_period order by period_dt", ttl=300)
    t_d_financial_center = db_budget.select(
        sql="select  financial_center_key, financial_center_name from t_d_financial_center", ttl=300
    )
    t_d_cost_center = db_budget.select(sql="select cost_center_key,cost_center_name from t_d_cost_center", ttl=300)
    t_d_row_type = db_budget.select(sql="select row_type_key,row_type_name from t_d_row_type", ttl=300)
    t_d_nomenclature = db_budget.select(
        sql="select nomenclature_key,nomenclature_name from t_d_nomenclature where is_fact=true", ttl=300
    )
    user_key = t_d_user[t_d_user["user_name"] == user_name]["user_key"].values[0]

    with st.form(key="fact_form", clear_on_submit=True):

        st.info("Поля с * обязательные для заполнения!")

        row_type_name = "Факт"
        operation_dttm = datetime.datetime.now(tz=pytz.timezone("Europe/Moscow")).strftime("%Y-%m-%d %H:%M:%S.%f")
        period_ru_name = st.selectbox(
            "Период",
            options=t_d_period[
                (t_d_period["period_dt"] >= function.get_period(-1)) & (t_d_period["period_dt"] <= function.get_period(0))
            ]["period_ru_name"].to_list(),
            index=1,
        )
        financial_center_name = st.selectbox(
            label="ЦФО*", options=t_d_financial_center["financial_center_name"].to_list(), index=None
        )
        cost_center_name = st.selectbox(label="МВЗ", options=t_d_cost_center["cost_center_name"].to_list(), index=None)
        if cost_center_name == None:
            cost_center_name = financial_center_name
        nomenclature_name = st.selectbox(
            label="Номенклатура*", options=t_d_nomenclature["nomenclature_name"].to_list(), index=None
        )
        cost_sum = st.number_input(label="Сумма*", min_value=0, value=0)
        comment_description = st.text_input(label="Комментарий")

        add_row = st.form_submit_button(label="Сохранить", type="primary")

        if add_row:
            if cost_sum > 0 and financial_center_name != None and nomenclature_name != None:
                registry_key = function.get_random_uuid()
                period_key = t_d_period[t_d_period["period_ru_name"] == period_ru_name]["period_key"].values[0]
                financial_center_key = t_d_financial_center[
                    t_d_financial_center["financial_center_name"] == financial_center_name
                ]["financial_center_key"].values[0]
                cost_center_key = t_d_cost_center[t_d_cost_center["cost_center_name"] == cost_center_name][
                    "cost_center_key"
                ].values[0]
                nomenclature_key = t_d_nomenclature[t_d_nomenclature["nomenclature_name"] == nomenclature_name][
                    "nomenclature_key"
                ].values[0]
                row_type_key = t_d_row_type[t_d_row_type["row_type_name"] == row_type_name]["row_type_key"].values[0]
                sql_row = f"""
          INSERT INTO t_f_registry (registry_key,operation_dttm,period_key,financial_center_key,cost_center_key,nomenclature_key,cost_sum,comment_description,row_type_key,user_key) 
          VALUES (
              \'{registry_key}\',
              \'{operation_dttm}\',
              \'{period_key}\',
              \'{financial_center_key}\',
              \'{cost_center_key}\',
              \'{nomenclature_key}\',
              {cost_sum},
              \'{comment_description}\',
              \'{row_type_key}\',
              \'{user_key}\'
            );
          """
                db_budget.insert(sql=sql_row)
                st.info("Последние пять записей:")
                sql_five_row = f"""
            select 
              t0.operation_dttm as "Дата операции", 
              t1.period_ru_name as "Период", 
              t2.financial_center_name as "ЦФО",
              t3.cost_center_name as "МВЗ",
              t4.nomenclature_name as "Номенклатура",
              t0.cost_sum as "Сумма", 
              t0.comment_description as "Комментарий" 
            from t_f_registry t0
            join t_d_period t1 using(period_key) 
            join t_d_financial_center t2 using(financial_center_key) 
            join t_d_cost_center t3 using(cost_center_key) 
            join t_d_nomenclature t4 using(nomenclature_key) 
            where 
              t0.row_type_key = \'{row_type_key}\' 
            order by 
              t0.operation_dttm desc 
            limit 5"""
                st.dataframe(data=db_budget.select(sql=sql_five_row), hide_index=True, use_container_width=True)
                df = db_budget.select(
                    sql=f"""
            select 
              t4.row_type_name as "Тип", 
              t3.nomenclature_name as "Статья", 
              sum(cost_sum) as "Сумма" 
            from 
              t_f_registry t0 
            join t_d_financial_center t2 using(financial_center_key) 
            join t_d_nomenclature t3 using(nomenclature_key) 
            join t_d_row_type t4 using(row_type_key) 
            where 
              t0.financial_center_key=\'{financial_center_key}\' 
              and t0.period_key=\'{period_key}\' 
              and t0.nomenclature_key=\'{nomenclature_key}\' 
            group by 
              t4.row_type_name, 
              t3.nomenclature_name
            order by 
              t4.row_type_name
            """
                )
                fig = px.bar(df, x="Статья", y="Сумма", color="Тип", barmode="group", text_auto=True)
                st.plotly_chart(fig, use_container_width=True)
                db_budget.close()
            else:
                if financial_center_name == None:
                    st.error("Не указан ЦФО")
                if nomenclature_name == None:
                    st.error("Не указана Номенклатура")
                if cost_sum == 0:
                    st.error("Не указана Сумма")
