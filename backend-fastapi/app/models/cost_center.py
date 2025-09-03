"""
Cost Center model.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class CostCenter(Base):
    """Cost Center model matching Prisma CostCenter schema."""
    
    __tablename__ = "t_d_cost_center"
    
    id = Column("cost_center_id", Integer, primary_key=True, index=True)
    name = Column("cost_center_name", String, nullable=False)
    is_active = Column("is_active", Boolean, default=True)
    user_id = Column("user_id", Integer, index=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now())
    updated_at = Column("updated_at", DateTime(timezone=True), onupdate=func.now())
    
    # Unique constraint on name per user
    __table_args__ = (
        UniqueConstraint('cost_center_name', 'user_id', name='_cost_center_name_user_uc'),
    )
    
    # Relationships
    registries = relationship("Registry", back_populates="cost_center")
    
    def __repr__(self):
        return f"<CostCenter(id={self.id}, name='{self.name}')>"
    
    def to_dict(self):
        return {
            "cost_center_id": self.id,
            "cost_center_name": self.name,
            "is_active": self.is_active,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }