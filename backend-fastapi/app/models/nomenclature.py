"""
Nomenclature model.
"""
from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship

from app.db.database import Base


class Nomenclature(Base):
    """Nomenclature model matching Prisma Nomenclature schema."""
    
    __tablename__ = "t_d_nomenclature"
    
    id = Column("nomenclature_id", Integer, primary_key=True, index=True)
    name = Column("nomenclature_name", String, nullable=False)
    account_name = Column(String, nullable=False)
    bill_name = Column(String, nullable=False)
    operation = Column("operation_name", String, nullable=False)
    is_budget = Column(Boolean, nullable=False)
    is_fact = Column(Boolean, nullable=False)
    
    # Relationships
    registries = relationship("Registry", back_populates="nomenclature")
    products = relationship("ProductNomenclature", back_populates="nomenclature")
    
    def __repr__(self):
        return f"<Nomenclature(id={self.id}, name='{self.name}')>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "account_name": self.account_name,
            "bill_name": self.bill_name,
            "operation": self.operation,
            "is_budget": self.is_budget,
            "is_fact": self.is_fact
        }