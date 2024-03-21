import duckdb
import streamlit as st
from pandas import DataFrame
class DuckDb:
  'Класс работы с duckdb'
  def __new__(cls, *args, **kwargs):
    return super().__new__(cls)
        
  def __init__(self,database_name) -> None:
    self.database_name = database_name
    self.client = None

  def connect(self,read_only:bool=False, ttl:int=3600):
    @st.cache_resource(ttl=ttl)
    def _connect(database_name:str,read_only:bool):
      return duckdb.connect(database=database_name, read_only=read_only)
    self.client = _connect(database_name=self.database_name,read_only=read_only)
    return self
  
  def close(self):
    duckdb.close(connection=self.client)
    return self
  
  def check_table(self,table_name:str='')-> bool:
    try:
      self.client.table(table_name)
      return True
    except Exception as e:
      return False

  # def create(self,dataframe, worksheet_name, index_column:str=None):
  #   df = dataframe
  #   local_client = self.client.cursor()
  #   if self.check_table(table_name=worksheet_name)==False:
  #     create_table_sql = f'CREATE TABLE "{worksheet_name}" AS SELECT * FROM df'
  #     local_client.sql(create_table_sql)
  #     if index_column:
  #       create_table_index_sql = f'CREATE UNIQUE INDEX "{worksheet_name}"_"{index_column}"_idx on "{worksheet_name}"'
  #       local_client.sql(create_table_index_sql)
  #   else:
  #     truncate_table_sql = f'truncate TABLE "{worksheet_name}"'
  #     local_client.sql(truncate_table_sql)
  #     insert_table_sql = f'insert into "{worksheet_name}" SELECT * FROM df'
  #     local_client.sql(insert_table_sql)
    
  def insert(self,sql):
    local_client = self.client.cursor()
    local_client.sql(f'USE budget.main;')
    local_client.sql(sql)
  
  # def update(self,dataframe,worksheet_name):
  #   local_client = self.client.cursor()
  #   df = dataframe
  #   if self.check_table(table_name=worksheet_name):
  #     insert_table_sql = f'insert into "{worksheet_name}" SELECT * FROM df'
  #     local_client.sql(insert_table_sql)
      
  def select(self, query:str=None, ttl:int=0) -> DataFrame:
    local_client = self.client.cursor()
    local_client.sql(f'USE budget.main;')
    @st.cache_data(ttl=ttl)    
    def _select(query)-> DataFrame:
      return local_client.sql(query).to_df()
    try:
      return _select(query)
    except Exception as e:
      return None