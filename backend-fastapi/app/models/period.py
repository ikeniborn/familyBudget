"""
Period model.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class Period(Base):
    """Period model matching Prisma Period schema."""
    
    __tablename__ = "t_d_period"
    
    id = Column("period_id", Integer, primary_key=True, index=True)
    code = Column("period_code", String(20), nullable=True, unique=True)
    date = Column("period_dt", DateTime, nullable=False)
    ru_name = Column("period_ru_name", String, nullable=False)
    start_date = Column("period_start_date", DateTime, nullable=True)
    end_date = Column("period_end_date", DateTime, nullable=True)
    user_id = Column("user_id", Integer, nullable=True, index=True)  # Nullable for shared records
    created_by = Column("created_by", Integer, ForeignKey("t_d_user.user_id"), nullable=True)
    managed_by = Column("managed_by", Integer, ForeignKey("t_d_user.user_id"), nullable=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now())
    updated_at = Column("updated_at", DateTime(timezone=True), onupdate=func.now())
    
    # Global unique constraint on code (shared reference data)
    __table_args__ = ()

    # Relationships
    registries = relationship("Registry", back_populates="period")
    creator = relationship("User", foreign_keys=[created_by])
    manager = relationship("User", foreign_keys=[managed_by])
    
    def __repr__(self):
        return f"<Period(id={self.id}, ru_name='{self.ru_name}')>"
    
    def to_dict(self):
        return {
            "period_id": self.id,
            "period_code": self.code,
            "period_dt": self.date.isoformat() if self.date else None,
            "period_ru_name": self.ru_name,
            "period_start_date": self.start_date.isoformat() if self.start_date else None,
            "period_end_date": self.end_date.isoformat() if self.end_date else None,
            "user_id": self.user_id,
            "created_by": self.created_by,
            "managed_by": self.managed_by,
            "is_shared": self.user_id is None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }