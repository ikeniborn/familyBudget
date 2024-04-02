import requests
import streamlit as st
from pydantic import BaseModel
import os


class Item(BaseModel):
    name: str
    description: str = None
    price: float
    tax: float = None


API_URL = os.getenv("API_URL")


def create_item(item: Item):
    """
    Create a new item by sending a POST request to the FastAPI API.
    Args:
    item (Item): Data of the item to be created.
    Returns:
    dict: Dictionary containing the information of the created item.
    """
    item_dict = item.dict()
    response = requests.post(f"""{API_URL}/items/""", json=item_dict)
    return response.json()


st.title("Create an item")
name = st.text_input("Name")
description = st.text_input("Description")
price = st.number_input("Price", step=0.01)
tax = st.number_input("Tax", step=0.01)
item = Item(name=name, description=description, price=price, tax=tax)

if st.button("Create"):
    # Create the item and display the response.
    response = create_item(item)
    st.write(response)
