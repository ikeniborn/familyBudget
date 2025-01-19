from pydantic import BaseModel
from datetime import datetime, date


class Models:

    class Period(BaseModel):
        period_id: int
        period_dt: date
        period_ru_name: str

    class Registry(BaseModel):
        registry_id: int
        operation_dttm: datetime
        period_id: int
        financial_center_id: int
        cost_center_id: int
        nomenclature_id: int
        cost_sum: float
        comment_description: str
        row_type_id: int
        user_id: int
