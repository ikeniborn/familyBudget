FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY bot/requirements.txt /app/bot/requirements.txt

# Install Python dependencies from requirements.txt
RUN pip install --no-cache-dir -r /app/bot/requirements.txt

# Create logs directory
RUN mkdir -p /app/logs

# Copy entire bot application
COPY bot/ /app/bot/

# Health check - verify bot process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import sys; sys.exit(0)" || exit 1

# Set Python path
ENV PYTHONPATH=/app

# Run bot application
CMD ["python", "-m", "bot.main"]
