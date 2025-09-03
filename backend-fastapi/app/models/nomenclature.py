"""
Nomenclature model.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, UniqueConstraint, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum

from app.db.database import Base


class NomenclatureType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"


class Nomenclature(Base):
    """Nomenclature model matching Prisma Nomenclature schema."""
    
    __tablename__ = "t_d_nomenclature"
    
    id = Column("nomenclature_id", Integer, primary_key=True, index=True)
    name = Column("nomenclature_name", String, nullable=False)
    nomenclature_type = Column(Enum(NomenclatureType), default=NomenclatureType.EXPENSE)
    account_name = Column(String, nullable=False)
    bill_name = Column(String, nullable=False)
    operation = Column("operation_name", String, nullable=False)
    is_budget = Column(Boolean, nullable=False)
    is_fact = Column(Boolean, nullable=False)
    is_active = Column("is_active", Boolean, default=True)
    user_id = Column("user_id", Integer, index=True)
    parent_id = Column("parent_id", Integer, index=True, nullable=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now())
    updated_at = Column("updated_at", DateTime(timezone=True), onupdate=func.now())
    
    # Unique constraint on name per user
    __table_args__ = (
        UniqueConstraint('nomenclature_name', 'user_id', name='_nomenclature_name_user_uc'),
    )
    
    # Relationships
    registries = relationship("Registry", back_populates="nomenclature")
    products = relationship("ProductNomenclature", back_populates="nomenclature")
    
    def __repr__(self):
        return f"<Nomenclature(id={self.id}, name='{self.name}')>"
    
    def to_dict(self):
        return {
            "nomenclature_id": self.id,
            "nomenclature_name": self.name,
            "nomenclature_type": self.nomenclature_type.value if self.nomenclature_type else None,
            "account_name": self.account_name,
            "bill_name": self.bill_name,
            "operation_name": self.operation,
            "is_budget": self.is_budget,
            "is_fact": self.is_fact,
            "is_active": self.is_active,
            "user_id": self.user_id,
            "parent_id": self.parent_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }