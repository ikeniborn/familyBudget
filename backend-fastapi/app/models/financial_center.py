"""
Financial Center model.
"""
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.db.database import Base


class FinancialCenter(Base):
    """Financial Center model matching Prisma FinancialCenter schema."""
    
    __tablename__ = "t_d_financial_center"
    
    id = Column("financial_center_id", Integer, primary_key=True, index=True)
    name = Column("financial_center_name", String, nullable=False)
    
    # Relationships
    registries = relationship("Registry", back_populates="financial_center")
    
    def __repr__(self):
        return f"<FinancialCenter(id={self.id}, name='{self.name}')>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name
        }