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
    code: Optional[str] = Field(None, max_length=20, description="Period code")


class PeriodCreate(PeriodBase):
    """Period creation schema."""
    user_id: Optional[int] = Field(None, description="User ID (null for shared periods)")
    managed_by: Optional[int] = Field(None, description="Manager user ID")


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
    code: Optional[str] = Field(None, max_length=20, description="Period code")
    managed_by: Optional[int] = Field(None, description="Manager user ID")

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
    user_id: Optional[int] = None
    created_by: Optional[int] = None
    managed_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_shared: bool = Field(default=False, description="Whether this is a shared period")
    is_editable: bool = Field(default=True, description="Whether current user can edit this period")

    class Config:
        from_attributes = True


class PeriodPublic(BaseModel):
    """Public period schema with legacy field mapping."""
    id: int
    date: datetime
    ru_name: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    code: Optional[str] = None
    user_id: Optional[int] = None
    created_by: Optional[int] = None
    managed_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_shared: bool = Field(default=False, description="Whether this is a shared period")
    is_editable: bool = Field(default=True, description="Whether current user can edit this period")

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
    def from_db_model(cls, period, current_user=None):
        """Create schema instance from database model with legacy mapping."""
        is_shared = period.user_id is None
        is_editable = True

        # Determine editability based on admin role and ownership
        if current_user:
            user_role = current_user.get('role', 'user')
            user_id = current_user.get('user_id')

            if is_shared:
                # Shared periods only editable by admins
                is_editable = user_role == 'admin'
            else:
                # User periods editable by owner or admins
                is_editable = user_id == period.user_id or user_role == 'admin'

        return cls(
            id=period.id,
            date=period.date,
            ru_name=period.ru_name,
            start_date=period.start_date,
            end_date=period.end_date,
            code=getattr(period, 'code', None),
            user_id=period.user_id,
            created_by=getattr(period, 'created_by', None),
            managed_by=getattr(period, 'managed_by', None),
            created_at=getattr(period, 'created_at', None),
            updated_at=getattr(period, 'updated_at', None),
            is_shared=is_shared,
            is_editable=is_editable,
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


class AdminPeriodResponse(BaseModel):
    """Admin period response schema with user data."""
    id: int
    date: datetime
    ru_name: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    user_id: int
    created_at: Optional[datetime] = None
    is_active: bool = True
    
    # User information
    user_name: str
    user_email: Optional[str] = None
    username: Optional[str] = None
    telegram_id: Optional[str] = None
    
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
    def from_db_models(cls, period, user):
        """Create schema instance from database models with user info."""
        return cls(
            id=period.id,
            date=period.date,
            ru_name=period.ru_name,
            start_date=period.start_date,
            end_date=period.end_date,
            user_id=period.user_id,
            created_at=period.date,  # Map period.date to created_at as in regular Period responses
            is_active=True,  # Default to True like in regular responses
            # User data
            user_name=user.user_name if user else "",
            user_email=user.user_email if user else None,
            username=user.username if user else None,
            telegram_id=str(user.telegram_id) if user and user.telegram_id else None,
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