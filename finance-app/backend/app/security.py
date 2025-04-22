from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import settings
from . import schemas

# Configure passlib context
# Using bcrypt as the default hashing algorithm
# Deprecated="auto" handles upgrading hashes if needed in the future
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hashes a plain password."""
    return pwd_context.hash(password)


# --- JWT Handling ---


def create_access_token(
    data: dict, expires_delta: Optional[timedelta] = None
) -> str:
    """Creates a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


# Note: verify_token is often part of the dependency that gets the current user
# This is a basic structure; the actual implementation depends on how
# authentication dependencies are structured.
def decode_access_token(token: str) -> Optional[schemas.TokenData]:
    """Decodes the access token and returns the payload data."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        # Extract subject ('sub') which should be the user identifier
        # Add more fields to TokenData if needed (e.g., scopes, user_id)
        token_sub = payload.get("sub")
        if token_sub is None:
            return None  # Or raise specific error
        # Assuming 'sub' contains email for now, adjust if needed
        return schemas.TokenData(email=token_sub)
    except JWTError:
        return None  # Token is invalid or expired