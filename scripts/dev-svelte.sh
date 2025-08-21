#!/bin/bash

# Development script for SvelteKit frontend
# Usage: ./scripts/dev-svelte.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_SVELTE_DIR="$PROJECT_ROOT/frontend-svelte"

echo "🚀 Starting SvelteKit development environment..."

# Check if frontend-svelte directory exists
if [ ! -d "$FRONTEND_SVELTE_DIR" ]; then
    echo "❌ frontend-svelte directory not found!"
    exit 1
fi

cd "$FRONTEND_SVELTE_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Copy .env file if it doesn't exist
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
fi

# Start development server
echo "🔧 Starting SvelteKit dev server on port 5173..."
npm run dev -- --host --port 5173

echo "✅ SvelteKit frontend is running at http://localhost:5173"