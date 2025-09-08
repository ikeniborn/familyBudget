"""
Pydantic schemas for sharing functionality.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from enum import Enum


class ResourceType(str, Enum):
    """Supported resource types for sharing."""
    nomenclature = "nomenclature"
    cost_center = "cost_center"
    financial_center = "financial_center"
    product = "product"


class PermissionType(str, Enum):
    """Permission types for sharing."""
    read = "read"
    write = "write"


class SharingBase(BaseModel):
    """Base sharing schema."""
    shared_with_user_id: int
    resource_type: ResourceType
    resource_id: Optional[int] = None
    permission_type: PermissionType = PermissionType.read
    is_active: bool = True


class SharingCreate(SharingBase):
    """Schema for creating sharing."""
    pass


class SharingUpdate(BaseModel):
    """Schema for updating sharing."""
    permission_type: Optional[PermissionType] = None
    is_active: Optional[bool] = None


class SharingUser(BaseModel):
    """User schema for sharing responses."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_name: str
    user_email: Optional[str] = None
    username: Optional[str] = None


class Sharing(SharingBase):
    """Schema for sharing responses."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    owner_user_id: int
    created_at: datetime
    updated_at: datetime
    owner: Optional[SharingUser] = None
    shared_with: Optional[SharingUser] = None


class SharingListResponse(BaseModel):
    """Schema for sharing list responses."""
    success: bool
    data: List[Sharing]
    total: int


class SharingResponse(BaseModel):
    """Schema for single sharing response."""
    success: bool
    data: Sharing


class AvailableUsersResponse(BaseModel):
    """Schema for available users for sharing."""
    success: bool
    data: List[SharingUser]


class SharedDataInfo(BaseModel):
    """Schema for shared data information."""
    resource_type: ResourceType
    resource_id: Optional[int]
    permission_type: PermissionType
    owner: SharingUser
    shared_at: datetime