#!/bin/bash
#
# config.sh - Global Configuration and State Management
#
# This module defines global variables, constants, and state management
# for the Family Budget deployment script.
#
# Usage:
#   source scripts/lib/config.sh
#
# Dependencies: None (must be sourced first)
#

# =============================================================================
# DIRECTORY CONFIGURATION
# =============================================================================

# Auto-detect script directory (where deploy.sh is located)
# This is set by deploy.sh before sourcing this module
# SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Deployment directory (runtime files, Docker volumes, logs)
DEPLOY_DIR="/opt/budget"

# Project name (used for Docker container naming)
PROJECT_NAME="familybudget"

# Log file path
LOG_FILE="$DEPLOY_DIR/logs/deploy.log"

# =============================================================================
# COLOR CONSTANTS (for terminal output)
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# DEPLOYMENT OPTIONS (set by command-line arguments)
# =============================================================================

# Run mode
DETACH_MODE=true          # Run containers in detached mode (default)

# Migration control
RUN_MIGRATIONS=true       # Run database migrations after deployment

# Cleanup mode
CLEAN_DEPLOY=false        # Clean deployment (remove volumes) - WARNING: DELETES DATA!

# Docker Compose profile
COMPOSE_PROFILE=""        # "" (postgres+backend) or "full" (all services)

# Code synchronization mode
SYNC_MODE=""              # mirror|update|clean|skip (empty = interactive)

# Repository directory (for code sync)
REPO_DIR_OVERRIDE=""      # User-specified repository directory (empty = auto-detect)

# =============================================================================
# STATE MANAGEMENT (modified during deployment)
# =============================================================================

# PostgreSQL state tracking (prevent race conditions)
# This flag tracks whether PostgreSQL was stopped during cleanup.
# - false = PostgreSQL kept running (selective restart) - skip integrity checks
# - true  = PostgreSQL was stopped - safe to perform integrity checks
POSTGRES_WAS_STOPPED=true

# State transition functions
set_postgres_stopped() {
    POSTGRES_WAS_STOPPED=true
}

set_postgres_running() {
    POSTGRES_WAS_STOPPED=false
}

is_postgres_was_stopped() {
    [[ "$POSTGRES_WAS_STOPPED" == "true" ]]
}

# =============================================================================
# SERVICE CONFIGURATION
# =============================================================================

# Health check configuration
MAX_WAIT_TIME=120         # Maximum wait time for services (seconds)
CHECK_INTERVAL=5          # Interval between health checks (seconds)

# =============================================================================
# EXPORTS
# =============================================================================

# Export all variables so they're available to child processes
export SCRIPT_DIR
export DEPLOY_DIR
export PROJECT_NAME
export LOG_FILE

export RED GREEN YELLOW BLUE MAGENTA CYAN NC

export DETACH_MODE
export RUN_MIGRATIONS
export CLEAN_DEPLOY
export COMPOSE_PROFILE
export SYNC_MODE
export REPO_DIR_OVERRIDE

export POSTGRES_WAS_STOPPED

export MAX_WAIT_TIME
export CHECK_INTERVAL
