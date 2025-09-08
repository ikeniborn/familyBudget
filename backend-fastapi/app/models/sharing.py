"""
Sharing model for user data sharing functionality.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class Sharing(Base):
    """Sharing model for managing data sharing between users."""
    
    __tablename__ = "t_d_sharing"
    
    id = Column("sharing_id", Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("t_d_user.user_id", ondelete="CASCADE"), nullable=False)
    shared_with_user_id = Column(Integer, ForeignKey("t_d_user.user_id", ondelete="CASCADE"), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(Integer, nullable=True)
    permission_type = Column(String(20), nullable=False, default="read")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column("created_dttm", DateTime(timezone=True), server_default=func.now())
    updated_at = Column("updated_dttm", DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", foreign_keys=[owner_user_id], lazy="select")
    shared_with = relationship("User", foreign_keys=[shared_with_user_id], lazy="select")
    
    def __repr__(self):
        return f"<Sharing(id={self.id}, owner_id={self.owner_user_id}, shared_with_id={self.shared_with_user_id}, type={self.resource_type})>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "owner_user_id": self.owner_user_id,
            "shared_with_user_id": self.shared_with_user_id,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "permission_type": self.permission_type,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "owner": self.owner.to_dict() if self.owner else None,
            "shared_with": self.shared_with.to_dict() if self.shared_with else None
        }