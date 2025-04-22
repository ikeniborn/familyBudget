# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies if needed (e.g., for psycopg2 build if not using binary)
# RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Install Poetry (Optional, if using Poetry for dependency management)
# RUN pip install poetry
# COPY poetry.lock pyproject.toml ./
# RUN poetry config virtualenvs.create false && poetry install --no-dev --no-interaction --no-ansi

# Install dependencies using pip and requirements.txt
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Define the command to run the application
# Use --host 0.0.0.0 to make it accessible from outside the container
# Use --reload for development (remove or disable for production)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]