"""
Period model.
"""
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship

from app.db.database import Base


class Period(Base):
    """Period model matching Prisma Period schema."""
    
    __tablename__ = "t_d_period"
    
    id = Column("period_id", Integer, primary_key=True, index=True)
    date = Column("period_dt", DateTime, nullable=False)
    ru_name = Column("period_ru_name", String, nullable=False)
    start_date = Column("period_start_date", DateTime, nullable=True)
    end_date = Column("period_end_date", DateTime, nullable=True)
    
    # Relationships
    registries = relationship("Registry", back_populates="period")
    
    def __repr__(self):
        return f"<Period(id={self.id}, ru_name='{self.ru_name}')>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "date": self.date.isoformat() if self.date else None,
            "ru_name": self.ru_name,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None
        }