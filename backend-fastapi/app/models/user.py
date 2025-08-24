"""
User model.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    """User model matching Prisma User schema."""
    
    __tablename__ = "t_d_user"
    
    id = Column("user_id", Integer, primary_key=True, index=True)
    user_name = Column(String, nullable=False)
    user_email = Column(String, nullable=True)
    username = Column("user_login", String, unique=True, nullable=True)
    password_hash = Column("user_password", String, nullable=True)
    telegram_id = Column("user_telegram_id", BigInteger, unique=True, nullable=True)
    refresh_token = Column(String, nullable=True)
    auth_method = Column(String, nullable=False, default="telegram")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column("created_dttm", DateTime(timezone=True), server_default=func.now())
    updated_at = Column("updated_dttm", DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    registries = relationship("Registry", back_populates="user", lazy="dynamic")
    product_prices = relationship("ProductPrice", back_populates="user", lazy="dynamic")
    
    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, auth_method={self.auth_method})>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_name": self.user_name,
            "user_email": self.user_email,
            "username": self.username,
            "telegram_id": str(self.telegram_id) if self.telegram_id else None,
            "auth_method": self.auth_method,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }