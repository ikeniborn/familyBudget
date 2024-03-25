import pandas as pd
from pandas import DataFrame
import psycopg2
from psycopg2 import OperationalError,DatabaseError
from sql_metadata import Parser

class Postgres:
    'Класс работы с базой данных PostgreSQL'
    def __new__(cls, *args, **kwargs):
      return super().__new__(cls)
          
    def __init__(self,host:str='localhost',port:int=5432,database:str='postgres',user:str='postgres',password:str='postgres',autocommit:bool=False) -> None:
      self._host=host
      self._port=port
      self._database=database
      self._user=user
      self._password=password
      self._autocommit=autocommit
      self._connection=None
      self._cursor=None
      
    def connect(self):
      try:
        self._connection = psycopg2.connect(host=self._host,port=self._port,user=self._user,password=self._password,database=self._database)
        self._connection.autocommit=self._autocommit
        self._cursor=self._connection.cursor()
      except OperationalError as e:
        print(f"The error '{e}' occurred")
      return self
    
    def insert(self,sql:str=None):
      try:
        self._cursor.execute(sql)
        self._connection.commit()
      except (Exception, DatabaseError) as error:
          print("Error: %s" % error)
          return 1
      
    def delete(self,sql:str=None):
      try:
        self._cursor.execute(sql)
        self._connection.commit()
      except (Exception, DatabaseError) as error:
          print("Error: %s" % error)
          return 1

    def select(self,sql:str=None)->DataFrame:
      columns_names = Parser(sql=sql).columns_dict
      columns_aliases = Parser(sql=sql).columns_aliases_dict
      columns = None
      if columns_aliases:
        columns=columns_aliases
      else:
        columns=columns_names
      try:
        self._cursor.execute(sql)
      except (Exception, DatabaseError) as error:
          print("Error: %s" % error)
      tuples = self._cursor.fetchall()
      return pd.DataFrame(tuples, columns=columns['select'])
    
    def close(self):
      try:
        if self._connection:
          self._cursor.close()
          self._connection.close()
          # st.info("Соединение с PostgreSQL закрыто")
      except (Exception, DatabaseError) as error:
        print("Error: %s" % error)
      
      
      