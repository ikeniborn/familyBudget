

import datetime
from pandas import DataFrame
import pandas as pd
import streamlit as st
# from sql_metadata import Parser
import secrets
import os
from pathlib import Path
import streamlit_authenticator as stauth
import yaml
from yaml.loader import SafeLoader
import pytz
from func.google import GoogleWorksheet,GoogleSpreadsheet,GoogleStorage
from func.duckdb import DuckDb
# from dateutil import parser
import uuid
import hashlib
import plotly.express as px
import locale
locale.setlocale(locale.LC_ALL, "")

st.set_page_config(page_title='Домашний бюджет', page_icon=':book',initial_sidebar_state='collapsed', layout= "centered")

# def df_on_change(df):
#     state = st.session_state["df_editor"]
#     for index, updates in state["edited_rows"].items():
#         st.session_state["df"].loc[st.session_state["df"].index == index, "edited"] = True
#         for key, value in updates.items():
#             st.session_state["df"].loc[st.session_state["df"].index == index, key] = value
            
# db_budget = DuckDb('data/'+os.getenv('GOOGLE_SPREADSHEET_ID')).connect()
# df1=db_budget.select('select try_strptime(operation_dttm, \'%d.%m.%Y %H:%M:%S\') as dttm, * from t_f_trello order by dttm desc limit 10')
# df1["edited"]=False
          
# if "df" not in st.session_state:
#     st.session_state["df"] = df1
# df=st.data_editor(st.session_state["df"], key="df_editor", on_change=df_on_change, args=[df1], hide_index=True,disabled=['id','operation_dttm','financial_center_name'])
# df_fltr = df[df['edited']==True]
# st.write(df_fltr)
# st.write(df_fltr.to_records(index=False).tolist())

# st.stop()

def get_uuid(string:str='-1'):
  hex_string = hashlib.md5(string.encode("UTF-8").lower()).hexdigest()
  return (uuid.UUID(hex=hex_string))

def get_period(shuffle:int=0)-> str:
  dttm = datetime.datetime.now()
  month = dttm.month
  year = dttm.year
  dt = datetime.date(year=year,month=month+shuffle,day=1)
  return dt.strftime('%b %Y')

def budget_period()-> list:
  periods = []
  for num in range(0,2):
    periods.append(get_period(num))
  return periods

def fact_period() -> list:
  periods = []
  for num in range(-1,1):
    periods.append(get_period(num))
  return periods

def report_period() -> list:
  periods = []
  for num in range(-1,2):
    periods.append(get_period(num))
  return periods

file_path_config = Path(__file__).parent / 'config.yaml'

with file_path_config.open('rb') as file:
    config = yaml.load(file, Loader=SafeLoader)
  
authenticator = stauth.Authenticate(
      config['credentials'],
      config['cookie']['name'],
      config['cookie']['key'],
      config['cookie']['expiry_days']
    )

name, authentication_status, username = authenticator.login(location='main',fields={'Form name':'Авторизация'},max_concurrent_users=2)

user_name = username
  
if st.session_state["authentication_status"]:
  
  st.sidebar.title(f'Привет {name}')
  authenticator.logout('Выход', "sidebar")
 
  # reset_password = st.sidebar.button(label='Сброс пароля')
  # if reset_password:
  #   try:
  #       if authenticator.reset_password(st.session_state["user_name"]):
  #           st.success('Password modified successfully')
  #   except Exception as e:
  #       st.error(e)
  
  
        
  backup_db = st.sidebar.button(label='Создать резервную копию')
  if backup_db:
    try:
        GoogleStorage(credential_path=os.getenv('GOOGLE_STORAGE_CREDENTIAL_PATH')).get_storage().upload_file()
    except Exception as e:
        st.error(e)
        
  load_db = st.sidebar.button(label='Загрузить резервную копию')
  if load_db:
    try:
        GoogleStorage(credential_path=os.getenv('GOOGLE_STORAGE_CREDENTIAL_PATH')).get_storage().download_file()
        st.cache_data.clear()
    except Exception as e:
        st.error(e)

  
  db_budget = DuckDb('data/budget.db').connect(read_only=False)
  t_d_financial_center =db_budget.select('select * from t_d_financial_center')['financial_center_name'].to_list()
  t_d_cost_center = db_budget.select('select cost_center_name from t_d_cost_center')['cost_center_name'].drop_duplicates().to_list()
  t_d_nomenclature = db_budget.select('select nomenclature_name,account_name,bill_name,operation_name,is_fact,is_budget from t_d_nomenclature')
  t_d_period = db_budget.select('select period_key, period_dttm, perion_ru_name from t_d_period')
  
  row_type_name=st.selectbox(label='Выбор учета',options=['Факт','Бюджет','Отчетность'],index=None)

  if row_type_name=='Факт':
    
    with st.form(key='fact_form',clear_on_submit=True):
    
      st.info('Поля с * обязательные для заполнения!')
      
      operation_dttm =datetime.datetime.now(tz=pytz.timezone('Europe/Moscow')).strftime('%Y-%m-%d %H:%M:%S.%f')
      period = st.selectbox('Период',options=fact_period(),index=1)
      financial_center_name = st.selectbox(label='ЦФО*',options=t_d_financial_center,index=None)
      cost_center_name = st.selectbox(label='МВЗ',options=t_d_cost_center,index=None)
      if cost_center_name==None:
        cost_center_name = financial_center_name
      df_nomenclature = db_budget.select('select nomenclature_name,account_name,bill_name,operation_name from budget.main.t_d_nomenclature where is_fact=true')
      nomenclature_name = st.selectbox(label='Номенклатура*',options=t_d_nomenclature[t_d_nomenclature['is_fact']==True]['nomenclature_name'].drop_duplicates().to_list(),index=None)
      if nomenclature_name:
        operation_name = df_nomenclature[t_d_nomenclature['nomenclature_name']==nomenclature_name]['operation_name'].values[0]
        bill_name = df_nomenclature[t_d_nomenclature['nomenclature_name']==nomenclature_name]['bill_name'].values[0]
        account_name = df_nomenclature[t_d_nomenclature['nomenclature_name']==nomenclature_name]['account_name'].values[0]
      else:
        operation_name=''
        bill_name = ''
        account_name=''
      cost_sum = st.number_input(label='Сумма*',min_value=0,value=0)
      comment_description = st.text_input(label='Комментарий')
      created_dttm = datetime.datetime.now(tz=pytz.timezone('Europe/Moscow')).strftime('%Y-%m-%d %H:%M:%S.%f')
      updated_dttm = datetime.datetime.now(tz=pytz.timezone('Europe/Moscow')).strftime('%Y-%m-%d %H:%M:%S.%f')
        
      add_row = st.form_submit_button(label="Сохранить",type='primary')
      
      if add_row:
        if cost_sum>0 and financial_center_name!=None and nomenclature_name!=None:
          registry_nkey = f'{operation_dttm}#{period}#{financial_center_name}#{cost_center_name}#{nomenclature_name}#{row_type_name}#{user_name}'
          registry_key = get_uuid(string=registry_nkey)
          
          sql_row = f'''
            INSERT INTO t_f_registry (registry_key,operation_dttm,period,financial_center_name,cost_center_name,nomenclature_name,cost_sum,comment_description,row_type_name,user_name) 
            VALUES (
                \'{registry_key}\',
                \'{operation_dttm}\',
                \'{period}\',
                \'{financial_center_name}\',
                \'{cost_center_name}\',
                \'{nomenclature_name}\',
                {cost_sum},
                \'{comment_description}\',
                \'{row_type_name}\',
                \'{user_name}\'
              )
            '''
          db_budget.insert(sql=sql_row)
          st.info('Последние пять записей:')
          st.dataframe(data=db_budget.select(
              f'''
              select 
                operation_dttm as "Дата операции", 
                period as "Период", 
                financial_center_name as "ЦФО",
                cost_center_name as "МВЗ",
                nomenclature_name as "Номенклатура",
                cost_sum as "Сумма", 
                comment_description as "Комментарий" 
              from t_f_registry t 
              where 
                t.user_name = \'{user_name}\' 
                and t.row_type_name = \'{row_type_name}\' 
              order by 
                operation_dttm desc 
              limit 5'''
            ),hide_index=True, use_container_width=True)
          df= db_budget.select(
            f'''
              select 
                row_type_name as "Тип", 
                nomenclature_name as "Статья", 
                sum(cost_sum) as "Сумма" 
              from 
                t_f_registry t 
              where 
                t.financial_center_name=\'{financial_center_name}\' 
                and t.period=\'{period}\' 
                and t.nomenclature_name=\'{nomenclature_name}\' 
              group by 
                row_type_name, 
                nomenclature_name 
              order by 
                row_type_name
              '''
            )
          fig = px.bar(df, x='Статья', y='Сумма', color='Тип', barmode='group')
          st.plotly_chart(fig, use_container_width=True)
        else:
          if financial_center_name==None:
            st.error('Не указан ЦФО')
          if nomenclature_name==None:
            st.error('Не указана Номенклатура')
          if cost_sum==0:
            st.error('Не указана Сумма')

  elif row_type_name=='Бюджет':
    
    with st.form(key='budget_form',clear_on_submit=True):
    
      st.info('Поля со * обязательные для заполнения!')
      operation_dttm =datetime.datetime.now(tz=pytz.timezone('Europe/Moscow')).strftime('%d.%m.%Y %H:%M:%S')
      period_dttm = st.selectbox('Период',options=budget_period(),index=1)
      financial_center_name = st.selectbox(label='ЦФО*',options=t_d_financial_center,index=None)
      cost_center_name = financial_center_name
      nomenclature_name = st.selectbox(label='Номенклатура*',options=t_d_nomenclature[t_d_nomenclature['is_budget']]['nomenclature_name'].drop_duplicates().to_list(),index=None)
      if nomenclature_name:
        operation_name = t_d_nomenclature[t_d_nomenclature['nomenclature_name']==nomenclature_name]['operation_name'].values[0]
        bill_name = t_d_nomenclature[t_d_nomenclature['nomenclature_name']==nomenclature_name]['bill_name'].values[0]
        account_name = t_d_nomenclature[t_d_nomenclature['nomenclature_name']==nomenclature_name]['account_name'].values[0]
      else:
        operation_name=''
        bill_name = ''
        account_name=''
      cost_sum = st.number_input(label='Сумма*',min_value=0,value=0)
      comment_description = st.text_input(label='Комментарий')
      created_dttm = datetime.datetime.now()
      updated_dttm = datetime.datetime.now()
      
      def submit_add_row():
          registry_nkey = f'{operation_dttm}#{period}#{financial_center_name}#{cost_center_name}#{nomenclature_name}#{row_type_name}#{user_name}'
          registry_key = get_uuid(string=registry_nkey)
          sql_row = f'''
            INSERT INTO t_f_registry (registry_key,operation_dttm,period,financial_center_name,cost_center_name,nomenclature_name,cost_sum,comment_description,row_type_name,user_name,created_dttm,updated_dttm) 
            VALUES (
                \'{registry_key}\',
                \'{operation_dttm}\',
                \'{period}\',
                \'{financial_center_name}\',
                \'{cost_center_name}\',
                \'{nomenclature_name}\',
                {cost_sum},
                \'{comment_description}\',
                \'{row_type_name}\',
                \'{user_name}\',
                \'{created_dttm}\',
                \'{updated_dttm}\'
              )
            '''
          db_budget.insert(sql=sql_row)
          st.info('Последние пять записей:')
          st.dataframe(data=db_budget.select(
              f'''
              select 
                operation_dttm as "Дата операции", 
                period as "Период", 
                financial_center_name as "ЦФО",
                cost_center_name as "МВЗ",
                nomenclature_name as "Номенклатура",
                cost_sum as "Сумма", 
                comment_description as "Комментарий" 
              from t_f_registry t 
              where 
                t.user_name = \'{user_name}\' 
                and t.row_type_name = \'{row_type_name}\' 
              order by 
                operation_dttm desc 
              limit 5'''
            ),hide_index=True, use_container_width=True)
     
      add_row = st.form_submit_button(label="Сохранить",type='secondary')
      
      if add_row:
        if cost_sum>0 and financial_center_name!=None and nomenclature_name!=None:
          submit_add_row()
        else:
          if financial_center_name==None:
            st.error('Не указан ЦФО')
          if nomenclature_name==None:
            st.error('Не указана Номенклатура')
          if cost_sum==0:
            st.error('Не указана Сумма')
          
  elif row_type_name=='Отчетность':      
    report_selector=st.selectbox(label='Выбор отчета',options=['План/Факт','Бюджет','Последние записи'],index=None) 
    if report_selector in ['План/Факт','Бюджет']:
      financial_center_name = st.selectbox(label='ЦФО*',options=t_d_financial_center,index=None)
      period = st.selectbox('Период',options=report_period(),index=1)
      if financial_center_name and report_selector:
        if report_selector=='Бюджет':
            total = db_budget.select(f'select sum(sum) as "Сумма" from t_f_trello  t where t.financial_center_name=\'{financial_center_name}\' and t.period=\'{period}\' and t.data_type = \'Бюджет\'')['Сумма'].values[0]
            st.write(f'Итого бюджет на {period} составляет {total} руб.')
            df= db_budget.select(f'select account_name as "Статья",sum(sum) as "Сумма" from t_f_trello  t where t.financial_center_name=\'{financial_center_name}\' and t.period=\'{period_dttm}\' and t.data_type = \'Бюджет\' group by account_name order by account_name')
            st.bar_chart(data=df,x='Статья',y='Сумма')
        elif report_selector=='План/Факт':
          if financial_center_name:
            grouping = st.selectbox(label='Группировка',options=['Операция','Счет','Статья','Номенклатура'],index=2) 
            ## Add a select box for choosing the chart type
            # chart_type = st.selectbox('Choose a chart type', ['Bar', 'Line'])
            chart_type = 'Bar'
            if grouping=='Операция':
              df= db_budget.select(f'select row_type_name as "Тип", operation_name as "Операция", sum(sum) as "Сумма" from t_f_trello  t where t.financial_center_name=\'{financial_center_name}\' and t.period=\'{period_dttm}\'group by row_type_name, operation_name order by data_type, operation_name')
              ## Create the chart
              if chart_type == 'Bar':
                  fig = px.bar(df, x='Операция', y='Сумма', color='Тип', barmode='group')
              elif chart_type == 'Line':
                  fig = px.line(df, x='Операция', y='Сумма', color='Тип')
              ## Display the chart
              st.plotly_chart(fig, use_container_width=True)
            elif grouping=='Счет':
              df= db_budget.select(f'select data_type as "Тип", bill_name as "Счет", sum(sum) as "Сумма" from t_f_trello  t where t.financial_center_name=\'{financial_center_name}\' and t.period=\'{period_dttm}\'group by data_type, bill_name order by data_type, bill_name')
              ## Create the chart
              if chart_type == 'Bar':
                  fig = px.bar(df, x='Счет', y='Сумма', color='Тип', barmode='group')
              elif chart_type == 'Line':
                  fig = px.line(df, x='Счет', y='Сумма', color='Тип')
              ## Display the chart
              st.plotly_chart(fig, use_container_width=True)
            elif grouping=='Статья':
              df= db_budget.select(f'select data_type as "Тип", account_name as "Статья", sum(sum) as "Сумма" from t_f_trello  t where t.financial_center_name=\'{financial_center_name}\' and t.period=\'{period_dttm}\'group by data_type, account_name order by data_type, account_name')
                            ## Create the chart
              if chart_type == 'Bar':
                  fig = px.bar(df, x='Статья', y='Сумма', color='Тип', barmode='group')
              elif chart_type == 'Line':
                  fig = px.line(df, x='Статья', y='Сумма', color='Тип')
              ## Display the chart
              st.plotly_chart(fig, use_container_width=True)
            elif grouping=='Номенклатура':
              df= db_budget.select(f'select data_type as "Тип", nomenclature_name as "Номенклатура", sum(sum) as "Сумма" from t_f_trello  t where t.financial_center_name=\'{financial_center_name}\' and t.period=\'{period_dttm}\'group by data_type, nomenclature_name order by data_type, nomenclature_name')
              ## Create the chart
              if chart_type == 'Bar':
                  fig = px.bar(df, x='Номенклатура', y='Сумма', color='Тип', barmode='group')
              elif chart_type == 'Line':
                  fig = px.line(df, x='Номенклатура', y='Сумма', color='Тип')
              ## Display the chart
              st.plotly_chart(fig, use_container_width=True)
            else:
              pass
    elif report_selector=='Последние записи':
      number_limit = st.number_input('Количество записей', min_value=5)
      if number_limit:
        st.dataframe(data=db_budget.select(
              f'''
              select 
                operation_dttm as "Дата операции", 
                period as "Период", 
                financial_center_name as "ЦФО",
                cost_center_name as "МВЗ",
                nomenclature_name as "Номенклатура",
                cost_sum as "Сумма", 
                comment_description as "Комментарий" 
              from t_f_registry t 
              where 
                t.user_name = \'{user_name}\' 
                and t.row_type_name = \'{row_type_name}\' 
              order by 
                operation_dttm desc 
              limit {number_limit}'''
            ),hide_index=True, use_container_width=True)
      
  else:
    st.stop()
  
elif st.session_state["authentication_status"] is False:
  st.error('Логин или пароль не корректный')
  
elif st.session_state["authentication_status"] is None:
  st.warning('Введите ваш логин и пароль')



