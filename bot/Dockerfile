FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies for Telegram bot
RUN pip install --no-cache-dir \
    python-telegram-bot==20.7 \
    python-dotenv==1.0.0 \
    requests==2.31.0 \
    httpx==0.25.2

# Create bot directory structure
RUN mkdir -p /app/bot /app/logs

# Copy bot files (placeholder for now)
COPY bot/__init__.py /app/bot/__init__.py

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "print('Bot is running')" || exit 1

# Placeholder command until bot is fully implemented
# This keeps the container running and allows for future bot integration
CMD ["sh", "-c", "echo 'Telegram Bot container started' && echo 'Bot implementation pending - container running as placeholder' && echo 'Ready for bot integration...' && while true; do sleep 3600; done"]
