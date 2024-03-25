import streamlit as st
from src.postgres import Postgres


def form(connection_db: Postgres = None):
    db_budget = connection_db.connect()
    number_limit = st.number_input("Количество записей", min_value=5)

    def last_row(number):
        query = f"""
          select 
            cast('f' as BOOLEAN) as "Удалить", 
            CAST(t0.registry_key as VARCHAR) as "Идентификатор записи", 
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
          join t_d_row_type t5 using(row_type_key)
          order by 
            t0.operation_dttm desc 
          limit {number}"""
        return db_budget.select(sql=query)

    if number_limit:
        table = st.data_editor(data=last_row(number_limit), key=f"df_state", num_rows="fixed", hide_index=True)
        row_registry_keys = table[table["Удалить"] == True]["Идентификатор записи"].to_list()
        delete_button = st.button(label="Удалить", type="primary")
        if row_registry_keys and delete_button:
            update_button = st.button(label="Обновить", type="secondary")
            for row_registry_key in row_registry_keys:
                delete_query = f"""
        delete from t_f_registry where registry_key=\'{row_registry_key}\';
        """
                db_budget.delete(sql=delete_query)
                select_query = f"""
        select count(1) as count_row from t_f_registry where registry_key=\'{row_registry_key}\';
        """
                count_row = db_budget.select(sql=select_query)["count_row"].values[0]
                if count_row == 0:
                    st.info(f"Запись с идентифкатором {row_registry_key} удалена!")
            if update_button:
                st.rerun()
        db_budget.close()
