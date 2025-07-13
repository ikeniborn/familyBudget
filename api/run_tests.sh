#!/bin/bash

# Run tests with coverage for FastAPI backend

echo "Running FastAPI Backend Tests..."
echo "================================"

# Install test dependencies if not already installed
pip install -r requirements.txt 2>/dev/null

# Run unit tests
echo -e "\n📋 Running Unit Tests..."
python -m pytest tests/unit/ -v --cov=. --cov-report=term-missing --cov-report=html

# Run integration tests
echo -e "\n🔗 Running Integration Tests..."
python -m pytest tests/integration/ -v -m integration

# Run all tests with coverage report
echo -e "\n📊 Running All Tests with Coverage..."
python -m pytest tests/ -v --cov=. --cov-report=term-missing --cov-report=html --cov-fail-under=80

# Display coverage summary
echo -e "\n📈 Coverage Summary:"
python -m pytest --cov=. --cov-report=term tests/ -q

echo -e "\n✅ Testing completed! Check htmlcov/index.html for detailed coverage report."