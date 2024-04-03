import streamlit as st
from pydantic import BaseModel
import os
import pandas as pd
from pandas import DataFrame, Series
from datetime import datetime
from utils.dimensions import Users, Periods, FinancialCenters, CostCenter, Nomenclatures, RowTypes


# users = Users().fetchAll(ttl=100)
# st.write(users)

# periods = Periods().fetchAll(ttl=100)
# st.write(periods)

# financial_centers = FinancialCenters().fetchAll(ttl=100)
# st.write(financial_centers)

# cost_centers = CostCenter().fetchAll(ttl=100)
# st.write(cost_centers)

# nomenclatures = Nomenclatures().fetchAll(ttl=1)
# st.write(nomenclatures)

row_types = RowTypes().fetchAll(ttl=1)
st.write(row_types)


# st.title("Create an item")
# name = st.text_input("Name")
# description = st.text_input("Description")
# price = st.number_input("Price", step=0.01)
# tax = st.number_input("Tax", step=0.01)
# item = Item(name=name, description=description, price=price, tax=tax)

# if st.button("Create"):
#     # Create the item and display the response.
#     response = create_item(item)
#     st.write(response)
#     st.write(DataFrame([response]))
