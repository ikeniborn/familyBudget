"""
Row Type model.
"""
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.db.database import Base


class RowType(Base):
    """Row Type model matching Prisma RowType schema."""
    
    __tablename__ = "t_d_row_type"
    
    id = Column("row_type_id", Integer, primary_key=True, index=True)
    name = Column("row_type_name", String, nullable=False)
    
    # Relationships
    registries = relationship("Registry", back_populates="row_type")
    
    def __repr__(self):
        return f"<RowType(id={self.id}, name='{self.name}')>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name
        }