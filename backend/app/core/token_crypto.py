"""
Symmetric encryption for the AI provider token at rest.

The Fernet key is derived from JWT_SECRET (SHA-256 -> urlsafe base64), so no
extra key material has to be provisioned. Rotating JWT_SECRET makes previously
encrypted tokens undecryptable; decrypt_token then returns None and the admin
re-enters the token — same effect as the session invalidation the rotation
already causes.

Storage format: "enc:<fernet token>". Values without the prefix are legacy
plaintext and are returned unchanged, so pre-encryption rows keep working.
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from backend.app.core.config import get_settings

_PREFIX = "enc:"


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(
        hashlib.sha256(get_settings().JWT_SECRET.encode()).digest()
    )
    return Fernet(key)


def encrypt_token(token: str) -> str:
    """Encrypt a plaintext token for storage."""
    return _PREFIX + _fernet().encrypt(token.encode()).decode()


def decrypt_token(stored: str | None) -> str | None:
    """Return the plaintext token, or None when it cannot be decrypted."""
    if stored is None or not stored.startswith(_PREFIX):
        return stored
    try:
        return _fernet().decrypt(stored[len(_PREFIX):].encode()).decode()
    except InvalidToken:
        return None
