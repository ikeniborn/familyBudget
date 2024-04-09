import streamlit as st
import streamlit_authenticator as stauth
from streamlit_authenticator import Authenticate
from pathlib import Path
import yaml
from yaml.loader import SafeLoader

# import hydralit_components as hc

# import os
# import pandas as pd
# from pandas import DataFrame, Series
# from datetime import datetime
from utils.api import Users, FinancialCenters, CostCenter, Nomenclatures, RowTypes
from utils.forms import Forms


def login() -> Authenticate:

    file_path_config = Path(__file__).parent / "secrets/authenticator_secrets.yaml"

    with file_path_config.open("rb") as file:
        config = yaml.load(file, Loader=SafeLoader)

    authenticator = stauth.Authenticate(
        config["credentials"], config["cookie"]["name"], config["cookie"]["key"], config["cookie"]["expiry_days"]
    )

    authenticator.login(
        location="main",
        fields={"Form name": "Авторизация", "Username": "Имя пользователя", "Password": "Пароль", "Login": "Вход"},
        max_concurrent_users=2,
    )

    return authenticator


if __name__ == "__main__":
    st.set_page_config(page_title="Домашний бюджет", page_icon=":book", initial_sidebar_state="collapsed", layout="centered")
    authenticator = login()

    if st.session_state["authentication_status"]:
        users = Users().fetchAll(ttl=100)
        financial_centers = FinancialCenters().fetchAll(ttl=100)
        cost_centers = CostCenter().fetchAll(ttl=100)
        nomenclatures = Nomenclatures().fetchAll(ttl=100)
        row_types = RowTypes().fetchAll(ttl=100)

        st.sidebar.title(f"Привет {st.session_state.name}")
        authenticator.logout("Выход", "sidebar")

        fact, budget, report = st.tabs(["Факт", "Бюджет", "Отчетность"])

        with fact:
            Forms.Fact(
                users=users,
                financial_centers=financial_centers,
                cost_centers=cost_centers,
                row_types=row_types,
                nomenclatures=nomenclatures,
            ).form()

        with budget:
            Forms.Budget(
                users=users,
                financial_centers=financial_centers,
                cost_centers=cost_centers,
                row_types=row_types,
                nomenclatures=nomenclatures,
            ).form()

        with report:
            Forms.Report(
                users=users,
                financial_centers=financial_centers,
                cost_centers=cost_centers,
                row_types=row_types,
                nomenclatures=nomenclatures,
            ).report()

    elif st.session_state["authentication_status"] is False:
        st.error("Логин или пароль не корректный")

    elif st.session_state["authentication_status"] is None:
        st.warning("Введите ваш логин и пароль")
