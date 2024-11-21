from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, date
from uuid import UUID


class Models:

    class Period(BaseModel):
        period_key: UUID
        period_dt: date
        period_ru_name: str

    class Registry(BaseModel):
        registry_key: UUID
        operation_dttm: datetime
        period_key: UUID
        financial_center_key: UUID
        cost_center_key: UUID
        nomenclature_key: UUID
        cost_sum: float
        comment_description: str
        row_type_key: UUID
        user_key: UUID
