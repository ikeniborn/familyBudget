import duckdb
from sql_metadata import Parser
import datetime

class BudgetDatabase:
  'Класс работы с duckdb'
  def __new__(cls, *args, **kwargs):
    return super().__new__(cls)
        
  def __init__(self,) -> None:
    self.client = None

  def connect(self,database_name:str='', read_only:bool=False):
    self.client = duckdb.connect(database=database_name,read_only=read_only)
    return self
  
  def check_table(self,table_name:str='')-> bool:
    try:
      self.client.table(table_name)
      return True
    except Exception as e:
      return False
    
  def create_schema(self,schema_name:str=''):
    local_client = self.client.cursor()
    local_client.sql(f'CREATE SCHEMA IF NOT EXISTS {schema_name};')
    
  def create_table(self,sql:str=None):
    sql_object = Parser(sql=sql)
    table = sql_object.tables[0]
    dttm = datetime.datetime.now().strftime('%Y%m%Y%H%M%S')
    local_client = self.client.cursor()
    local_client.sql(f'USE budget.main;')
    if self.check_table(f'{table}'):
      local_client.sql(f'ALTER TABLE {table} RENAME TO {table}_old_{dttm};')
      local_client.sql(sql)
    else:
      local_client.sql(sql)     
    return self
  
def init():
  
  t_f_registry = '''
    CREATE TABLE t_f_registry (
      registry_key UUID PRIMARY KEY,
      operation_dttm TIMESTAMP NOT NULL,
      period_key UUID NOT NULL,
      financial_center_key UUID NOT NULL,
      cost_center_key UUID NOT NULL,
      nomenclature_key UUID NOT NULL,
      cost_sum DECIMAL(12,2) NOT NULL ,
      comment_description VARCHAR NOT NULL,
      row_type_key UUID NOT NULL,
      user_key UUID NOT NULL,
      created_dttm TIMESTAMP NOT NULL DEFAULT now(),
      updated_dttm TIMESTAMP NOT NULL DEFAULT now()
    );
  '''
  
  t_d_period = '''
    CREATE TABLE t_d_period (
      period_key UUID PRIMARY KEY,
      period_dttm TIMESTAMP NOT NULL DEFAULT now(),
      period_dt DATE NOT NULL,
      perion_ru_name VARCHAR NOT NULL,
      created_dttm TIMESTAMP NOT NULL DEFAULT now(),
      updated_dttm TIMESTAMP NOT NULL DEFAULT now()
    );
  '''
  
  t_d_user= '''
    CREATE TABLE t_d_user (
      user_key UUID PRIMARY KEY,
      user_name VARCHAR NOT NULL,
      user_password VARCHAR NOT NULL,
      user_email VARCHAR,
      created_dttm TIMESTAMP NOT NULL DEFAULT now(),
      updated_dttm TIMESTAMP NOT NULL DEFAULT now()
    );
  '''

  t_d_financial_center = '''
    CREATE TABLE t_d_financial_center (
      financial_center_key UUID PRIMARY KEY,
      financial_center_name VARCHAR NOT NULL,
      created_dttm TIMESTAMP NOT NULL DEFAULT now(),
      updated_dttm TIMESTAMP NOT NULL DEFAULT now()
    );
  '''
  
  t_d_row_type = '''
    CREATE TABLE t_d_row_type (
      row_type_key UUID PRIMARY KEY,
      row_type_name VARCHAR NOT NULL, 
      created_dttm TIMESTAMP NOT NULL DEFAULT now(),
      updated_dttm TIMESTAMP NOT NULL DEFAULT now()
    );
  '''
  
  t_d_cost_center = '''
    CREATE TABLE t_d_cost_center (
      cost_center_key UUID PRIMARY KEY,
      cost_center_name VARCHAR NOT NULL,
      created_dttm TIMESTAMP NOT NULL DEFAULT now(),
      updated_dttm TIMESTAMP NOT NULL DEFAULT now()
    );
  '''
  
  t_d_nomenclature = '''
    CREATE TABLE t_d_nomenclature (
      nomenclature_key UUID PRIMARY KEY,
      nomenclature_name VARCHAR NOT NULL,
      account_name VARCHAR NOT NULL,
      bill_name VARCHAR NOT NULL,
      operation_name VARCHAR NOT NULL,
      is_budget BOOLEAN NOT NULL DEFAULT False,
      is_fact BOOLEAN NOT NULL DEFAULT False,
      created_dttm TIMESTAMP NOT NULL DEFAULT now(),
      updated_dttm TIMESTAMP NOT NULL DEFAULT now()
    );
  '''
        
  client = BudgetDatabase().connect(database_name='budget.db')
  client.create_table(sql=t_f_registry)
  client.create_table(sql=t_d_financial_center)
  client.create_table(sql=t_d_row_type)
  client.create_table(sql=t_d_cost_center)
  client.create_table(sql=t_d_nomenclature)
  client.create_table(sql=t_d_period)
  

if __name__ == '__main__':
  init()