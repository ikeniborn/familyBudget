# import gspread
# from gspread import Worksheet, Spreadsheet
import streamlit as st
from func.duckdb import DuckDb
# from pandas import DataFrame
from google.cloud import storage
# from google.oauth2 import service_account

# class GoogleSpreadsheet:
#     'Класс работы с табилцами гугл'
#     def __new__(cls, *args, **kwargs):
#       return super().__new__(cls)
          
#     def __init__(self,spreadsheet_id,credential) -> None:
#       self.spreadsheet_id=spreadsheet_id
#       self.credential=credential
#       self.spreadsheet:Spreadsheet=None
#       self.db:DuckDb = DuckDb(database_name='data/'+spreadsheet_id)

#     def get_spreadsheet(self,ttl=3600):
#       @st.cache_resource(ttl=ttl,show_spinner="Open spreadsheet...")
#       def cached_get_spreadsheet(spreadsheet_id,credential) -> Spreadsheet:
#         return gspread.service_account(filename=credential).open_by_key(spreadsheet_id)
#       self.spreadsheet = cached_get_spreadsheet(self.spreadsheet_id,self.credential)
#       self.db.connect()
#       return self
      
# class GoogleWorksheet():
#   'Класс работы с листами гугл'
#   def __new__(cls, *args, **kwargs):
#     return super().__new__(cls)
        
#   def __init__(self,spreadsheet,worksheet_name:str='') -> None:
#     self.spreadsheet:Spreadsheet=spreadsheet.spreadsheet
#     self.worksheet_name=worksheet_name
#     self.worksheet_object:Worksheet=None
#     self.worksheet_data:DataFrame=None
#     self.db:DuckDb=spreadsheet.db


#   def get_worksheet(self,ttl=3600):
#     @st.cache_resource(ttl=ttl,show_spinner=f"Open worksheet {self.worksheet_name}...")
#     def cached_get_worksheet(worksheet_name) -> Worksheet:
#       return self.spreadsheet.worksheet(worksheet_name)
#     self.worksheet_object=cached_get_worksheet(self.worksheet_name)
#     return self

#   def read(self,key:str = None, ttl:int=0, dummy_time:str=None):
#     @st.cache_data(ttl=ttl,show_spinner=f"Load data from {self.worksheet_name}...")
#     def _read(_worksheet,key:str, dummy_time:str, worksheet_name) -> DataFrame:
#       if key!=None:
#         df = DataFrame(_worksheet.get_all_records()).dropna(how='all').set_index(keys=key)
#       else:
#         df= DataFrame(_worksheet.get_all_records()).dropna(how='all')
#       return df
#     self.worksheet_data = _read(self.worksheet_object, key, dummy_time, self.worksheet_name)
#     self.db.create(dataframe=self.worksheet_data,worksheet_name=self.worksheet_name)
#     return self

#   def query(self, query:str=None)-> DataFrame:
#     return self.db.select(query=query)
  
#   def insert(self, dataframe):
#     self.db.insert(dataframe,self.worksheet_name)
    
class GoogleStorage:
    'Класс работы с хранением в облаке'
    def __new__(cls, *args, **kwargs):
      return super().__new__(cls)
          
    def __init__(self,credential_path) -> None:
      self.credential_path=credential_path
      self.client=None

    def get_storage(self,ttl=60):
      @st.cache_resource(ttl=ttl)
      def _get_storage(credential_path):
        return storage.Client.from_service_account_json(json_credentials_path=credential_path)
      self.client = _get_storage(credential_path=self.credential_path)
      return self
    
    def upload_file(self):
      bucket = storage.Bucket(self.client, 'budget-ikeniborn-ru')
      # bucket = self.client.get_bucket('budget-ikeniborn-ru')
      blob = bucket.blob('budget.db')
      blob.upload_from_filename('data/budget.db')
    
    def download_file(self):
      bucket = storage.Bucket(self.client, 'budget-ikeniborn-ru')
      blob = bucket.blob('budget.db')
      blob.download_to_filename('data/budget.db')
      db_client= DuckDb('data/budget.db')
      db_client.close()
      local_client = db_client.connect().client.cursor()
      local_client.sql('FORCE CHECKPOINT;')