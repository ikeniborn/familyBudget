"""
Cost Center model.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, UniqueConstraint, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class CostCenter(Base):
    """Cost Center model matching Prisma CostCenter schema."""
    
    __tablename__ = "t_d_cost_center"
    
    id = Column("cost_center_id", Integer, primary_key=True, index=True)
    code = Column("cost_center_code", String(20), nullable=False, unique=True)
    name = Column("cost_center_name", String, nullable=False)
    description = Column("description", String(500), nullable=True)
    is_active = Column("is_active", Boolean, default=True)
    user_id = Column("user_id", Integer, nullable=True, index=True)  # Nullable for shared records
    created_by = Column("created_by", Integer, ForeignKey("t_d_user.user_id"), nullable=True)
    managed_by = Column("managed_by", Integer, ForeignKey("t_d_user.user_id"), nullable=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now())
    updated_at = Column("updated_at", DateTime(timezone=True), onupdate=func.now())
    
    # Global unique constraint on code (shared reference data)
    __table_args__ = ()
    
    # Relationships
    registries = relationship("Registry", back_populates="cost_center")
    creator = relationship("User", foreign_keys=[created_by])
    manager = relationship("User", foreign_keys=[managed_by])
    
    def __repr__(self):
        return f"<CostCenter(id={self.id}, name='{self.name}')>"
    
    def to_dict(self):
        return {
            "cost_center_id": self.id,
            "cost_center_code": self.code,
            "cost_center_name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "user_id": self.user_id,
            "created_by": self.created_by,
            "managed_by": self.managed_by,
            "is_shared": self.user_id is None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }