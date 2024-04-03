import streamlit as st
import pandas as pd
from pandas import DataFrame
import os
import psycopg2
from psycopg2 import OperationalError,DatabaseError
from sql_metadata import Parser

class Postgres:
    'Класс работы с базой данных PostgreSQL'
    def __new__(cls, *args, **kwargs):
      return super().__new__(cls)
          
    def __init__(self) -> None:
      self._connect=None
      
    def connect(self,host:str='localhost',port:int=5432,database:str='postgres',user:str='postgres',password:str='postgres',ttl:int=None):
      @st.cache_resource(ttl=ttl)
      def _connect(host,port,database,user,password):
        try:
          return psycopg2.connect(host=host,port=port,user=user,password=password,database=database)
        except OperationalError as e:
          print(f"The error '{e}' occurred")
      self._connect = _connect(host=host,port=port,database=database,user=user,password=password)
      self._connect.autocommit=True
      return self
    
    def insert(self,sql:str=None,ttl:int=None):
      @st.cache_data(ttl=ttl)
      def _insert(sql:str=None):
        self._connect.autocommit = True
        cursor = self._connect.cursor()
        cursor.execute(sql)
        self._connect.commit()
        cursor.close()
      _insert(sql=sql)
      
    def delete(self,sql:str=None,ttl:int=None):
      @st.cache_data(ttl=ttl)
      def _delete(sql:str=None):
        cursor = self._connect.cursor()
        cursor.execute(sql)
        self._connect.commit()
        cursor.close()
      _delete(sql=sql)
      
    def select(self,sql:str=None,ttl:int=None)->DataFrame:
      @st.cache_data(ttl=ttl)
      def _select(sql:str=None):
        cursor = self._connect.cursor()
        columns = Parser(sql=sql).columns
        try:
          cursor.execute(sql)
        except (Exception, DatabaseError) as error:
            print("Error: %s" % error)
            cursor.close()
            return 1
        tuples = cursor.fetchall()
        cursor.close()
        return pd.DataFrame(tuples, columns=columns)
      return _select(sql=sql)
      
      
      