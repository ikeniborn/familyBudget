"""
Product Nomenclature junction model.
"""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, func, Index
from sqlalchemy.orm import relationship

from app.db.database import Base


class ProductNomenclature(Base):
    """Product Nomenclature junction model matching Prisma ProductNomenclature schema."""
    
    __tablename__ = "t_l_product_nomenclature"
    
    product_id = Column(Integer, ForeignKey("t_d_product.product_id", ondelete="CASCADE"), primary_key=True)
    nomenclature_id = Column(Integer, ForeignKey("t_d_nomenclature.nomenclature_id", ondelete="CASCADE"), primary_key=True)
    created_dttm = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    nomenclature = relationship("Nomenclature", back_populates="products")
    product = relationship("Product", back_populates="nomenclatures")
    
    # Indexes
    __table_args__ = (
        Index("idx_product_nomenclature_nom", "nomenclature_id"),
        Index("idx_product_nomenclature_product", "product_id"),
    )
    
    def __repr__(self):
        return f"<ProductNomenclature(product_id={self.product_id}, nomenclature_id={self.nomenclature_id})>"
    
    def to_dict(self):
        return {
            "product_id": self.product_id,
            "nomenclature_id": self.nomenclature_id,
            "created_dttm": self.created_dttm.isoformat() if self.created_dttm else None
        }