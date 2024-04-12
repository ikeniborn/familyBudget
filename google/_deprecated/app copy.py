import datetime
import streamlit as st
import secrets
import os
from pathlib import Path
import streamlit_authenticator as stauth
import yaml
from yaml.loader import SafeLoader
import pytz
from func.google import GoogleStorage
from func.duckdb import DuckDb
import func.main as main
import uuid
import hashlib
import plotly.express as px
# import pyotp
# import qrcode
# import io
from streamlit_oauth import OAuth2Component
import base64
import json
# from dotenv import load_dotenv
# load_dotenv()

def init():

  st.set_page_config(page_title='Домашний бюджет', page_icon=':book',initial_sidebar_state='collapsed', layout= "centered")

  def _main_update_session():
    main.update_session()

  fact, budget, report = st.columns(3)

  with fact.button(label='Факт',on_click=_main_update_session):
    st.write(st.session_state)

  with budget.button(label='Бюджет',on_click=_main_update_session):
    st.write(st.session_state)
    
  with report.button(label='Отчетность',on_click=_main_update_session):
    st.write(st.session_state)


  
if __name__ == '__main__':
  init()
  


def get_uuid(string:str='-1'):
  hex_string = hashlib.md5(string.encode("UTF-8").lower()).hexdigest()
  return (uuid.UUID(hex=hex_string))
    
db_budget = DuckDb(os.getenv('DATABASE_PATH')).connect(read_only=False,ttl=300,session=st.session_state["session"])
t_d_user = db_budget.select(query='select * from t_d_user',ttl=300)

CLIENT_ID = '41948210916-n4irntth0rq7egqt3njmluv6mkf92gnq.apps.googleusercontent.com'
CLIENT_SECRET = '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'
AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke"

if "auth" not in st.session_state:
    # create a button to start the OAuth2 flow
    oauth2 = OAuth2Component(CLIENT_ID, CLIENT_SECRET, AUTHORIZE_ENDPOINT, TOKEN_ENDPOINT, TOKEN_ENDPOINT, REVOKE_ENDPOINT)
    result = oauth2.authorize_button(
        name="Continue with Google",
        icon="https://www.google.com.tw/favicon.ico",
        redirect_uri="https://budget.ikeniborn.ru",
        scope="openid email profile",
        key="google",
        extras_params={"prompt": "consent", "access_type": "offline"},
        use_container_width=True,
        pkce='S256',
    )
    
    if result:
        st.write(result)
        # decode the id_token jwt and get the user's email address
        id_token = result["token"]["id_token"]
        # verify the signature is an optional step for security
        payload = id_token.split(".")[1]
        # add padding to the payload if needed
        payload += "=" * (-len(payload) % 4)
        payload = json.loads(base64.b64decode(payload))
        email = payload["email"]
        st.session_state["auth"] = email
        user = t_d_user[t_d_user['user_name']==email]['user_name'].values[0] | None
        st.write(user)
        if user:
          pass
        else:
          db_budget.insert(query=f'''
              insert into t_d_user (user_key,user_name,user_password) 
              values 
              (
                \'{get_uuid(string=email)}\',
                \'{email}\',
                '',
                \'{email}\'
              )
              ''')
        st.session_state["token"] = result["token"]
        st.rerun()
else:
    st.write("You are logged in!")
    st.write(st.session_state["auth"])
    st.write(st.session_state["token"])
    if st.button("Logout"):
        del st.session_state["auth"]
        del st.session_state["token"]

st.stop()
# users = {
#     "testuser1": {
#         "email": "testuser1@gmail.com",
#         "name": "Test User1",
#         "password": "abc123" # Replace with hashed password
#     },
#     "testuser2": {
#         "email": "testuser2@gmail.com",
#         "name": "Test User2",
#         "password": "def456" # Replace with hashed password
#     }
# }

# # Create a secret key for each user
# # This key will be used to generate and verify the OTP
# # You can use pyotp.random_base32() to generate a random key
# # You can populate and store it in App's DB after every new user registration
# secrets = {
#     "testuser1": "JBSWY3DPEHPK3PXP",
#     "testuser2": "KR3DJ7X2UIZLK7PV"
# }

# st.title("Streamlit App Demo for MFT using Google Authenticator!")
# # Create tabs
# tabs = st.tabs(["Generate QR", "Verify QR"])

# # Add content to each tab
# with tabs[0]:
#     st.header("Generate QR Code Demo!")
#     username = st.text_input("Enter your username for generating QR")
#     password = st.text_input("Enter your password for generating QR", type="password")
#     if st.button('Generate QR Code for MFT'):
#         if username in users and password == users[username]["password"]:
#             # Generate a QR code for the User
#             # The QR code contains the secret key and the user's email
#             # The user can scan the QR code with the Google Authenticator app
#             # to set up their account
#             qr = qrcode.QRCode()
#             qr.add_data(f"otpauth://totp/{users[username]['email']}?secret={secrets[username]}")
#             qr.make()
#             img = qr.make_image()
#             img_bytes = io.BytesIO()
#             img.save(img_bytes, format='PNG')
#             st.image(img_bytes.getvalue(), caption="Scan this QR code with Google Authenticator")
#         else:
#             st.error("Invalid Credentials")

# with tabs[1]:
#     st.header("Verify QR Code Demo!")
#     verify_username = st.text_input("Enter your username")
#     verify_password = st.text_input("Enter your password", type="password")
#     newotp = st.text_input("Enter your otp")
#     if st.button('Verify QR Code for MFT'):
#         if verify_username in users and verify_password == users[verify_username]["password"]:
#             totp = pyotp.TOTP(secrets[verify_username], interval=30)     
#             if totp.verify(newotp):
#                 # OTP Authentication successful
#                 st.success(f"Welcome, {users[verify_username]['name']}!")
#                 # Continue with the rest of your app logic here
#             else:
#                 # OTP Authentication failed
#                 st.error("Invalid OTP")
#         else:
#             st.error("Invalid Credentials")
            
st.stop()

def get_uuid(string:str='-1'):
  hex_string = hashlib.md5(string.encode("UTF-8").lower()).hexdigest()
  return (uuid.UUID(hex=hex_string))

def get_random_uuid():
  hex_string = secrets.token_hex(16)
  return (uuid.UUID(hex=hex_string))




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
  
  if "state" not in st.session_state:
      st.session_state["state"] = 1
    
  def increment_counter():
    st.session_state.state += 1
    
  def update_session():
    if "session" not in st.session_state:
      st.session_state["session"] = secrets.token_hex(16)

  backup_db = st.sidebar.button(label='Создать резервную копию')
  if backup_db:
    try:
        GoogleStorage(credential_path=os.getenv('GOOGLE_STORAGE_CREDENTIAL_PATH')).get_storage().upload_file()
        update_session()
    except Exception as e:
        st.error(e)
        
  # load_db = st.sidebar.button(label='Загрузить резервную копию')
  # if load_db:
  #   try:
  #       GoogleStorage(credential_path=os.getenv('GOOGLE_STORAGE_CREDENTIAL_PATH')).get_storage().download_file()
  #   except Exception as e:
  #       st.error(e)

  db_budget = DuckDb(os.getenv('DATABASE_PATH')).connect(read_only=False,ttl=300,session=st.session_state["session"])
  t_d_financial_center =db_budget.select(query='select * from t_d_financial_center',ttl=300)
  t_d_cost_center = db_budget.select(query='select * from t_d_cost_center',ttl=300)
  t_d_nomenclature = db_budget.select(query='select * from t_d_nomenclature',ttl=300)
  t_d_period = db_budget.select(query='select * from t_d_period order by period_dt',ttl=300)
  t_d_row_type = db_budget.select(query='select * from t_d_row_type',ttl=300)
  t_d_user = db_budget.select(query='select * from t_d_user',ttl=300)
  user_key = t_d_user[t_d_user['user_name']==username]['user_key'].values[0]

  row_type_name=st.selectbox(label='Выбор операциии',options=['Факт','Бюджет','Отчетность','Последние записи','Корректировка данных'],index=None)

  if row_type_name=='Факт':
    
    with st.form(key='fact_form',clear_on_submit=True):
    
      st.info('Поля с * обязательные для заполнения!')
      
      operation_dttm =datetime.datetime.now(tz=pytz.timezone('Europe/Moscow')).strftime('%Y-%m-%d %H:%M:%S.%f')
      period_ru_name = st.selectbox('Период',options=t_d_period[(t_d_period['period_dt'] >= get_period(-1)) & (t_d_period['period_dt'] <= get_period(0))]['period_ru_name'].to_list(),index=1)
      financial_center_name = st.selectbox(label='ЦФО*',options=t_d_financial_center['financial_center_name'].to_list(),index=None)
      cost_center_name = st.selectbox(label='МВЗ',options=t_d_cost_center['cost_center_name'].to_list(),index=None)
      if cost_center_name==None:
        cost_center_name = financial_center_name
      nomenclature_name = st.selectbox(label='Номенклатура*',options=t_d_nomenclature[t_d_nomenclature['is_fact']==True]['nomenclature_name'].to_list(),index=None)
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
        
      add_row = st.form_submit_button(label="Сохранить",type='primary')
      
      if add_row:
        if cost_sum>0 and financial_center_name!=None and nomenclature_name!=None:
          registry_key = get_random_uuid()
          period_key = t_d_period[t_d_period['period_ru_name']==period_ru_name]['period_key'].values[0]
          financial_center_key = t_d_financial_center[t_d_financial_center['financial_center_name']==financial_center_name]['financial_center_key'].values[0]
          cost_center_key = t_d_cost_center[t_d_cost_center['cost_center_name']==cost_center_name]['cost_center_key'].values[0]
          nomenclature_key = t_d_nomenclature[t_d_nomenclature['nomenclature_name']==nomenclature_name]['nomenclature_key'].values[0]
          row_type_key = t_d_row_type[t_d_row_type['row_type_name']==row_type_name]['row_type_key'].values[0]
          sql_row = f'''
            BEGIN TRANSACTION;
            INSERT INTO t_f_registry (registry_key,operation_dttm,period_key,financial_center_key,cost_center_key,nomenclature_key,cost_sum,comment_description,row_type_key,user_key) 
            VALUES (
                \'{registry_key}\',
                \'{operation_dttm}\',
                \'{period_key}\',
                \'{financial_center_key}\',
                \'{cost_center_key}\',
                \'{nomenclature_key}\',
                {cost_sum},
                \'{comment_description}\',
                \'{row_type_key}\',
                \'{user_key}\'
              );
            COMMIT;
            '''
          db_budget.insert(query=sql_row)
          st.info('Последние пять записей:')
          st.dataframe(data=db_budget.select(
              f'''
              select 
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
              where 
                t0.user_key = \'{user_key}\' 
                and t0.row_type_key = \'{row_type_key}\' 
              order by 
                t0.operation_dttm desc 
              limit 5'''
            ),hide_index=True, use_container_width=True)
          df= db_budget.select(
            f'''
              select 
                t4.row_type_name as "Тип", 
                t3.nomenclature_name as "Статья", 
                sum(cost_sum) as "Сумма" 
              from 
                t_f_registry t0 
              join t_d_financial_center t2 using(financial_center_key) 
              join t_d_nomenclature t3 using(nomenclature_key) 
              join t_d_row_type t4 using(row_type_key) 
              where 
                t0.financial_center_key=\'{financial_center_key}\' 
                and t0.period_key=\'{period_key}\' 
                and t0.nomenclature_key=\'{nomenclature_key}\' 
              group by 
                t4.row_type_name, 
                t3.nomenclature_name
              order by 
                t4.row_type_name
              '''
            )
          fig = px.bar(df, x='Статья', y='Сумма', color='Тип', barmode='group', text_auto=True)
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
    
      st.info('Поля с * обязательные для заполнения!')
      operation_dttm =datetime.datetime.now(tz=pytz.timezone('Europe/Moscow')).strftime('%Y-%m-%d %H:%M:%S.%f')
      period_ru_name = st.selectbox('Период',options=t_d_period[(t_d_period['period_dt'] >= get_period(-1)) & (t_d_period['period_dt'] <= get_period(1))]['period_ru_name'].to_list(),index=1)
      financial_center_name = st.selectbox(label='ЦФО*',options=t_d_financial_center['financial_center_name'].to_list(),index=None)
      cost_center_name = financial_center_name
      nomenclature_name = st.selectbox(label='Номенклатура*',options=t_d_nomenclature[t_d_nomenclature['is_fact']==True]['nomenclature_name'].to_list(),index=None)
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
      
      add_row = st.form_submit_button(label="Сохранить",type='primary')
      
      if add_row:
        if cost_sum>0 and financial_center_name!=None and nomenclature_name!=None:
          registry_key = get_random_uuid()
          period_key = t_d_period[t_d_period['period_ru_name']==period_ru_name]['period_key'].values[0]
          financial_center_key = t_d_financial_center[t_d_financial_center['financial_center_name']==financial_center_name]['financial_center_key'].values[0]
          cost_center_key = t_d_cost_center[t_d_cost_center['cost_center_name']==cost_center_name]['cost_center_key'].values[0]
          nomenclature_key = t_d_nomenclature[t_d_nomenclature['nomenclature_name']==nomenclature_name]['nomenclature_key'].values[0]
          row_type_key = t_d_row_type[t_d_row_type['row_type_name']==row_type_name]['row_type_key'].values[0]
          sql_row = f'''
            BEGIN TRANSACTION;
            INSERT INTO t_f_registry (
              registry_key,
              operation_dttm,
              period_key,
              financial_center_key,
              cost_center_key,
              nomenclature_key,
              cost_sum,
              comment_description,
              row_type_key,
              user_key) 
            VALUES (
                \'{registry_key}\',
                \'{operation_dttm}\',
                \'{period_key}\',
                \'{financial_center_key}\',
                \'{cost_center_key}\',
                \'{nomenclature_key}\',
                {cost_sum},
                \'{comment_description}\',
                \'{row_type_key}\',
                \'{user_key}\'
              );
            COMMIT;
            '''
          db_budget.insert(query=sql_row)
          st.info('Последние пять записей:')
          st.dataframe(data=db_budget.select(
              f'''
              select 
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
              where 
                t0.user_key = \'{user_key}\' 
                and t0.row_type_key = \'{row_type_key}\' 
              order by 
                t0.operation_dttm desc 
              limit 5'''
            ),hide_index=True, use_container_width=True)
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
      financial_center_name = st.selectbox(label='ЦФО*',options=t_d_financial_center['financial_center_name'].to_list(),index=None)
      financial_center_key = None
      if financial_center_name:
        financial_center_key =  t_d_financial_center[t_d_financial_center['financial_center_name']==financial_center_name]['financial_center_key'].values[0]
      period_ru_name = st.selectbox('Период',options=t_d_period[(t_d_period['period_dt'] >= get_period(-1)) & (t_d_period['period_dt'] <= get_period(2))]['period_ru_name'].to_list(),index=1)
      period_key = t_d_period[t_d_period['period_ru_name']==period_ru_name]['period_key'].values[0]
      if financial_center_key and report_selector:
        if report_selector=='Бюджет':
            total = db_budget.select(f'''
              SELECT
                sum(t0.cost_sum) AS "Сумма"
              FROM
                t_f_registry t0
              WHERE
                t0.financial_center_key = \'{financial_center_key}\'
              AND t0.period_key = \'{period_key}\'
              AND t0.row_type_key = \'f003e80f-57d7-6757-bd6a-24170e1f75a4\'
              '''
            )['Сумма'].values[0]
            st.write(f'Итого бюджет на {period_ru_name} составляет {total} руб.')
            df= db_budget.select(f'''
              SELECT
                t1.bill_name AS "Счет",
                t1.account_name AS "Статья",
                sum(t0.cost_sum) AS "Сумма"
              FROM
                t_f_registry t0
              join t_d_nomenclature t1 using(nomenclature_key) 
              WHERE
                t0.financial_center_key = \'{financial_center_key}\'
                AND t0.period_key = \'{period_key}\'
                AND t0.row_type_key = \'f003e80f-57d7-6757-bd6a-24170e1f75a4\'
              GROUP BY
                t1.bill_name,
                t1.account_name
              ORDER BY
                t1.bill_name,
                t1.account_name
                ''')
            fig = px.bar(df, x='Статья', y='Сумма', color='Счет', barmode='group', text_auto=True)
            st.plotly_chart(fig, use_container_width=True)
        elif report_selector=='План/Факт':
          if financial_center_key:
            grouping = st.selectbox(label='Группировка',options=['Операция','Счет','Статья','Номенклатура'],index=2) 
            ## Add a select box for choosing the chart type
            # chart_type = st.selectbox('Choose a chart type', ['Bar', 'Line'])
            chart_type = 'Bar'
            if grouping=='Операция':
              df= db_budget.select(f'''
                SELECT
                  t2.row_type_name AS "Тип",
                  t1.operation_name AS "Операция",
                  sum(t0.cost_sum) AS "Сумма"
                FROM
                  t_f_registry t0
                join t_d_nomenclature t1 using(nomenclature_key)
                join t_d_row_type t2 using(row_type_key)
                WHERE
                  t0.financial_center_key = \'{financial_center_key}\'
                  AND t0.period_key = \'{period_key}\'
                GROUP BY 
                  t2.row_type_name,
	                t1.operation_name
                ORDER BY
                  t2.row_type_name,
	                t1.operation_name
                  ''')
              ## Create the chart
              if chart_type == 'Bar':
                  fig = px.bar(df, x='Операция', y='Сумма', color='Тип', barmode='group', text_auto=True)
              elif chart_type == 'Line':
                  fig = px.line(df, x='Операция', y='Сумма', color='Тип')
              ## Display the chart
              st.plotly_chart(fig, use_container_width=True)
            elif grouping=='Счет':
              df= db_budget.select(f'''
                SELECT
                  t2.row_type_name AS "Тип",
                  t1.bill_name AS "Счет",
                  sum(t0.cost_sum) AS "Сумма"
                FROM
                  t_f_registry t0
                join t_d_nomenclature t1 using(nomenclature_key)
                join t_d_row_type t2 using(row_type_key)
                WHERE
                  t0.financial_center_key = \'{financial_center_key}\'
                  AND t0.period_key = \'{period_key}\'
                GROUP BY row_type_name,
                  t1.bill_name
                ORDER BY
                  t2.row_type_name,
	                t1.bill_name
                  ''')
              ## Create the chart
              if chart_type == 'Bar':
                  fig = px.bar(df, x='Счет', y='Сумма', color='Тип', barmode='group', text_auto=True)
              elif chart_type == 'Line':
                  fig = px.line(df, x='Счет', y='Сумма', color='Тип')
              ## Display the chart
              st.plotly_chart(fig, use_container_width=True)
            elif grouping=='Статья':
              df= db_budget.select(f'''
                SELECT
                  t2.row_type_name AS "Тип",
                  t1.account_name AS "Статья",
                  sum(t0.cost_sum) AS "Сумма"
                FROM
                  t_f_registry t0
                join t_d_nomenclature t1 using(nomenclature_key)
                join t_d_row_type t2 using(row_type_key)
                WHERE
                  t0.financial_center_key = \'{financial_center_key}\'
                  AND t0.period_key = \'{period_key}\'
                GROUP BY row_type_name,
                  t1.account_name
                ORDER BY
                  t2.row_type_name,
	                t1.account_name
                  ''')
              if chart_type == 'Bar':
                  fig = px.bar(df, x='Статья', y='Сумма', color='Тип', barmode='group', text_auto=True)
              elif chart_type == 'Line':
                  fig = px.line(df, x='Статья', y='Сумма', color='Тип')
              ## Display the chart
              st.plotly_chart(fig, use_container_width=True)
            elif grouping=='Номенклатура':
              df= db_budget.select(f'''
                SELECT
                  t2.row_type_name AS "Тип",
                  t1.nomenclature_name AS "Номенклатура",
                  sum(t0.cost_sum) AS "Сумма"
                FROM
                  t_f_registry t0
                join t_d_nomenclature t1 using(nomenclature_key)
                join t_d_row_type t2 using(row_type_key)
                WHERE
                  t0.financial_center_key = \'{financial_center_key}\'
                  AND t0.period_key = \'{period_key}\'
                GROUP BY row_type_name,
                  t1.nomenclature_name
                ORDER BY
                  t2.row_type_name,
	                t1.nomenclature_name
                  ''')
              ## Create the chart
              if chart_type == 'Bar':
                  fig = px.bar(df, x='Номенклатура', y='Сумма', color='Тип', barmode='group', text_auto=True)
              elif chart_type == 'Line':
                  fig = px.line(df, x='Номенклатура', y='Сумма', color='Тип')
              ## Display the chart
              st.plotly_chart(fig, use_container_width=True)
            else:
              pass
  elif row_type_name=='Последние записи':
    number_limit = st.number_input('Количество записей', min_value=5)
    if number_limit:   
      query = f'''
            select 
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
            limit {number_limit}'''
      st.dataframe(data=db_budget.select(query),hide_index=True, use_container_width=True)
  elif row_type_name=='Корректировка данных':
    number_limit = st.number_input('Количество записей', min_value=5)
    
    def last_row(number):  
      query = f'''
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
            limit {number}'''
      return db_budget.select(query)
    if number_limit: 
      def state_table():
          return st.data_editor(data=last_row(number_limit),key=f'df_state_{st.session_state.state}', num_rows = "fixed", hide_index=True)
      table =state_table()
      row_registry_keys = table[table['Удалить']==True]['Идентификатор записи'].to_list()
      delete_button = st.button(label='Удалить',type='primary')
      if row_registry_keys and delete_button:
        update_button = st.button(label='Обновить',type='secondary')
        for row_registry_key in row_registry_keys:
          delete_query=f'''
          BEGIN TRANSACTION;
          delete from t_f_registry where registry_key=\'{row_registry_key}\';
          COMMIT;
          '''
          db_budget.delete(query=delete_query)
          select_query=f'''
          select count(1) as count_row from t_f_registry where registry_key=\'{row_registry_key}\';
          '''
          count_row = db_budget.select(query=select_query)['count_row'].values[0]
          if count_row==0:
            st.info(f'Запись с идентифкатором {row_registry_key} удалена!')
          increment_counter()
        if update_button:
          st.rerun()

  else:
    st.stop()
  
elif st.session_state["authentication_status"] is False:
  st.error('Логин или пароль не корректный')
  
elif st.session_state["authentication_status"] is None:
  st.warning('Введите ваш логин и пароль')



