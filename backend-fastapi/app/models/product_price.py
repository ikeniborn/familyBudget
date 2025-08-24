"""
Product Price model.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Date, func, Index
from sqlalchemy.orm import relationship

from app.db.database import Base


class ProductPrice(Base):
    """Product Price model matching Prisma ProductPrice schema."""
    
    __tablename__ = "t_f_product_price"
    
    id = Column("price_id", Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("t_d_product.product_id", ondelete="CASCADE"), nullable=False)
    supplier_name = Column(String(255), nullable=True)
    price_value = Column(Numeric(10, 2), nullable=False)
    price_date = Column(Date, server_default=func.current_date(), nullable=False)
    user_id = Column(Integer, ForeignKey("t_d_user.user_id"), nullable=False)
    created_at = Column("created_dttm", DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    product = relationship("Product", back_populates="prices")
    user = relationship("User", back_populates="product_prices")
    
    # Indexes
    __table_args__ = (
        Index("idx_product_price_date", "price_date"),
        Index("idx_product_price_product", "product_id"),
        Index("idx_product_price_supplier", "supplier_name"),
        Index("idx_product_price_user", "user_id"),
    )
    
    def __repr__(self):
        return f"<ProductPrice(id={self.id}, product_id={self.product_id}, price_value={self.price_value})>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "supplier_name": self.supplier_name,
            "price_value": float(self.price_value) if self.price_value else 0.0,
            "price_date": self.price_date.isoformat() if self.price_date else None,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }