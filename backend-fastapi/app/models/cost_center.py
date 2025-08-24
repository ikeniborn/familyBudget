"""
Cost Center model.
"""
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.db.database import Base


class CostCenter(Base):
    """Cost Center model matching Prisma CostCenter schema."""
    
    __tablename__ = "t_d_cost_center"
    
    id = Column("cost_center_id", Integer, primary_key=True, index=True)
    name = Column("cost_center_name", String, nullable=False)
    
    # Relationships
    registries = relationship("Registry", back_populates="cost_center")
    
    def __repr__(self):
        return f"<CostCenter(id={self.id}, name='{self.name}')>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name
        }