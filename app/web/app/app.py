

import datetime
from delorean import Delorean
from pandas import DataFrame
import streamlit as st
from sql_metadata import Parser
import secrets
import os
from pathlib import Path
import streamlit_authenticator as stauth
import yaml
from yaml.loader import SafeLoader
import pytz
from func.google import GoogleWorksheet,GoogleSpreadsheet


st.set_page_config(page_title='Домашний бюджет', page_icon=':book',initial_sidebar_state='collapsed', layout= "centered")

def get_period(form:str=None)-> str:
  dttm = datetime.datetime.now()
  month = dttm.month
  day = dttm.day
  year = dttm.year
  if form=='Бюджет':
    if day>10:
      dt = datetime.date(year=year,month=month+1,day=1)
    else:
      dt = datetime.date(year=year,month=month,day=1)
  elif form=='Факт':
    if day>10:
      dt = datetime.date(year=year,month=month,day=1)
    else:
      dt = datetime.date(year=year,month=month-1,day=1)
  return dt

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
        
  update_cache = st.sidebar.button(label='Обновить даннные')
  if update_cache:
    try:
        st.cache_data.clear()
    except Exception as e:
        st.error(e)

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
  
  def update_session_key():
    st.session_state.key = secrets.token_hex(16)
      
  if 'key' not in st.session_state:
      st.session_state.key = secrets.token_hex(16)

  ss_budget = GoogleSpreadsheet(spreadsheet_id=os.getenv('GOOGLE_SPREADSHEET_ID'),credential=os.getenv('GOOGLE_CREDENTIAL_PATH')).get_spreadsheet()
  
  # st.write(ss_budget)
  # st.stop()

  ws_t_f_trello = GoogleWorksheet(spreadsheet=ss_budget, worksheet_name='t_f_trello').get_worksheet()
  ws_t_d_financial_center = GoogleWorksheet(spreadsheet=ss_budget,worksheet_name='t_d_financial_center').get_worksheet()
  ws_t_d_cost_center = GoogleWorksheet(spreadsheet=ss_budget,worksheet_name='t_d_cost_center').get_worksheet()
  ws_t_d_accounting_item = GoogleWorksheet(spreadsheet=ss_budget,worksheet_name='t_d_accounting_item').get_worksheet()

  df_t_d_financial_center = ws_t_d_financial_center.read(dummy_time=truncate_time(freq='day'),ttl=3600).worksheet_data
  df_t_d_cost_center = ws_t_d_cost_center.read(dummy_time=truncate_time(freq='day'),ttl=3600).worksheet_data
  df_t_d_accounting_item = ws_t_d_accounting_item.read(dummy_time=truncate_time(freq='day'),ttl=3600).worksheet_data
  df_t_f_trello = ws_t_f_trello.read(dummy_time=truncate_time(freq='hour'),ttl=3600)

  form_selector=st.selectbox(label='Выбор учета',options=['Факт','Бюджет','Отчетность'],index=None)

  if form_selector=='Факт':
    
    with st.form(key='fact_form',clear_on_submit=True):
    
      st.info('Поля с * обязательные для заполнения!')
      operation_dttm =datetime.datetime.now(tz=pytz.timezone('Etc/GMT+3')).strftime('%d.%m.%Y %H:%M:%S')
      period_dttm = st.date_input('Период',value=get_period(form_selector),format='DD.MM.YYYY') 
      cfo = st.selectbox(label='ЦФО*',options=df_t_d_financial_center['name'].to_list(),index=None)
      mvz_select = st.selectbox(label='МВЗ',options=df_t_d_cost_center['name'].drop_duplicates().to_list(),index=None)
      if mvz_select==None:
        mvz = cfo
      else:
        mvz = mvz_select
      nomenclature = st.selectbox(label='Номенклатура*',options=df_t_d_accounting_item[df_t_d_accounting_item['fact']==1]['nomenclature'].drop_duplicates().to_list(),index=None)
      if nomenclature:
        operation = df_t_d_accounting_item[df_t_d_accounting_item['nomenclature']==nomenclature]['operation'].values[0]
        bill = df_t_d_accounting_item[df_t_d_accounting_item['nomenclature']==nomenclature]['bill'].values[0]
        account = df_t_d_accounting_item[df_t_d_accounting_item['nomenclature']==nomenclature]['account'].values[0]
      else:
        operation=''
        bill = ''
        account=''
      value = st.number_input(label='Сумма*',min_value=0)
      comment = st.text_input(label='Комментарий')
      row_num = df_t_f_trello.query(f'select max(row_num) from t_f_trello').values[0]+1
      
      new_row = DataFrame.from_dict({
            'Дата операции':[operation_dttm],
            'Период':[period_dttm.strftime('%d.%m.%Y')],
            'ЦФО':[cfo],
            'МВЗ':[mvz],
            'Операция':[operation],
            'Счет':[bill],
            'Статья':[account],
            'Номенклатура':[nomenclature],
            'Сумма':[value],
            'Комментарий':[comment],
            'ИД':[st.session_state.key],
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
              
      def submit_insert():
          ws_t_f_trello.worksheet_object.append_rows(new_row.to_records(index=False).tolist())
          new_row['row_num'] = row_num
          ws_t_f_trello.insert(new_row)
          st.info('Последние пять записей:')
          st.dataframe(data=df_t_f_trello.query(f'select operation_dttm as "Период", period as "Дата операции", cfo as "ЦФО",nomenclature as "Номенклатура",sum as "Сумма", comment as "Комментарий" from t_f_trello  t where t.username = \'{username}\' and t.data_type = \'{form_selector}\' order by row_num desc limit 5'),hide_index=True)
            
      add_row = st.form_submit_button("Сохранить")
      
      if add_row and value>0 and cfo!=None and nomenclature!=None:
        submit_insert()
      else:
        update_session_key()
        
        
  elif form_selector=='Бюджет':
    
    with st.form(key='budget_form',clear_on_submit=True):
    
      st.info('Поля с * обязательные для заполнения!')
      operation_dttm =datetime.datetime.now(tz=pytz.timezone('Etc/GMT+3')).strftime('%d.%m.%Y %H:%M:%S')
      period_dttm = st.date_input('Период',value=get_period(form_selector).replace(day=1),format='DD.MM.YYYY') 
      cfo = st.selectbox(label='ЦФО*',options=df_t_d_financial_center['name'].to_list(),index=None)
      mvz = cfo
      nomenclature = st.selectbox(label='Номенклатура*',options=df_t_d_accounting_item[df_t_d_accounting_item['budget']==1]['nomenclature'].drop_duplicates().to_list(),index=None)
      if nomenclature:
        operation = df_t_d_accounting_item[df_t_d_accounting_item['nomenclature']==nomenclature]['operation'].values[0]
        bill = df_t_d_accounting_item[df_t_d_accounting_item['nomenclature']==nomenclature]['bill'].values[0]
        account = df_t_d_accounting_item[df_t_d_accounting_item['nomenclature']==nomenclature]['account'].values[0]
      else:
        operation=''
        bill = ''
        account=''
      value = st.number_input(label='Сумма*',min_value=0)
      comment = st.text_input(label='Комментарий')
      row_num = df_t_f_trello.query(f'select max(row_num) from t_f_trello').values[0]+1
      
      new_row = DataFrame.from_dict({
            'Дата операции':[operation_dttm],
            'Период':[period_dttm.strftime('%d.%m.%Y')],
            'ЦФО':[cfo],
            'МВЗ':[mvz],
            'Операция':[operation],
            'Счет':[bill],
            'Статья':[account],
            'Номенклатура':[nomenclature],
            'Сумма':[value],
            'Комментарий':[comment],
            'ИД':[st.session_state.key],
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
              
      def submit_insert():
          ws_t_f_trello.worksheet_object.append_rows(new_row.to_records(index=False).tolist())
          new_row['row_num'] = row_num
          ws_t_f_trello.insert(new_row)
          st.info('Последние пять записей:')
          st.dataframe(data=df_t_f_trello.query(f'select operation_dttm as "Период", period as "Дата операции", cfo as "ЦФО",nomenclature as "Номенклатура",sum as "Сумма", comment as "Комментарий", row_num from t_f_trello  t where t.data_type = \'{form_selector}\' order by row_num desc limit 5'),hide_index=True)
            
      add_row = st.form_submit_button("Сохранить")
      
      if add_row and value>0 and cfo!=None and nomenclature!=None:
        submit_insert()
      else:
        update_session_key()  
        
  elif form_selector=='Отчетность':       
    report_selector=st.selectbox(label='Выбор отчета',options=['План/Факт','Бюджет'],index=None)
    if report_selector=='Бюджет':
      period_dttm = st.date_input('Период',value=datetime.datetime.now().replace(day=1),format='DD.MM.YYYY').strftime('%d.%m.%Y')
      cfo = st.selectbox(label='ЦФО*',options=df_t_d_financial_center['name'].to_list(),index=None)
      
      total = df_t_f_trello.query(f'select sum(sum) as "Сумма" from t_f_trello  t where t.cfo=\'{cfo}\' and t.period=\'{period_dttm}\' and t.data_type = \'Бюджет\'')['Сумма'].values[0]
      st.write(f'Итого бюджет на {period_dttm} по цфо составляет {total}')
      df= df_t_f_trello.query(f'select account as "Статья",sum(sum) as "Сумма" from t_f_trello  t where t.cfo=\'{cfo}\' and t.period=\'{period_dttm}\' and t.data_type = \'Бюджет\' group by account order by account')
      st.bar_chart(data=df,x='Статья',y='Сумма')
      
      
      
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