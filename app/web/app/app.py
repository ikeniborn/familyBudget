import os
from pathlib import Path
import streamlit as st
import streamlit_authenticator as stauth
import yaml
from yaml.loader import SafeLoader
# from func.google import GoogleStorage
# from func.duckdb import DuckDb
from src.postgres import Postgres
import src.form.fact as fact
import src.form.budget as budget
import src.form.report as report
import src.form.edit as edit
# import pyotp
# import qrcode
# import io
# from streamlit_oauth import OAuth2Component
# import base64
# import json


def init():

    st.set_page_config(page_title='Домашний бюджет', page_icon=':book',initial_sidebar_state='collapsed', layout= "centered")
    
    file_path_config = Path(__file__).parent / 'config.yaml'

    with file_path_config.open('rb') as file:
      config = yaml.load(file, Loader=SafeLoader)

    authenticator = stauth.Authenticate(
        config['credentials'],
        config['cookie']['name'],
        config['cookie']['key'],
        config['cookie']['expiry_days']
      )
    

    result_auth = authenticator.login(location='main',fields={'Form name':'Авторизация'},max_concurrent_users=2)

    if st.session_state["authentication_status"]:
      
      st.sidebar.title(f'Привет {result_auth[0]}')
      authenticator.logout('Выход', "sidebar")
      connection_db =  Postgres(host=os.getenv('BUDGET_POSTGRES_HOST'),port=os.getenv('BUDGET_POSTGRES_PORT') ,database=os.getenv('BUDGET_POSTGRES_DB'),user=os.getenv('BUDGET_POSTGRES_USER'),password=os.getenv('BUDGET_POSTGRES_PASSWORD'))
      
      fact_tab, budget_tab, report_tab, edit_tab = st.tabs(["Факт", "Бюджет", "Отчетность","Просмотр"])
      
      with fact_tab:
        fact.form(connection_db=connection_db,user_name=result_auth[2])

      with budget_tab:
        budget.form(connection_db=connection_db,user_name=result_auth[2])
        
      with report_tab:
        report.form(connection_db=connection_db)
        
      with edit_tab:
        edit.form(connection_db=connection_db)

    elif st.session_state["authentication_status"] is False:
      st.error('Логин или пароль не корректный')

    elif st.session_state["authentication_status"] is None:
      st.warning('Введите ваш логин и пароль')
  
if __name__ == '__main__':
    init()

