#!/bin/bash
#
# scripts/lib/timeout.sh - Timeout and Retry Infrastructure
#
# This module provides configurable timeout and retry mechanisms with exponential backoff:
# - Exponential backoff retry logic
# - Specialized wrappers for apt, npm, curl, docker operations
# - Configurable timeouts via environment variables
#
# Dependencies: config.sh, utils.sh
#
# Usage:
#   source scripts/lib/timeout.sh
#   apt_with_retry update -y
#   npm_with_retry ci
#
# Part of Installation Resilience Framework
#

# =============================================================================
# CONFIGURATION (Environment Variables with Defaults)
# =============================================================================

# Timeout values (in seconds)
: "${TIMEOUT_APT_UPDATE:=300}"        # 5 minutes
: "${TIMEOUT_APT_UPGRADE:=600}"       # 10 minutes
: "${TIMEOUT_APT_INSTALL:=600}"       # 10 minutes
: "${TIMEOUT_NPM_INSTALL:=900}"       # 15 minutes
: "${TIMEOUT_CURL:=60}"               # 1 minute
: "${TIMEOUT_DOCKER_PULL:=600}"       # 10 minutes

# Retry configuration
: "${MAX_RETRY_ATTEMPTS:=3}"
: "${RETRY_BASE_DELAY:=5}"            # First retry: 5 seconds
: "${RETRY_MAX_DELAY:=60}"            # Cap at 60 seconds

# =============================================================================
# CORE RETRY FUNCTIONS
# =============================================================================

# Calculate exponential backoff delay
# Args:
#   $1: attempt number (1, 2, 3, ...)
# Returns:
#   delay in seconds (5, 10, 20, 40, 60, ...)
# Algorithm: delay = min(RETRY_BASE_DELAY * 2^(attempt-1), RETRY_MAX_DELAY)
calculate_backoff_delay() {
    local attempt=$1

    if [[ ! "$attempt" =~ ^[0-9]+$ ]] || [[ $attempt -lt 1 ]]; then
        echo "$RETRY_BASE_DELAY"
        return
    fi

    # Calculate: RETRY_BASE_DELAY * 2^(attempt-1)
    local delay=$RETRY_BASE_DELAY
    local exponent=$((attempt - 1))

    for ((i = 0; i < exponent; i++)); do
        delay=$((delay * 2))
    done

    # Cap at RETRY_MAX_DELAY
    if [[ $delay -gt $RETRY_MAX_DELAY ]]; then
        delay=$RETRY_MAX_DELAY
    fi

    echo "$delay"
}

# Generic retry wrapper with timeout
# Args:
#   $1: timeout value in seconds
#   $2: max retry attempts
#   $3: operation description (for logging)
#   $@: command to execute
# Returns:
#   0 if command succeeds
#   exit code of last failed attempt
execute_with_retry() {
    local timeout_value=$1
    local max_attempts=$2
    local description=$3
    shift 3
    local command=("$@")

    local attempt=1
    local exit_code=0

    while [[ $attempt -le $max_attempts ]]; do
        info "[$attempt/$max_attempts] $description..."

        # Execute command with timeout
        if timeout "$timeout_value" "${command[@]}" >> "$LOG_FILE" 2>&1; then
            if [[ $attempt -gt 1 ]]; then
                success "$description (succeeded on attempt $attempt)"
            fi
            return 0
        else
            exit_code=$?

            if [[ $attempt -lt $max_attempts ]]; then
                local delay
                delay=$(calculate_backoff_delay "$attempt")
                warning "$description failed (attempt $attempt/$max_attempts), retrying in ${delay}s..."
                sleep "$delay"
            else
                error_return "$description failed after $max_attempts attempts (exit code: $exit_code)"
                if command -v get_last_error_lines &>/dev/null; then
                    echo ""
                    error_return "Last errors from log:"
                    get_last_error_lines "$LOG_FILE" 5
                    echo ""
                fi
            fi
        fi

        ((attempt++))
    done

    return "$exit_code"
}

# =============================================================================
# APT WRAPPER FUNCTIONS
# =============================================================================

# apt-get wrapper with retry and timeout
# Args:
#   $1: apt-get subcommand (update, upgrade, install, etc.)
#   $@: additional arguments
# Examples:
#   apt_with_retry update -y
#   apt_with_retry install -y docker-ce
apt_with_retry() {
    local subcommand=$1
    shift
    local args=("$@")

    local timeout_value
    local description

    case "$subcommand" in
        update)
            timeout_value=$TIMEOUT_APT_UPDATE
            description="apt-get update"
            ;;
        upgrade|dist-upgrade|full-upgrade)
            timeout_value=$TIMEOUT_APT_UPGRADE
            description="apt-get $subcommand"
            ;;
        install)
            timeout_value=$TIMEOUT_APT_INSTALL
            description="apt-get install ${args[*]}"
            ;;
        *)
            timeout_value=$TIMEOUT_APT_INSTALL
            description="apt-get $subcommand ${args[*]}"
            ;;
    esac

    # Update package lists before retry (except for 'update' itself)
    local attempt=1
    local exit_code=0

    while [[ $attempt -le $MAX_RETRY_ATTEMPTS ]]; do
        info "[$attempt/$MAX_RETRY_ATTEMPTS] $description..."

        # Execute apt-get command with timeout
        if timeout "$timeout_value" apt-get "$subcommand" "${args[@]}" >> "$LOG_FILE" 2>&1; then
            if [[ $attempt -gt 1 ]]; then
                success "$description (succeeded on attempt $attempt)"
            fi
            return 0
        else
            exit_code=$?

            if [[ $attempt -lt $MAX_RETRY_ATTEMPTS ]]; then
                local delay
                delay=$(calculate_backoff_delay "$attempt")
                warning "$description failed (attempt $attempt/$MAX_RETRY_ATTEMPTS), retrying in ${delay}s..."

                # Clean apt cache before retry
                if [[ "$subcommand" != "update" ]]; then
                    apt-get clean >> "$LOG_FILE" 2>&1 || true
                    # Update package lists before retry
                    timeout "$TIMEOUT_APT_UPDATE" apt-get update -y >> "$LOG_FILE" 2>&1 || true
                fi

                sleep "$delay"
            else
                error_return "$description failed after $MAX_RETRY_ATTEMPTS attempts (exit code: $exit_code)"
                if command -v get_last_error_lines &>/dev/null; then
                    echo ""
                    error_return "Last errors from log:"
                    get_last_error_lines "$LOG_FILE" 5
                    echo ""
                fi
                if command -v suggest_fix_apt_update &>/dev/null; then
                    suggest_fix_apt_update
                fi
            fi
        fi

        ((attempt++))
    done

    return "$exit_code"
}

# =============================================================================
# CURL WRAPPER FUNCTIONS
# =============================================================================

# curl wrapper with retry and timeout
# Args:
#   $@: curl command and arguments
# Examples:
#   curl_with_retry -fsSL https://example.com/file
curl_with_retry() {
    local args=("$@")
    local description="curl ${args[*]}"

    # Extract URL for better logging (if present)
    for arg in "${args[@]}"; do
        if [[ "$arg" =~ ^https?:// ]]; then
            description="curl $arg"
            break
        fi
    done

    execute_with_retry "$TIMEOUT_CURL" "$MAX_RETRY_ATTEMPTS" "$description" curl "${args[@]}"
}

# =============================================================================
# DOCKER WRAPPER FUNCTIONS
# =============================================================================

# docker pull wrapper with retry and timeout
# Args:
#   $1: image name
# Examples:
#   docker_pull_with_retry postgres:16
docker_pull_with_retry() {
    local image=$1
    local description="docker pull $image"

    execute_with_retry "$TIMEOUT_DOCKER_PULL" "$MAX_RETRY_ATTEMPTS" "$description" docker pull "$image"
    local exit_code=$?

    if [[ $exit_code -ne 0 ]] && command -v suggest_fix_docker &>/dev/null; then
        suggest_fix_docker
    fi

    return "$exit_code"
}

# =============================================================================
# TESTING AND DIAGNOSTICS
# =============================================================================

# Test exponential backoff function
# For development/testing only
test_exponential_backoff() {
    echo "Testing exponential backoff (BASE=$RETRY_BASE_DELAY, MAX=$RETRY_MAX_DELAY):"
    for attempt in {1..8}; do
        local delay
        delay=$(calculate_backoff_delay "$attempt")
        echo "  Attempt $attempt: ${delay}s"
    done
}

# Display current timeout configuration
# For development/testing only
show_timeout_config() {
    echo "Timeout Configuration:"
    echo "  TIMEOUT_APT_UPDATE:    ${TIMEOUT_APT_UPDATE}s"
    echo "  TIMEOUT_APT_UPGRADE:   ${TIMEOUT_APT_UPGRADE}s"
    echo "  TIMEOUT_APT_INSTALL:   ${TIMEOUT_APT_INSTALL}s"
    echo "  TIMEOUT_NPM_INSTALL:   ${TIMEOUT_NPM_INSTALL}s"
    echo "  TIMEOUT_CURL:          ${TIMEOUT_CURL}s"
    echo "  TIMEOUT_DOCKER_PULL:   ${TIMEOUT_DOCKER_PULL}s"
    echo ""
    echo "Retry Configuration:"
    echo "  MAX_RETRY_ATTEMPTS:    $MAX_RETRY_ATTEMPTS"
    echo "  RETRY_BASE_DELAY:      ${RETRY_BASE_DELAY}s"
    echo "  RETRY_MAX_DELAY:       ${RETRY_MAX_DELAY}s"
}
