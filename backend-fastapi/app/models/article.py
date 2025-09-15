"""
Article model.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class Article(Base):
    """Article model for categorizing nomenclatures with shared reference data support."""

    __tablename__ = "t_d_article"

    id = Column("article_id", Integer, primary_key=True, index=True)
    code = Column("article_code", String(50), nullable=False, unique=True)
    name = Column("article_name", String, nullable=False)
    description = Column("description", String(500), nullable=True)
    is_active = Column("is_active", Boolean, default=True)
    user_id = Column("user_id", Integer, nullable=True, index=True)  # Nullable for shared records
    created_by = Column("created_by", Integer, ForeignKey("t_d_user.user_id"), nullable=True)
    managed_by = Column("managed_by", Integer, ForeignKey("t_d_user.user_id"), nullable=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now())
    updated_at = Column("updated_at", DateTime(timezone=True), onupdate=func.now())

    # Global unique constraint on code (shared reference data)
    __table_args__ = ()

    # Relationships
    nomenclatures = relationship("Nomenclature", back_populates="article")
    creator = relationship("User", foreign_keys=[created_by])
    manager = relationship("User", foreign_keys=[managed_by])

    def __repr__(self):
        return f"<Article(id={self.id}, name='{self.name}', code='{self.code}')>"

    def to_dict(self):
        return {
            "article_id": self.id,
            "article_code": self.code,
            "article_name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "user_id": self.user_id,
            "created_by": self.created_by,
            "managed_by": self.managed_by,
            "is_shared": self.user_id is None,
            "is_editable": True,  # Will be determined by business logic
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }