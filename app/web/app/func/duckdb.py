import duckdb
import streamlit as st

class DuckDb:
  'Класс работы с duckdb'
  def __new__(cls, *args, **kwargs):
    return super().__new__(cls)
        
  def __init__(self,database_name) -> None:
    self.database_name = database_name
    self.client = None

  def connect(self,ttl:int=3600):
    @st.cache_resource(ttl=ttl)
    def _connect(database_name:str):
      return duckdb.connect(database=database_name)
    self.client = _connect(database_name=self.database_name)
    return self

  def create(self,dataframe,worksheet_name):
    dfdb = self.client.table('duckdb_tables').df()
    df = dataframe
    if len(dfdb[dfdb['table_name']==worksheet_name])==0:
      create_table_sql = f'CREATE TABLE "{worksheet_name}" AS SELECT * FROM df'
      self.client.sql(create_table_sql)
    else:
      drop_table_sql = f'truncate TABLE "{worksheet_name}"'
      self.client.sql(drop_table_sql)
      create_table_sql = f'insert into "{worksheet_name}" SELECT * FROM df'
      self.client.sql(create_table_sql)
    
  def insert(self,dataframe,worksheet_name):
    dfdb = self.client.table('duckdb_tables').df()
    df = dataframe
    if len(dfdb[dfdb['table_name']==worksheet_name])>0:
      insert_table_sql = f'insert into "{worksheet_name}" SELECT * FROM df'
      self.client.sql(insert_table_sql)
      
  def select(self,query):
    return self.client.sql(query).to_df()