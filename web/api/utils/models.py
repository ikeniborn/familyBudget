from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, date
from uuid import UUID


class Models:

    class Period(BaseModel):
        period_id: UUID
        period_dt: date
        period_ru_name: str

    class Registry(BaseModel):
        registry_id: UUID
        operation_dttm: datetime
        period_id: UUID
        financial_center_id: UUID
        cost_center_id: UUID
        nomenclature_id: UUID
        cost_sum: float
        comment_description: str
        row_type_id: UUID
        user_id: UUID
