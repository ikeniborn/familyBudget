"""
Product model.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, func, Index
from sqlalchemy.orm import relationship

from app.db.database import Base


class Product(Base):
    """Product model matching Prisma Product schema."""
    
    __tablename__ = "t_d_product"
    
    id = Column("product_id", Integer, primary_key=True, index=True)
    name = Column("product_name", String(255), nullable=False)
    category = Column("category_name", String(100), nullable=True)
    unit = Column("unit_measure", String(50), nullable=True)
    barcode = Column(String(50), nullable=True)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column("created_dttm", DateTime(timezone=True), server_default=func.now())
    updated_at = Column("updated_dttm", DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    prices = relationship("ProductPrice", back_populates="product")
    nomenclatures = relationship("ProductNomenclature", back_populates="product")
    
    # Indexes
    __table_args__ = (
        Index("idx_product_active", "is_active"),
        Index("idx_product_barcode", "barcode"),
        Index("idx_product_category", "category_name"),
        Index("idx_product_name", "product_name"),
    )
    
    def __repr__(self):
        return f"<Product(id={self.id}, name='{self.name}', is_active={self.is_active})>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "unit": self.unit,
            "barcode": self.barcode,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }