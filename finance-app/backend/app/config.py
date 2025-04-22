from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables or .env file.
    """
    # Database Configuration
    DATABASE_URL: str
    
    # JWT Configuration
    # IMPORTANT: Use environment variables for SECRET_KEY in production!
    # Generate a strong secret key, e.g., using: openssl rand -hex 32
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # Token validity period

    # Telegram Configuration (Add these later)
    TELEGRAM_BOT_TOKEN: str

    # Use .env file and case sensitivity
    model_config = SettingsConfigDict(env_file='.env', case_sensitive=True)


# Create a single instance of the settings to be imported elsewhere
settings = Settings()