import gspread
from gspread import Worksheet, Spreadsheet
import pandas as pd
import datetime
from delorean import Delorean
import math
from pandas import DataFrame
import streamlit as st
import duckdb
# from sql_metadata import Parser
# from typing import Optional,Union
# import random
# import string
import secrets
# import os
# import pickle
from pathlib import Path
import streamlit_authenticator as stauth
import yaml
from yaml.loader import SafeLoader

# names = ["ilya",'oksana']
# usernames = ["ilya",'oksana']
# file_path = Path(__file__).parent / 'hashed_pw.pkl'
file_path_config = Path(__file__).parent / 'config.yaml'

with file_path_config.open('rb') as file2:
    config = yaml.load(file2, Loader=SafeLoader)
  

# with file_path.open("rb") as file:
#   hashed_passwords = pickle.load(file)
  
  
authenticator = stauth.Authenticate(
      config['credentials'],
      config['cookie']['name'],
      config['cookie']['key'],
      config['cookie']['expiry_days']
    )

name, authentication_status, username = authenticator.login(location='main',fields={'Form name':'Login'})
  
if st.session_state["authentication_status"]:
  
  authenticator.logout('Logout', "sidebar")
  st.sidebar.title(f'Привет {name}')
  reset_password = st.sidebar.button(label='Сброс пароля')
  if reset_password:
    try:
        if authenticator.reset_password(st.session_state["username"]):
            st.success('Password modified successfully')
    except Exception as e:
        st.error(e)

  # CHARACTERS = (
  #     string.ascii_letters
  #     + string.digits
  # )
  # def generate_unique_key():
  #     return ''.join(random.sample(CHARACTERS, 16))
  # print(generate_unique_key())

  def truncate_time(freq:str = 'second' ):
    d = Delorean(datetime.datetime.now(), timezone='US/Pacific')
    return d.truncate(freq).datetime

  # st.write(truncate_time())

  # st.stop()

  SPREADSHEET = '12zOV6GkjmT2eUAQalQCTDP1OXOBCfLOhcBQaXQ4gbUQ'
  CREDENTIAL = '/usr/src/app/secrets/familybudget-317019-797cf157b1ff.json'

  if 'key' not in st.session_state:
      st.session_state.key = secrets.token_hex(16)
      
  class GoogleSpreadsheet:
    'Класс работы с табилцами гугл'
    def __new__(cls, *args, **kwargs):
      return super().__new__(cls)
          
    def __init__(self,spreadsheet_id,credential) -> None:
      self.spreadsheet_id=spreadsheet_id
      self.credential=credential
      self.spreadsheet=None
      self.worksheet=None

    def get_spreadsheet(self,ttl=3600):
      @st.cache_resource(ttl=ttl,show_spinner="Open spreadsheet...")
      def cached_get_spreadsheet(spreadsheet_id,credential) -> Spreadsheet:
        return gspread.service_account(filename=credential).open_by_key(spreadsheet_id)
      self.spreadsheet = cached_get_spreadsheet(self.spreadsheet_id,self.credential)
      return self.spreadsheet
      
  class GoogleWorksheet():
    def __new__(cls, *args, **kwargs):
      return super().__new__(cls)
          
    def __init__(self,spreadsheet,worksheet_name) -> None:
      self.spreadsheet=spreadsheet
      self.worksheet_name=worksheet_name
      self.worksheet:Worksheet=None

    def get_worksheet(self,ttl=3600):
      @st.cache_resource(ttl=ttl,show_spinner=f"Open worksheet {self.worksheet_name}...")
      def cached_get_worksheet(worksheet_name) -> Worksheet:
        return self.spreadsheet.worksheet(worksheet_name)
      self.worksheet=cached_get_worksheet(self.worksheet_name)
      return self

    def read(self,key:str = None, ttl:int=3600, dummy_time:str=truncate_time()):
      @st.cache_data(ttl=ttl,show_spinner=f"Load data from {self.worksheet_name}...")
      def cached_read(_worksheet,key:str, dummy_time:str, worksheet_name) -> DataFrame:
        if key!=None:
          return DataFrame(_worksheet.get_all_records()).dropna(how='all').set_index(keys=key)
        return DataFrame(_worksheet.get_all_records()).dropna(how='all')
      return cached_read(self.worksheet, key, dummy_time,self.worksheet_name)

    def query(self,worksheet:str=None, query:str=None, ttl:int = 3600)-> DataFrame:
      in_memory_db = db_connect()
      _key = None
      if in_memory_db.table(worksheet):
        pass
      else:
        df= self.read(worksheet,_key,)
        create_table_sql = f'CREATE TABLE "{worksheet}" AS SELECT * FROM df'
        in_memory_db.sql(create_table_sql)
      return in_memory_db.sql(query=query).to_df()

  def db_connect(ttl:int=3600):
    @st.cache_resource(ttl=ttl)
    def cached_db_connect():
      return duckdb.connect()
    return cached_db_connect()

  ss_budget = GoogleSpreadsheet(spreadsheet_id=SPREADSHEET,credential=CREDENTIAL).get_spreadsheet()

  ws_t_f_trello = GoogleWorksheet(spreadsheet=ss_budget,worksheet_name='t_f_trello').get_worksheet().worksheet
  ws_t_d_financial_center = GoogleWorksheet(spreadsheet=ss_budget,worksheet_name='t_d_financial_center').get_worksheet()
  ws_t_d_cost_center = GoogleWorksheet(spreadsheet=ss_budget,worksheet_name='t_d_cost_center').get_worksheet()
  ws_t_d_accounting_item = GoogleWorksheet(spreadsheet=ss_budget,worksheet_name='t_d_accounting_item').get_worksheet()

  df_t_d_financial_center = ws_t_d_financial_center.read(dummy_time=truncate_time(freq='hour'))
  df_t_d_cost_center = ws_t_d_cost_center.read(dummy_time=truncate_time(freq='hour'))
  df_t_d_accounting_item = ws_t_d_accounting_item.read(dummy_time=truncate_time(freq='hour'))

  # st.write(df_t_d_financial_center['name'].to_list())

  form_selector=st.selectbox(label='Выбор учета',options=['Факт','Бюджет'],index=None)
  # form_selector2=st.multiselect(label='Выбор учета',options=['Факт','Бюджет','Бюджет2'],default=None)

  if form_selector=='Факт':

    with st.form(key='fact_form',clear_on_submit=True):
      cfo = st.selectbox(label='ЦФО',options=df_t_d_financial_center['name'].to_list())
      mvz = st.selectbox(label='МВЗ',options=df_t_d_cost_center['name'].drop_duplicates().to_list())
      nomenclature = st.selectbox(label='Номенклатура',options=df_t_d_accounting_item['nomenclature'].drop_duplicates().to_list())
      value = st.number_input(label='Сумма',min_value=0)
      comment = st.text_input(label='Комментарий')
      submitted = st.form_submit_button("Сохранить")
      if submitted and value>=0:
        operation_dttm = Delorean(datetime=datetime.datetime.now(), timezone='Etc/GMT+3').truncate('second').format_datetime(format='dd-MM-yyyy HH:mm:ss',locale='ru_RU')
        period_dttm = Delorean(datetime=datetime.datetime.now(), timezone='Etc/GMT+3').truncate('month').format_datetime(format='dd-MM-yyyy',locale='ru_RU')
        # st.write(operation_dttm)
        # st.write(period_dttm)
        new_row = DataFrame([
            operation_dttm,
            period_dttm,
            cfo,
            cfo,
            '',
            '',
            '',
            nomenclature,
            value,
            comment,
            secrets.token_hex(16),
            'Факт',
        ]
        )
        ws_t_f_trello.append_row(new_row[0].tolist())
        # st.write(new_row.to_numpy().tolist())

    # st.write(ws_t_f_trello.read(dummy_time=truncate_time(freq='second')))

  else:
    st.stop()
  
elif st.session_state["authentication_status"] is False:
  st.error('Логин или парль не корректные')
  
elif st.session_state["authentication_status"] is None:
  st.warning('Введите ваш логин и пароль')


# ws_t_d_cost_centerl = get_worksheet(ss_budget,'t_d_cost_center')
# ws_t_d_financial_center = get_worksheet('t_d_financial_center')
# ws_t_d_accounting_item_new = get_worksheet(ss_budget,'t_d_accounting_item_new')

# new_row = pd.array(
#   [
#     datetime.datetime.now().__str__(),
#     datetime.date(2024,1,1).__str__(),
#     'Илья',
#     'Илья',
#     secrets.token_hex(16),
#   ]
# )

# print(new_row.iloc[[0]].to_dict())
# ws_t_f_trello.append_row(new_row.tolist())
# print(new_row.tolist())



# df_t_f_trello = GoogleSheet.read(worksheet='t_f_trello',dummy_time=truncate_time(freq='minute'))
# st.write(df_t_f_trello)
# df_t_d_cost_center = read(ws_t_d_cost_centerl)
# df_t_d_financial_center = read(worksheet='t_d_financial_center',dummy_time=truncate_time(freq='second'))
# st.write(df_t_d_financial_center)
# df_t_d_accounting_item_new = read(ws_t_d_accounting_item_new)

# sum = query('t_f_trello',"select data_type, sum(sum) from t_f_trello group by data_type",60)
# st.write(sum)

# max_id = query('t_d_financial_center',"select max(id) from t_d_financial_center",1)
# st.write(max_id)



# max_id = query(df_t_d_cost_center,"select max(id) from t_d_cost_center")

# st.write(ws_t_d_financial_center)
# st.write(df_t_f_trello)
# st.write(df_t_d_financial_center)

    
# Session State also supports attribute based syntax


# # data = ["John", "Doe", 25]
# # _worksheet().append_rows([[1],[1]])

# # gs.set_timeout(1)


# # max_row=df.max(axis=0)
# print(secrets.token_hex(16))
# print(datetime.datetime.now())
# print(df_t_f_trello['ЦФО']['Семья'])

# print(df['labelColor']['Продукты'])
# print(query('select labelColor,sum(fact) from t_d_accounting_item_new group by labelColor ',df,WORKSHEET,'labelColor'))
# print(Parser('select labelColor,sum(fact) from t_d_accounting_item_new group by labelColor').tables)
# print(df)
# print(max_row['id'])
# sh = gs.open_by_key('12zOV6GkjmT2eUAQalQCTDP1OXOBCfLOhcBQaXQ4gbUQ')

# t_d_accounting_item_data = conn.read(worksheet="t_d_accounting_item_new", usecols=list(range(9)), ttl=5).dropna(how="all")
# val = ws.get_all_records()
# dataframe = pd.DataFrame(worksheet.get_all_records())

# ws.update_cell(1, 2, 'Bingo!')

# print(sh)