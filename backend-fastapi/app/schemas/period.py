"""
Period schemas.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, validator


class PeriodBase(BaseModel):
    """Base period schema."""
    date: datetime = Field(..., description="Period date")
    ru_name: str = Field(..., min_length=1, max_length=100, description="Russian name")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class PeriodCreate(PeriodBase):
    """Period creation schema."""
    pass


class PeriodCreateLegacy(BaseModel):
    """Legacy period creation schema for backward compatibility."""
    period_year: Optional[int] = None
    period_month: Optional[int] = None
    period_dt: Optional[datetime] = None
    period_ru_name: Optional[str] = None
    period_start_date: Optional[datetime] = None
    period_end_date: Optional[datetime] = None
    date: Optional[datetime] = None
    ru_name: Optional[str] = None
    
    @validator('period_year')
    def validate_year(cls, v):
        if v is not None and (v < 1900 or v > 2100):
            raise ValueError('Year must be between 1900 and 2100')
        return v
    
    @validator('period_month')
    def validate_month(cls, v):
        if v is not None and (v < 1 or v > 12):
            raise ValueError('Month must be between 1 and 12')
        return v


class PeriodUpdate(BaseModel):
    """Period update schema."""
    date: Optional[datetime] = None
    ru_name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    
    # Legacy fields for backward compatibility
    period_year: Optional[int] = None
    period_month: Optional[int] = None
    period_dt: Optional[datetime] = None
    period_ru_name: Optional[str] = None
    period_start_date: Optional[datetime] = None
    period_end_date: Optional[datetime] = None


class PeriodInDB(PeriodBase):
    """Period schema for database operations."""
    id: int

    class Config:
        from_attributes = True


class PeriodPublic(BaseModel):
    """Public period schema with legacy field mapping."""
    id: int
    date: datetime
    ru_name: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    
    # Legacy fields for backward compatibility
    period_id: int
    period_dt: datetime
    period_ru_name: str
    period_name: str
    period_year: int
    period_month: int
    period_start_date: Optional[datetime] = None
    period_end_date: Optional[datetime] = None

    class Config:
        from_attributes = True
    
    @classmethod
    def from_db_model(cls, period):
        """Create schema instance from database model with legacy mapping."""
        return cls(
            id=period.id,
            date=period.date,
            ru_name=period.ru_name,
            start_date=period.start_date,
            end_date=period.end_date,
            # Legacy mappings
            period_id=period.id,
            period_dt=period.date,
            period_ru_name=period.ru_name,
            period_name=period.ru_name,
            period_year=period.date.year,
            period_month=period.date.month,
            period_start_date=period.start_date,
            period_end_date=period.end_date
        )