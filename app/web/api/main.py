from fastapi import FastAPI
from pydantic import BaseModel
from utils.postgres import Postgres

app = FastAPI()


class Item(BaseModel):
    name: str
    description: str = None
    price: float
    tax: float = None


@app.post("/items/")
async def create_budget(item: Item):
    """
    Creates a new item based on the data sent in the request.
    Args:
    item (Item): Data of the item sent in the request.
    Returns:
    dict: Dictionary containing the item's information, as well as the price with tax (if the tax is defined).
    """
    item_dict = item.dict()
    if item.tax:
        price_with_tax = item.price + item.tax
        item_dict.update({"price_with_tax": price_with_tax})
    return item_dict