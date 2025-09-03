"""
Registry model.
"""
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import relationship

from app.db.database import Base


class Registry(Base):
    """Registry model matching Prisma Registry schema."""
    
    __tablename__ = "t_f_registry"
    
    id = Column("registry_id", Integer, primary_key=True, index=True)
    operation_date = Column("operation_dttm", DateTime, nullable=False)
    user_id = Column(Integer, ForeignKey("t_d_user.user_id"), nullable=False)
    period_id = Column(Integer, ForeignKey("t_d_period.period_id"), nullable=False)
    financial_center_id = Column(Integer, ForeignKey("t_d_financial_center.financial_center_id"), nullable=False)
    cost_center_id = Column(Integer, ForeignKey("t_d_cost_center.cost_center_id"), nullable=True)
    nomenclature_id = Column(Integer, ForeignKey("t_d_nomenclature.nomenclature_id"), nullable=False)
    row_type_id = Column(Integer, ForeignKey("t_d_row_type.row_type_id"), nullable=False)
    cost_sum = Column(Numeric(10, 2), nullable=False)
    comment = Column("comment_description", String, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="registries")
    period = relationship("Period", back_populates="registries")
    financial_center = relationship("FinancialCenter", back_populates="registries")
    cost_center = relationship("CostCenter", back_populates="registries")
    nomenclature = relationship("Nomenclature", back_populates="registries")
    row_type = relationship("RowType", back_populates="registries")
    
    def __repr__(self):
        return f"<Registry(id={self.id}, user_id={self.user_id}, cost_sum={self.cost_sum})>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "operation_date": self.operation_date.isoformat() if self.operation_date else None,
            "user_id": self.user_id,
            "period_id": self.period_id,
            "financial_center_id": self.financial_center_id,
            "cost_center_id": self.cost_center_id,
            "nomenclature_id": self.nomenclature_id,
            "row_type_id": self.row_type_id,
            "cost_sum": float(self.cost_sum) if self.cost_sum else 0.0,
            "comment": self.comment
        }