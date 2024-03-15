import duckdb
from sql_metadata import Parser
import datetime

class BudgetDatabase:
  'Класс работы с duckdb'
  def __new__(cls, *args, **kwargs):
    return super().__new__(cls)
        
  def __init__(self,) -> None:
    self.client = None

  def connect(self,database_name:str=''):
    self.client = duckdb.connect(database=database_name)
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
    
  def create_table(self,schema_name:str='',table_name:str='', columns:dict={},indexes:list=[]):
    dttm = datetime.datetime.now().strftime('%Y%m%Y%H%M%S')
    local_client = self.client.cursor()
    ddl = f'CREATE TABLE {schema_name}.{table_name} (\n'
    column_list = ''
    idx = 0
    for  column, type in zip(columns.keys(), columns.values()):
      ddl += f'{column} {type},\n'
      if idx==0:
        column_list += f'{column}'
      else:
        column_list += f',{column}'
      idx+=1
    ddl +=');'
    if self.check_table(f'{schema_name}.{table_name}')==False:
      local_client.sql(ddl)
      for index in indexes:
        local_client.sql(f'CREATE UNIQUE INDEX {table_name}_{index}_idx on {schema_name}.{table_name} ({index})')
    else:
      for index in indexes:
        local_client.sql(f'drop INDEX {schema_name}.{table_name}_{index}_idx;')
      local_client.sql(f'ALTER TABLE {schema_name}.{table_name} RENAME TO {table_name}_old_{dttm};')
      local_client.sql(ddl)
      for index in indexes:
        local_client.sql(f'CREATE UNIQUE INDEX {table_name}_{index}_idx on {schema_name}.{table_name} ({index})')
      local_client.sql(f'insert into {schema_name}.{table_name} ({column_list}) SELECT {column_list} FROM {schema_name}.{table_name}_old_{dttm}')
    return self
  
def init():
  
  columns_registry = {
      'id': 'UUID PRIMARY KEY',
      'dttm': 'TIMESTAMP',
      'period': 'DATE',
      'cfo': 'VARCHAR',
      'mvz': 'VARCHAR',
      'nomenclature' :'VARCHAR',
      'value': 'DECIMAL(12, 2)',
      'comment': 'VARCHAR',
      'row_type': 'VARCHAR',
      'username': 'VARCHAR',
      'updated_dttm': 'TIMESTAMP',
    }

  columns_cfo = {
      'id': 'UUID PRIMARY KEY',
      'name': 'VARCHAR',
      'updated_dttm': 'TIMESTAMP',
    }
  
  columns_mvz = {
      'id': 'UUID PRIMARY KEY',
      'mvz': 'VARCHAR',
      'updated_dttm': 'TIMESTAMP',
    }
  
  columns_nomenclature = {
      'id': 'VARCHAR PRIMARY KEY',
      'nomenclature': 'VARCHAR',
      'account': 'VARCHAR',
      'bill': 'VARCHAR',
      'operation': 'VARCHAR',
      'updated_dttm': 'TIMESTAMP',
    }
        
  client = BudgetDatabase().connect(database_name='budget.db')
  client.create_table(schema_name='main',table_name='t_d_cfo',columns=columns_cfo)
  client.create_table(schema_name='main',table_name='t_d_mvz',columns=columns_mvz)
  client.create_table(schema_name='main',table_name='t_d_nomenclature',columns=columns_nomenclature)
  client.create_table(schema_name='main',table_name='t_f_registry',columns=columns_registry, indexes=['dttm'])

if __name__ == '__main__':
  init()