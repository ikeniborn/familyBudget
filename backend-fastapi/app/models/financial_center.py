"""
Financial Center model.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, UniqueConstraint, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class FinancialCenter(Base):
    """Financial Center model matching Prisma FinancialCenter schema."""
    
    __tablename__ = "t_d_financial_center"
    
    id = Column("financial_center_id", Integer, primary_key=True, index=True)
    code = Column("financial_center_code", String(20), nullable=False, unique=True)
    name = Column("financial_center_name", String, nullable=False)
    description = Column("description", String(500), nullable=True)
    is_active = Column("is_active", Boolean, default=True)
    user_id = Column("user_id", Integer, nullable=False, index=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now())
    updated_at = Column("updated_at", DateTime(timezone=True), onupdate=func.now())
    
    # Unique constraint per user
    __table_args__ = ()
    
    # Relationships
    registries = relationship("Registry", back_populates="financial_center")
    
    def __repr__(self):
        return f"<FinancialCenter(id={self.id}, name='{self.name}')>"
    
    def to_dict(self):
        return {
            "financial_center_id": self.id,
            "financial_center_code": self.code,
            "financial_center_name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }