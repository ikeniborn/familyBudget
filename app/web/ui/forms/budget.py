import datetime
import streamlit as st
from utils.functions import Functions
import pytz
from pandas import DataFrame


def form(
    users: DataFrame = None,
    periods: DataFrame = None,
    financial_centers: DataFrame = None,
    cost_centers: DataFrame = None,
    row_types: DataFrame = None,
    nomenclatures: DataFrame = None,
):

    t_d_user = users
    t_d_period = periods
    t_d_financial_center = financial_centers
    t_d_cost_center = cost_centers
    t_d_row_type = row_types
    t_d_nomenclature = nomenclatures
    user_key = t_d_user[t_d_user["user_name"] == st.session_state.user_name]["user_key"].values[0]

    with st.form(key="budget_form", clear_on_submit=True):

        st.info("Поля с * обязательные для заполнения!")

        row_type_name = "Бюджет"
        operation_dttm = datetime.datetime.now(tz=pytz.timezone("Europe/Moscow")).strftime("%Y-%m-%d %H:%M:%S.%f")
        period_ru_name = st.selectbox(
            "Период",
            options=t_d_period[
                (t_d_period["period_dt"] >= Functions.get_period(-1)) & (t_d_period["period_dt"] <= Functions.get_period(0))
            ]["period_ru_name"].to_list(),
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
        comment_description = st.text_input(label="Комментарий")

        add_row = st.form_submit_button(label="Сохранить", type="primary")

        if add_row:
            if cost_sum > 0 and financial_center_name != None and nomenclature_name != None:
                registry_key = Functions.get_random_uuid()
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
          BEGIN TRANSACTION;
          INSERT INTO t_f_registry (
            registry_key,
            operation_dttm,
            period_key,
            financial_center_key,
            cost_center_key,
            nomenclature_key,
            cost_sum,
            comment_description,
            row_type_key,
            user_key) 
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
          COMMIT;
          """
                db_budget.insert(sql=sql_row)
                st.info("Последние пять записей:")
                st.dataframe(
                    data=db_budget.select(
                        sql=f"""
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
                    ),
                    hide_index=True,
                    use_container_width=True,
                )
                db_budget.close()
            else:
                if financial_center_name == None:
                    st.error("Не указан ЦФО")
                if nomenclature_name == None:
                    st.error("Не указана Номенклатура")
                if cost_sum == 0:
                    st.error("Не указана Сумма")
