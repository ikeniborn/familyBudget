import os
from pathlib import Path
import streamlit as st
import streamlit_authenticator as stauth
import streamlit.components.v1 as components

import yaml
from yaml.loader import SafeLoader
from src.function import *

# from src.google_auth2 import google_auth

# from st_on_hover_tabs import on_hover_tabs
# from streamlit_pills import pills

# from func.google import GoogleStorage
# from func.duckdb import DuckDb
from src.postgres import Postgres
import src.home.fact as fact
import src.home.budget as budget
import src.home.report as report
import src.home.edit as edit
import secrets
from streamlit_telegram_login import TelegramLoginWidgetComponent

# import pyotp
# import qrcode
# import io
# from streamlit_oauth import OAuth2Component

# import base64
# import json
# import google


def login():
    file_path_config = Path(__file__).parent / "config.yaml"

    with file_path_config.open("rb") as file:
        config = yaml.load(file, Loader=SafeLoader)

    authenticator = stauth.Authenticate(
        config["credentials"], config["cookie"]["name"], config["cookie"]["key"], config["cookie"]["expiry_days"]
    )

    result_auth = authenticator.login(
        location="main",
        fields={"Form name": "Авторизация", "Username": "Логин", "Password": "Пароль", "Login": "Вход"},
        max_concurrent_users=2,
    )

    if st.session_state["authentication_status"]:

        st.sidebar.title(f"Привет {result_auth[0]}")
        authenticator.logout("Выход", "sidebar")

        user_name = result_auth[2]

        connection_db = Postgres(
            host=os.getenv("BUDGET_POSTGRES_HOST"),
            port=os.getenv("BUDGET_POSTGRES_PORT"),
            database=os.getenv("BUDGET_POSTGRES_DB"),
            user=os.getenv("BUDGET_POSTGRES_USER"),
            password=os.getenv("BUDGET_POSTGRES_PASSWORD"),
        )

        # t_d_user = connection_db.connect().select(sql="select user_name from t_d_user", ttl=300)

    elif st.session_state["authentication_status"] is False:
        st.error("Логин или пароль не корректный")

    elif st.session_state["authentication_status"] is None:
        st.warning("Введите ваш логин и пароль")


def main():

    # with st.sidebar:
    #     tabs = on_hover_tabs(
    #         tabName=["Dashboard", "Money", "Economy"], iconName=["dashboard", "money", "economy"], default_choice=0
    #     )

    # if tabs == "Dashboard":
    #     st.title("Navigation Bar")
    #     st.write("Name of option is {}".format(tabs))

    # elif tabs == "Money":
    #     st.title("Paper")
    #     st.write("Name of option is {}".format(tabs))

    # elif tabs == "Economy":
    #     st.title("Tom")
    #     st.write("Name of option is {}".format(tabs))

    # selected = pills("Label", ["Option 1", "Option 2", "Option 3"], ["🍀", "🎈", "🌈"])
    # st.write(selected)

    fact_tab, budget_tab, report_tab, edit_tab = st.tabs(["Факт", "Бюджет", "Отчетность", "Просмотр"])

    with fact_tab:
        fact.form(connection_db=connection_db, user_name=result_auth[2])
    with budget_tab:
        budget.form(connection_db=connection_db, user_name=result_auth[2])
    with report_tab:
        report.form(connection_db=connection_db)
    with edit_tab:
        edit.form(connection_db=connection_db)


if __name__ == "__main__":
    st.set_page_config(page_title="Домашний бюджет", page_icon=":book", initial_sidebar_state="collapsed", layout="centered")
    if "state" not in st.session_state:
        st.session_state.state = secrets.token_hex(16)
    if "email" not in st.session_state:
        st.session_state.email = "ikeniborn@gmail.com"

    # login()
    telegram_login = TelegramLoginWidgetComponent(
        bot_username="IkeniGoogleBot", secret_key="806168491:AAE5G1oPobTtfArA0vMOH88S9bqi1EfSrjs"
    )

    # value = telegram_login.button
    # st.write(value)
    def ff():
        components.html(
            html="""
                   <script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-login="IkeniGoogleBot" data-size="small" data-userpic="false" data-auth-url="https://dev.ikeniborn.ru/"></script>
</script>
                    """
        )

    st.button("dfdf", on_click=ff)
    # st.write(st.session_state)
    # with st.container():
    #     col1, col2 = st.columns(2)
    #     with col1:
    #       dt = st.date_input(label="Дата операции", value="today",format="YYYY-MM-DD")
    #     with col2:
    #       tm = st.time_input(label="Время операции", value="now", step=60)
    #     st.write(dt.year)
    #     st.write(tm)
    #     dttm = datetime.datetime(year=dt.year,month=dt.month,day=dt.day,hour=tm.hour,minute=tm.minute,second=0,microsecond=0)
    # st.write(dttm.timestamp())
    # components.iframe(src=google_auth())
