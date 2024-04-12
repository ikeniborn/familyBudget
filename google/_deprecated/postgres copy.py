import streamlit as st
import pandas as pd
from pandas import DataFrame
import os
# import psycopg2
# from psycopg2 import OperationalError,DatabaseError
from sql_metadata import Parser
from sqlalchemy.sql import text

class Postgres:
    'Класс работы с базой данных PostgreSQL'
    def __new__(cls, *args, **kwargs):
      return super().__new__(cls)
          
    def __init__(self) -> None:
      self._connect=None
      
    def connect(self,ttl:int=None):
      self._connect = st.connection('postgresql',type='sql',autocommit=True,ttl=ttl)
      return self

    def query(self,sql:str=None,ttl:int=None) -> DataFrame:
      return self._connect.query(sql=sql,ttl=ttl)
        
    def execute(self,sql:str=None,sql_dict:dict={}):
      sql_text = text(sql)
      session = self._connect.session
      session.execute(statement=sql_text,params=sql_dict)
      session.commit()
      
      