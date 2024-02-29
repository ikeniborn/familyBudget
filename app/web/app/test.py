import gspread
from gspread import Worksheet
import pandas as pd
import datetime
from pandas import DataFrame
import streamlit as st
import duckdb
from sql_metadata import Parser
# from streamlit.runtime.caching import cache_data

@st.cache_resource(ttl=3600)
def _query(sql, spreadsheet, folder_id, evaluate_formulas, **options):
    in_memory_db = duckdb.connect()
    for worksheet in Parser(sql).tables:
        df = DataFrame()
        create_table_sql = f'CREATE TABLE "{worksheet}" AS SELECT * FROM df'
        if not self._select_worksheet(
            spreadsheet=spreadsheet, folder_id=folder_id, worksheet=worksheet
        ):
            in_memory_db.sql(create_table_sql)
            _ = df
            continue
        df = self.read(
            spreadsheet=spreadsheet,
            folder_id=folder_id,
            worksheet=worksheet,
            ttl=ttl,
            max_entries=max_entries,
            evaluate_formulas=evaluate_formulas,
            **options,
        )
        in_memory_db.sql(create_table_sql)
        _ = df
    return in_memory_db.sql(query=sql).to_df()


@st.cache_resource(ttl=3600)
def _worksheet() -> Worksheet:
  gs= gspread.service_account(filename='/home/ikeni/Documents/Git/familyBudget/app/web/app/secrets/familybudget-317019-797cf157b1ff.json')
  sh = gs.open_by_key('12zOV6GkjmT2eUAQalQCTDP1OXOBCfLOhcBQaXQ4gbUQ')
  return sh.worksheet('t_d_accounting_item_new')



@st.cache_data(persist=False,ttl=3600)
def read() -> DataFrame:
  ws=_worksheet()
  return ws.get_all_values()
  # return DataFrame(ws.get_all_records())

# newDf = DataFrame([
  
# ]
# )
data = ["John", "Doe", 25]
_worksheet().append_rows([[1],[1]])
df = read()

# gs.set_timeout(1)

# max_row=df.max(axis=0)

print(datetime.datetime.now())
# print(df)
# print(max_row['id'])
# sh = gs.open_by_key('12zOV6GkjmT2eUAQalQCTDP1OXOBCfLOhcBQaXQ4gbUQ')

# t_d_accounting_item_data = conn.read(worksheet="t_d_accounting_item_new", usecols=list(range(9)), ttl=5).dropna(how="all")
# val = ws.get_all_records()
# dataframe = pd.DataFrame(worksheet.get_all_records())

# ws.update_cell(1, 2, 'Bingo!')

# print(sh)