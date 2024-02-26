import streamlit as st
import pandas as pd
import gspread
from streamlit_gsheets import GSheetsConnection
import datetime


def main():
  with st.sidebar:
    oparetion_time = st.date_input("Период",  datetime.date(2024,2,1))
    
    cfo = st.sidebar.selectbox(
        "ЦФО",
        ("Илья", "Оксана", "Радомир")
    )
    
    nomenclature = st.sidebar.selectbox(
        "Номенклатура",
        ("Гипермаркет", "Дизель")
    )
    
    sum = st.number_input(label="Сумма",min_value=0)
    
  

if __name__ == "__main__":
    main()
