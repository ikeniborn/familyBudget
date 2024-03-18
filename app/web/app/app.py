

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
from func.google import GoogleWorksheet,GoogleSpreadsheet
from func.duckdb import DuckDb
# from dateutil import parser
import uuid
import hashlib
import plotly.express as px

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
# df=st.data_editor(st.session_state["df"], key="df_editor", on_change=df_on_change, args=[df1], hide_index=True,disabled=['id','operation_dttm','cfo'])
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
  return dt.strftime('%d.%m.%Y')

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
  
if st.session_state["authentication_status"]:
  
  st.sidebar.title(f'Привет {name}')
  authenticator.logout('Выход', "sidebar")
 
  # reset_password = st.sidebar.button(label='Сброс пароля')
  # if reset_password:
  #   try:
  #       if authenticator.reset_password(st.session_state["username"]):
  #           st.success('Password modified successfully')
  #   except Exception as e:
  #       st.error(e)
  
  def truncate_time(freq:str = 'second', period=1 ):
    if freq=='second':
      if period>59:
        period=59
      d = datetime.datetime.now().replace(second=period).strftime('%d.%m.%Y %H:%M:%S')
    elif freq=='minute':
      if period>59:
        period=59
      d = datetime.datetime.now().replace(minute=period,second=0).strftime('%d.%m.%Y %H:%M:%S')
    elif freq=='hour':
      if period>23:
        period=0
      d = datetime.datetime.now().replace(hour=period,minute=0,second=0).strftime('%d.%m.%Y %H:%M:%S')
    elif freq=='day':
      d = datetime.datetime.now().replace(day=period).strftime('%d.%m.%Y')
    elif freq=='month':
      if period>12:
        period=12
      d = datetime.datetime.now().replace(month=period,day=1).strftime('%d.%m.%Y')
    return d
  
        
  update_cache = st.sidebar.button(label='Обновить даннные')
  if update_cache:
    try:
        st.cache_data.clear()
        ss_budget = GoogleSpreadsheet(spreadsheet_id=os.getenv('GOOGLE_SPREADSHEET_ID'),credential=os.getenv('GOOGLE_CREDENTIAL_PATH')).get_spreadsheet()
        ws_t_f_trello = GoogleWorksheet(spreadsheet=ss_budget, worksheet_name='t_f_trello').get_worksheet().read(dummy_time=truncate_time(freq='second'),ttl=3600)
        ws_t_d_financial_center = GoogleWorksheet(spreadsheet=ss_budget,worksheet_name='t_d_financial_center').get_worksheet().read(dummy_time=truncate_time(freq='second'),ttl=3600)
        ws_t_d_cost_center = GoogleWorksheet(spreadsheet=ss_budget,worksheet_name='t_d_cost_center').get_worksheet().read(dummy_time=truncate_time(freq='second'),ttl=3600)
        ws_t_d_accounting_item = GoogleWorksheet(spreadsheet=ss_budget,worksheet_name='t_d_accounting_item').get_worksheet().read(dummy_time=truncate_time(freq='second'),ttl=3600)

    except Exception as e:
        st.error(e)

  def update_session_key():
    if 'value' not in st.session_state:
      st.session_state.value = 0
    else:
      st.session_state.value = 0
    if 'nomenclature' not in st.session_state:
      st.session_state.nomenclature = None
    else:
      st.session_state.nomenclature = None
    if 'id' not in st.session_state:
      st.session_state.id = None
    else:
      st.session_state.id = None
    if 'cfo' not in st.session_state:
      st.session_state.cfo = None

  # ss_budget = GoogleSpreadsheet(spreadsheet_id=os.getenv('GOOGLE_SPREADSHEET_ID'),credential=os.getenv('GOOGLE_CREDENTIAL_PATH')).get_spreadsheet()
  
  db_budget = DuckDb('data/'+os.getenv('GOOGLE_SPREADSHEET_ID')).connect()

  # ws_t_f_trello = GoogleWorksheet(spreadsheet=ss_budget, worksheet_name='t_f_trello').get_worksheet()
  # ws_t_d_financial_center = GoogleWorksheet(spreadsheet=ss_budget,worksheet_name='t_d_financial_center').get_worksheet()
  # ws_t_d_cost_center = GoogleWorksheet(spreadsheet=ss_budget,worksheet_name='t_d_cost_center').get_worksheet()
  # ws_t_d_accounting_item = GoogleWorksheet(spreadsheet=ss_budget,worksheet_name='t_d_accounting_item').get_worksheet()

  # df_t_d_financial_center = ws_t_d_financial_center.read(dummy_time=truncate_time(freq='day'),ttl=3600).worksheet_data
  # df_t_d_cost_center = ws_t_d_cost_center.read(dummy_time=truncate_time(freq='day'),ttl=3600).worksheet_data
  # df_t_d_accounting_item = ws_t_d_accounting_item.read(dummy_time=truncate_time(freq='day'),ttl=3600).worksheet_data
  # df_t_f_trello = ws_t_f_trello.read(dummy_time=truncate_time(freq='hour'),ttl=3600)
  
  form_selector=st.selectbox(label='Выбор учета',options=['Факт','Бюджет','Отчетность'],index=None)
  

  if form_selector=='Факт':
    
    with st.form(key='fact_form',clear_on_submit=True):
    
      st.info('Поля с * обязательные для заполнения!')
      
      update_session_key()
      operation_dttm =datetime.datetime.now(tz=pytz.timezone('Europe/Moscow')).strftime('%d.%m.%Y %H:%M:%S')
      period_dttm = st.selectbox('Период',options=fact_period(),index=1)
      st.session_state.cfo = st.selectbox(label='ЦФО*',options=db_budget.select('select * from t_d_financial_center')['name'].to_list(),index=None)
      mvz_select = st.selectbox(label='МВЗ',options=db_budget.select('select * from t_d_cost_center')['name'].drop_duplicates().to_list(),index=None)
      if mvz_select==None:
        mvz = st.session_state.cfo
      else:
        mvz = mvz_select
      df_nomenclature = db_budget.select('select * from t_d_accounting_item where fact=1')
      st.session_state.nomenclature = st.selectbox(label='Номенклатура*',options=df_nomenclature['nomenclature'].drop_duplicates().to_list(),index=None)
      if st.session_state.nomenclature:
        operation = df_nomenclature[df_nomenclature['nomenclature']==st.session_state.nomenclature]['operation'].values[0]
        bill = df_nomenclature[df_nomenclature['nomenclature']==st.session_state.nomenclature]['bill'].values[0]
        account = df_nomenclature[df_nomenclature['nomenclature']==st.session_state.nomenclature]['account'].values[0]
      else:
        operation=''
        bill = ''
        account=''
      st.session_state.value = st.number_input(label='Сумма*',min_value=0,value=0)
      comment = st.text_input(label='Комментарий')
      st.session_state.id = secrets.token_hex(16)
      
      new_row = DataFrame.from_dict({
            'Дата операции':[operation_dttm],
            'Период':[period_dttm],
            'ЦФО':[st.session_state.cfo],
            'МВЗ':[mvz],
            'Операция':[operation],
            'Счет':[bill],
            'Статья':[account],
            'Номенклатура':[st.session_state.nomenclature],
            'Сумма':[st.session_state.value],
            'Комментарий':[comment],
            'ИД':[st.session_state.id],
            'Тип':[form_selector],
            'Пользователь':[username],
          },orient='columns').astype({
            'Дата операции':str,
            'Период':str,
            'ЦФО':str,
            'МВЗ':str,
            'Операция':str,
            'Счет':str,
            'Статья':str,
            'Номенклатура':str,
            'Сумма':int,
            'Комментарий':str,
            'ИД':str,
            'Тип':str,
            'Пользователь':str,
            })
       
      def submit_add_row():
          ss_budget = GoogleSpreadsheet(spreadsheet_id=os.getenv('GOOGLE_SPREADSHEET_ID'),credential=os.getenv('GOOGLE_CREDENTIAL_PATH')).get_spreadsheet()
          ws_t_f_trello = GoogleWorksheet(spreadsheet=ss_budget, worksheet_name='t_f_trello').get_worksheet()
          ws_t_f_trello.worksheet_object.append_rows(new_row.to_records(index=False).tolist())
          db_budget.insert(dataframe=new_row,worksheet_name='t_f_trello')
          st.info('Последние пять записей:')
          st.dataframe(data=db_budget.select(f'select operation_dttm as "Дата операции", period as "Период", cfo as "ЦФО", mvz as "МВЗ",nomenclature as "Номенклатура",sum as "Сумма", comment as "Комментарий" from t_f_trello  t where t.username = \'{username}\' and t.data_type = \'{form_selector}\' order by try_strptime(operation_dttm, \'%d.%m.%Y %H:%M:%S\') desc limit 5'),hide_index=True, use_container_width=True)
          df= db_budget.select(f'select data_type as "Тип", account as "Статья", sum(sum) as "Сумма" from t_f_trello  t where t.cfo=\'{st.session_state.cfo}\' and t.period=\'{period_dttm}\' and t.account=\'{account}\' group by data_type, account order by data_type')
          fig = px.bar(df, x='Статья', y='Сумма', color='Тип', barmode='group')
          st.plotly_chart(fig, use_container_width=True)
          update_session_key()
              
      add_row = st.form_submit_button(label="Сохранить",on_click=update_session_key,type='secondary')
            
      
      if add_row:
        if st.session_state.value>0 and st.session_state.cfo!=None and st.session_state.nomenclature!=None:
          submit_add_row()
        else:
          if st.session_state.cfo==None:
            st.error('Не указан ЦФО')
          if st.session_state.nomenclature==None:
            st.error('Не указана Номенклатура')
          if st.session_state.value==0:
            st.error('Не указана Сумма')

  elif form_selector=='Бюджет':
    
    with st.form(key='budget_form',clear_on_submit=True):
    
      st.info('Поля со * обязательные для заполнения!')
      operation_dttm =datetime.datetime.now(tz=pytz.timezone('Europe/Moscow')).strftime('%d.%m.%Y %H:%M:%S')
      period_dttm = st.selectbox('Период',options=budget_period(),index=1)
      st.session_state.cfo = st.selectbox(label='ЦФО*',options=db_budget.select('select * from t_d_financial_center')['name'].to_list(),index=None)
      mvz = st.session_state.cfo
      df_nomenclature = db_budget.select('select * from t_d_accounting_item where budget=1')
      st.session_state.nomenclature = st.selectbox(label='Номенклатура*',options=df_nomenclature['nomenclature'].drop_duplicates().to_list(),index=None)
      if st.session_state.nomenclature:
        operation = df_nomenclature[df_nomenclature['nomenclature']==st.session_state.nomenclature]['operation'].values[0]
        bill = df_nomenclature[df_nomenclature['nomenclature']==st.session_state.nomenclature]['bill'].values[0]
        account = df_nomenclature[df_nomenclature['nomenclature']==st.session_state.nomenclature]['account'].values[0]
      else:
        operation=''
        bill = ''
        account=''
      st.session_state.value = st.number_input(label='Сумма*',min_value=0,value=0)
      comment = st.text_input(label='Комментарий')
      st.session_state.id = secrets.token_hex(16)
      
      new_row = DataFrame.from_dict({
            'Дата операции':[operation_dttm],
            'Период':[period_dttm],
            'ЦФО':[st.session_state.cfo],
            'МВЗ':[mvz],
            'Операция':[operation],
            'Счет':[bill],
            'Статья':[account],
            'Номенклатура':[st.session_state.nomenclature],
            'Сумма':[st.session_state.value],
            'Комментарий':[comment],
            'ИД':[st.session_state.id],
            'Тип':[form_selector],
            'Пользователь':[username],
          },orient='columns').astype({
            'Дата операции':str,
            'Период':str,
            'ЦФО':str,
            'МВЗ':str,
            'Операция':str,
            'Счет':str,
            'Статья':str,
            'Номенклатура':str,
            'Сумма':int,
            'Комментарий':str,
            'ИД':str,
            'Тип':str,
            'Пользователь':str,
            })
       
      def submit_add_row():
          ss_budget = GoogleSpreadsheet(spreadsheet_id=os.getenv('GOOGLE_SPREADSHEET_ID'),credential=os.getenv('GOOGLE_CREDENTIAL_PATH')).get_spreadsheet()
          ws_t_f_trello = GoogleWorksheet(spreadsheet=ss_budget, worksheet_name='t_f_trello').get_worksheet()
          ws_t_f_trello.worksheet_object.append_rows(new_row.to_records(index=False).tolist())
          db_budget.insert(dataframe=new_row,worksheet_name='t_f_trello')
          st.info('Последние пять записей:')
          st.dataframe(data=db_budget.select(f'select operation_dttm as "Дата операции", period as "Период", cfo as "ЦФО",nomenclature as "Номенклатура",sum as "Сумма", comment as "Комментарий" from t_f_trello  t where t.data_type = \'{form_selector}\' order by try_strptime(operation_dttm, \'%d.%m.%Y %H:%M:%S\') desc limit 5'),hide_index=True, use_container_width=True)
     
      add_row = st.form_submit_button(label="Сохранить",on_click=update_session_key,type='secondary')
      
      if add_row:
        if st.session_state.value>0 and st.session_state.cfo!=None and st.session_state.nomenclature!=None:
          submit_add_row()
        else:
          if st.session_state.cfo==None:
            st.error('Не указан ЦФО')
          if st.session_state.nomenclature==None:
            st.error('Не указана Номенклатура')
          if st.session_state.value==0:
            st.error('Не указана Сумма')
          update_session_key()
          

        
  elif form_selector=='Отчетность':      
    report_selector=st.selectbox(label='Выбор отчета',options=['План/Факт','Бюджет','Последние записи'],index=None) 
    if report_selector in ['План/Факт','Бюджет']:
      cfo = st.selectbox(label='ЦФО*',options=db_budget.select('select * from t_d_financial_center')['name'].to_list(),index=None)
      period_dttm = st.selectbox('Период',options=report_period(),index=1)
      if cfo and report_selector:
        if report_selector=='Бюджет':
            total = db_budget.select(f'select sum(sum) as "Сумма" from t_f_trello  t where t.cfo=\'{cfo}\' and t.period=\'{period_dttm}\' and t.data_type = \'Бюджет\'')['Сумма'].values[0]
            st.write(f'Итого бюджет на {period_dttm} по цфо составляет {total} руб.')
            df= db_budget.select(f'select account as "Статья",sum(sum) as "Сумма" from t_f_trello  t where t.cfo=\'{cfo}\' and t.period=\'{period_dttm}\' and t.data_type = \'Бюджет\' group by account order by account')
            st.bar_chart(data=df,x='Статья',y='Сумма')
        elif report_selector=='План/Факт':
          if cfo:
            grouping = st.selectbox(label='Группировка',options=['Операция','Счет','Статья','Номенклатура'],index=2) 
            ## Add a select box for choosing the chart type
            # chart_type = st.selectbox('Choose a chart type', ['Bar', 'Line'])
            chart_type = 'Bar'
            if grouping=='Операция':
              df= db_budget.select(f'select data_type as "Тип", operation as "Операция", sum(sum) as "Сумма" from t_f_trello  t where t.cfo=\'{cfo}\' and t.period=\'{period_dttm}\'group by data_type, operation order by data_type, operation')
              ## Create the chart
              if chart_type == 'Bar':
                  fig = px.bar(df, x='Операция', y='Сумма', color='Тип', barmode='group')
              elif chart_type == 'Line':
                  fig = px.line(df, x='Операция', y='Сумма', color='Тип')
              ## Display the chart
              st.plotly_chart(fig, use_container_width=True)
            elif grouping=='Счет':
              df= db_budget.select(f'select data_type as "Тип", bill as "Счет", sum(sum) as "Сумма" from t_f_trello  t where t.cfo=\'{cfo}\' and t.period=\'{period_dttm}\'group by data_type, bill order by data_type, bill')
              ## Create the chart
              if chart_type == 'Bar':
                  fig = px.bar(df, x='Счет', y='Сумма', color='Тип', barmode='group')
              elif chart_type == 'Line':
                  fig = px.line(df, x='Счет', y='Сумма', color='Тип')
              ## Display the chart
              st.plotly_chart(fig, use_container_width=True)
            elif grouping=='Статья':
              df= db_budget.select(f'select data_type as "Тип", account as "Статья", sum(sum) as "Сумма" from t_f_trello  t where t.cfo=\'{cfo}\' and t.period=\'{period_dttm}\'group by data_type, account order by data_type, account')
                            ## Create the chart
              if chart_type == 'Bar':
                  fig = px.bar(df, x='Статья', y='Сумма', color='Тип', barmode='group')
              elif chart_type == 'Line':
                  fig = px.line(df, x='Статья', y='Сумма', color='Тип')
              ## Display the chart
              st.plotly_chart(fig, use_container_width=True)
            elif grouping=='Номенклатура':
              df= db_budget.select(f'select data_type as "Тип", nomenclature as "Номенклатура", sum(sum) as "Сумма" from t_f_trello  t where t.cfo=\'{cfo}\' and t.period=\'{period_dttm}\'group by data_type, nomenclature order by data_type, nomenclature')
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
        st.dataframe(data=db_budget.select(f'select try_strptime(operation_dttm, \'%d.%m.%Y %H:%M:%S\') as "Дата операции", period as "Период", cfo as "ЦФО",nomenclature as "Номенклатура",sum as "Сумма", comment as "Комментарий" from t_f_trello  t order by try_strptime(operation_dttm, \'%d.%m.%Y %H:%M:%S\') desc limit \'{number_limit}\''),hide_index=True)
      
  else:
    st.stop()
  
elif st.session_state["authentication_status"] is False:
  st.error('Логин или пароль не корректный')
  
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