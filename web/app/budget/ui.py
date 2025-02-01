import streamlit as st
from pathlib import Path
import yaml
import polars as pl
import os
from streamlit_telegram_login import TelegramLoginWidgetComponent
from streamlit_telegram_login.helpers import YamlConfig
from utils.api import Users, FinancialCenters, CostCenter, Nomenclatures, RowTypes
from utils.forms import Forms


if __name__ == "__main__":
    st.set_page_config(page_title="Домашний бюджет", page_icon=":book", initial_sidebar_state="auto", layout="wide")

    parent_dir = os.path.dirname(os.path.abspath(__file__))
    config = YamlConfig(f"{parent_dir}/secrets/telegram_config.yaml")

    telegram_login = TelegramLoginWidgetComponent(**config.config)
    # if not st.session_state["username"]:
    if "telegramm_session" not in st.session_state:
        value = telegram_login.button
        if value:
            st.session_state.telegramm_session = value
            users = Users().fetchAll(ttl=60)
            user_id_df = users.lazy().filter(pl.col(["user_telegram_id"]) == st.session_state.telegramm_session["id"]).collect()
            user_id_df_count = user_id_df.count()
            if user_id_df_count["user_id"][0] > 0:
                if "user_id" not in st.session_state:
                    st.session_state.user_id = user_id_df["user_id"][0]
            else:
                telegram_login.clear_session()
                st.session_state.clear()
                st.write("Пользователя нет в базе! Обратитесь к администратору.")
    else:
        financial_centers = FinancialCenters().fetchAll(ttl=3600)
        cost_centers = CostCenter().fetchAll(ttl=3600)
        nomenclatures = Nomenclatures().fetchAll(ttl=3600)
        row_types = RowTypes().fetchAll(ttl=3600)

        st.sidebar.title(f"Привет {st.session_state.first_name}")
        clicked = st.sidebar.button("Выход")
        if clicked:
            telegram_login.clear_session()
            st.session_state.clear()
            st.rerun()

        options = ["Факт", "Бюджет", "Отчетность"]
        selection = st.segmented_control("", options, selection_mode="single", key=333,default='Факт')
        if selection == "Факт":
            Forms.Fact(
                financial_centers=financial_centers,
                cost_centers=cost_centers,
                row_types=row_types,
                nomenclatures=nomenclatures,
            ).form()
        elif selection == "Бюджет":
            Forms.Budget(
                financial_centers=financial_centers,
                cost_centers=cost_centers,
                row_types=row_types,
                nomenclatures=nomenclatures,
            ).form()
        elif selection == "Отчетность":
            Forms.Report(
                financial_centers=financial_centers,
                cost_centers=cost_centers,
                row_types=row_types,
                nomenclatures=nomenclatures,
            ).report()
        
    # fact, budget, report = st.tabs(["Факт", "Бюджет", "Отчетность"])

    # with fact:
    #     Forms.Fact(
    #         financial_centers=financial_centers,
    #         cost_centers=cost_centers,
    #         row_types=row_types,
    #         nomenclatures=nomenclatures,
    #     ).form()

    # with budget:
    #     Forms.Budget(
    #         financial_centers=financial_centers,
    #         cost_centers=cost_centers,
    #         row_types=row_types,
    #         nomenclatures=nomenclatures,
    #     ).form()

    # with report:
    #     Forms.Report(
    #         financial_centers=financial_centers,
    #         cost_centers=cost_centers,
    #         row_types=row_types,
    #         nomenclatures=nomenclatures,
    #     ).report()
