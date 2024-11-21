import streamlit as st

# import streamlit_authenticator as stauth
# from streamlit_authenticator import Authenticate
from pathlib import Path
import yaml
from yaml.loader import SafeLoader
import polars as pl
import os
from streamlit_telegram_login import TelegramLoginWidgetComponent
from streamlit_telegram_login.helpers import YamlConfig

# from polars import DataFrame

# import hydralit_components as hc

# import os
# import pandas as pd
# from pandas import DataFrame, Series
# from datetime import datetime
from utils.api import Users, FinancialCenters, CostCenter, Nomenclatures, RowTypes
from utils.forms import Forms

# from pydantic import BaseModel, EmailStr, Field
# from datetime import datetime, date
# from uuid import UUID


# def login() -> Authenticate:

#     file_path_config = Path(__file__).parent / "secrets/authenticator_secrets.yaml"

#     with file_path_config.open("rb") as file:
#         config = yaml.load(file, Loader=SafeLoader)

#     authenticator = stauth.Authenticate(
#         config["credentials"], config["cookie"]["name"], config["cookie"]["key"], config["cookie"]["expiry_days"]
#     )

#     authenticator.login(
#         location="sidebar",
#         fields={"Form name": "Авторизация", "Username": "Имя пользователя", "Password": "Пароль", "Login": "Вход"},
#         max_concurrent_users=2,
#     )

#     return authenticator


if __name__ == "__main__":
    st.set_page_config(page_title="Домашний бюджет", page_icon=":book", initial_sidebar_state="auto", layout="wide")

    # users = Users().fetchAll(ttl=1)
    # st.write(users.select("user_name").filter(pl.col("user_name") == "ilya").unique().sort(by="user_name")["user_name"][0])
    # st.stop()

    # test = Test(a=[1, 3, 5], b=[2, 4, 6])
    # st.write(test)
    # df = pl.DataFrame(Test(a=[1, 3, 5], b=[2, 4, 6]))
    # st.write(df.filter(pl.col("a")["a"] == 1))
    # st.stop()
    parent_dir = os.path.dirname(os.path.abspath(__file__))
    config = YamlConfig(f"{parent_dir}/secrets/telegram_config.yaml")

    telegram_login = TelegramLoginWidgetComponent(**config.config)

    # if not st.session_state["username"]:
    if "telegramm_session" not in st.session_state:
        value = telegram_login.button
        if value:
            st.session_state.telegramm_session = value
            users = Users().fetchAll(ttl=1)
            user_key = users.lazy().filter(pl.col(["user_name"]) == st.session_state.telegramm_session["username"]).collect()["user_key"][0]
            st.write(user_key)
            if user_key:
                if "user_key" not in st.session_state:
                    st.session_state.user_key = users.lazy().filter(pl.col(["user_name"]) == st.session_state.telegramm_session["username"]).collect()["user_key"][0]
            # else:
                # telegram_login.clear_session()
                # st.session_state.clear()
                # st.rerun()
    elif st.session_state.user_key is None:
        telegram_login.clear_session()
        st.session_state.clear()
        st.rerun()
    else:
        financial_centers = FinancialCenters().fetchAll(ttl=86400)
        cost_centers = CostCenter().fetchAll(ttl=86400)
        nomenclatures = Nomenclatures().fetchAll(ttl=86400)
        row_types = RowTypes().fetchAll(ttl=86400)

        st.sidebar.title(f"Привет {st.session_state.first_name}")
        clicked = st.sidebar.button("Выход")
        if clicked:
            telegram_login.clear_session()
            st.session_state.clear()
            st.rerun()

        fact, budget, report = st.tabs(["Факт", "Бюджет", "Отчетность"])

        with fact:
            Forms.Fact(
                financial_centers=financial_centers,
                cost_centers=cost_centers,
                row_types=row_types,
                nomenclatures=nomenclatures,
            ).form()

        with budget:
            Forms.Budget(
                financial_centers=financial_centers,
                cost_centers=cost_centers,
                row_types=row_types,
                nomenclatures=nomenclatures,
            ).form()

        with report:
            Forms.Report(
                financial_centers=financial_centers,
                cost_centers=cost_centers,
                row_types=row_types,
                nomenclatures=nomenclatures,
            ).report()
    # else:
    # telegram_login.clear_session()
    # st.rerun()

    # st.write(telegram_login.get_session)

    # clicked = st.button("Clear cookies")
    # if clicked:
    # telegram_login.clear_session()
    # st.write("Cookies have been successfully cleared")

    # authenticator = login()

    # if st.session_state["authentication_status"]:

    #     users = Users().fetchAll(ttl=86400)
    #     if st.session_state.username:
    #         if "user_key" not in st.session_state:
    #             st.session_state.user_key = (
    #                 users.lazy().filter(pl.col(["user_name"]) == st.session_state.username).collect()["user_key"][0]
    #             )
    #     financial_centers = FinancialCenters().fetchAll(ttl=86400)
    #     cost_centers = CostCenter().fetchAll(ttl=86400)
    #     nomenclatures = Nomenclatures().fetchAll(ttl=86400)
    #     row_types = RowTypes().fetchAll(ttl=86400)

    #     st.sidebar.title(f"Привет {st.session_state.name}")
    #     authenticator.logout("Выход", "sidebar")

    #     fact, budget, report = st.tabs(["Факт", "Бюджет", "Отчетность"])

    #     with fact:
    #         Forms.Fact(
    #             financial_centers=financial_centers,
    #             cost_centers=cost_centers,
    #             row_types=row_types,
    #             nomenclatures=nomenclatures,
    #         ).form()

    #     with budget:
    #         Forms.Budget(
    #             financial_centers=financial_centers,
    #             cost_centers=cost_centers,
    #             row_types=row_types,
    #             nomenclatures=nomenclatures,
    #         ).form()

    #     with report:
    #         Forms.Report(
    #             financial_centers=financial_centers,
    #             cost_centers=cost_centers,
    #             row_types=row_types,
    #             nomenclatures=nomenclatures,
    #         ).report()

    # elif st.session_state["authentication_status"] is False:
    #     st.sidebar.error("Логин или пароль не корректный")

    # elif st.session_state["authentication_status"] is None:
    #     st.info("Введите ваш логин и пароль")
