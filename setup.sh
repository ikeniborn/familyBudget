#!/bin/bash
#
# Family Budget - Interactive Setup Script
#
# This script provides interactive configuration for Family Budget application:
# - Creates .env file from template in /opt/budget
# - Generates secure secrets (JWT_SECRET, passwords)
# - Prompts for required configuration (Telegram bot token, admin ID)
# - Configures UFW firewall with IP restriction for PostgreSQL (CRITICAL SECURITY)
# - Generates nginx configuration (for full profile)
# - Validates configuration
# - Optionally builds Docker images
#
# NOTE: This script does NOT copy source code. Use deploy.sh for code synchronization.
#
# Usage:
#   ./setup.sh [OPTIONS]
#
# Options:
#   -h, --help              Show this help message
#   -y, --yes               Accept all defaults (non-interactive)
#   --skip-ufw              Skip UFW configuration
#   --skip-build            Skip Docker image building
#
# IMPORTANT SECURITY:
#   This script configures UFW firewall to restrict PostgreSQL external access
#   to a specific IP address. This is CRITICAL for production security.
#
# Author: Family Budget Team
# Version: 2.0.0
# Date: 2025-10-19
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="familybudget"

# Deployment directory (where the application will be deployed)
DEPLOY_DIR="/opt/budget"
REPO_DIR="$SCRIPT_DIR"  # Repository directory (source code)

LOG_FILE="$DEPLOY_DIR/logs/setup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default options
NON_INTERACTIVE=false
SKIP_UFW=false
SKIP_BUILD=false

# Configuration values (will be populated)
declare -A CONFIG

# =============================================================================
# SOURCE EXTERNAL LIBRARIES
# =============================================================================

# Source utils.sh for helper functions (validate_email, generate_admin_password, etc.)
if [[ -f "$SCRIPT_DIR/scripts/lib/utils.sh" ]]; then
    source "$SCRIPT_DIR/scripts/lib/utils.sh"
elif [[ -f "scripts/lib/utils.sh" ]]; then
    source "scripts/lib/utils.sh"
else
    echo "[ERROR] Could not find scripts/lib/utils.sh - required for setup"
    exit 1
fi

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# Print colored message
print_message() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

# Print info message
info() {
    print_message "$BLUE" "[INFO] $*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [INFO] $*" >> "$LOG_FILE"
}

# Print success message
success() {
    print_message "$GREEN" "[SUCCESS] $*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [SUCCESS] $*" >> "$LOG_FILE"
}

# Print warning message
warning() {
    print_message "$YELLOW" "[WARNING] $*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [WARNING] $*" >> "$LOG_FILE"
}

# Print error message and exit
error() {
    print_message "$RED" "[ERROR] $*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR] $*" >> "$LOG_FILE"
    exit 1
}

# Detect CPU resources
detect_cpu_resources() {
    info "Detecting CPU resources..."

    # Get number of CPUs
    local cpu_count
    cpu_count=$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null || echo "1")

    CONFIG[CPU_COUNT]=$cpu_count

    info "Detected CPUs: $cpu_count"

    # Calculate optimal CPU limits based on available cores
    calculate_cpu_limits "$cpu_count"

    success "CPU resources detected and limits calculated"
}

# Calculate CPU limits for Docker containers
calculate_cpu_limits() {
    local cpu_count=$1

    info "Calculating optimal CPU limits for $cpu_count CPU(s)..."

    # Strategy:
    # - Single CPU (1 core): Conservative limits, total ≤ 1.0
    # - Multi CPU (2+ cores): Higher limits for better performance
    #
    # Priority allocation:
    # - Backend: 80% of resources (main workload)
    # - Bot: 15% of resources (lightweight)
    # - Nginx: 5% of resources (proxy only)

    if [[ $cpu_count -eq 1 ]]; then
        # Single CPU server - conservative limits
        # IMPORTANT: Total must be < 1.0 (not = 1.0) on single-CPU systems
        # Docker enforces: "range of CPUs is from 0.01 to 1.00" (exclusive upper bound)
        CONFIG[BACKEND_CPU_LIMIT]="0.75"
        CONFIG[BACKEND_CPU_RESERVATION]="0.25"
        CONFIG[BOT_CPU_LIMIT]="0.15"
        CONFIG[BOT_CPU_RESERVATION]="0.05"
        CONFIG[NGINX_CPU_LIMIT]="0.05"
        CONFIG[NGINX_CPU_RESERVATION]="0.01"

        info "Single-CPU configuration:"
        info "  Backend: 0.75 CPU (79%)"
        info "  Bot: 0.15 CPU (16%)"
        info "  Nginx: 0.05 CPU (5%)"
        info "  Total: 0.95 CPU (< 1.0 required)"

    elif [[ $cpu_count -eq 2 ]]; then
        # Dual CPU server - balanced limits
        CONFIG[BACKEND_CPU_LIMIT]="1.5"
        CONFIG[BACKEND_CPU_RESERVATION]="0.5"
        CONFIG[BOT_CPU_LIMIT]="0.4"
        CONFIG[BOT_CPU_RESERVATION]="0.1"
        CONFIG[NGINX_CPU_LIMIT]="0.1"
        CONFIG[NGINX_CPU_RESERVATION]="0.02"

        info "Dual-CPU configuration:"
        info "  Backend: 1.5 CPU (75%)"
        info "  Bot: 0.4 CPU (20%)"
        info "  Nginx: 0.1 CPU (5%)"
        info "  Total: 2.0 CPU"

    else
        # Multi-CPU server (4+ cores) - high performance limits
        # Scale with available CPUs
        local backend_limit=$(echo "$cpu_count * 0.75" | bc)
        local backend_reserve=$(echo "$cpu_count * 0.25" | bc)
        local bot_limit=$(echo "$cpu_count * 0.20" | bc)
        local bot_reserve=$(echo "$cpu_count * 0.05" | bc)
        local nginx_limit=$(echo "$cpu_count * 0.05" | bc)
        local nginx_reserve="0.01"

        CONFIG[BACKEND_CPU_LIMIT]="$backend_limit"
        CONFIG[BACKEND_CPU_RESERVATION]="$backend_reserve"
        CONFIG[BOT_CPU_LIMIT]="$bot_limit"
        CONFIG[BOT_CPU_RESERVATION]="$bot_reserve"
        CONFIG[NGINX_CPU_LIMIT]="$nginx_limit"
        CONFIG[NGINX_CPU_RESERVATION]="$nginx_reserve"

        info "Multi-CPU configuration ($cpu_count cores):"
        info "  Backend: $backend_limit CPU (75%)"
        info "  Bot: $bot_limit CPU (20%)"
        info "  Nginx: $nginx_limit CPU (5%)"
    fi

    success "CPU limits calculated based on available resources"
}

# Print section header
section() {
    echo ""
    print_message "$MAGENTA" "========================================"
    print_message "$MAGENTA" "$*"
    print_message "$MAGENTA" "========================================"
    echo ""
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# =============================================================================
# DEPLOYMENT DIRECTORY VALIDATION
# =============================================================================

# Check that deployment directory exists and is writable
check_deploy_dir() {
    section "Checking Deployment Directory"

    info "Deployment directory: $DEPLOY_DIR"
    echo ""

    # Check if deployment directory exists
    if [[ ! -d "$DEPLOY_DIR" ]]; then
        error "Deployment directory $DEPLOY_DIR does not exist"
        echo ""
        info "Please run install.sh first:"
        echo "  sudo ./install.sh"
        echo ""
        exit 1
    fi

    # Check if it's writable
    if [[ ! -w "$DEPLOY_DIR" ]]; then
        error "Deployment directory $DEPLOY_DIR is not writable"
        echo ""
        info "Fix permissions with:"
        echo "  sudo chown -R \$USER:\$USER $DEPLOY_DIR"
        echo ""
        exit 1
    fi

    # Ensure required subdirectories exist
    local required_dirs=("backups" "logs" "nginx/conf.d")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$DEPLOY_DIR/$dir" ]]; then
            info "Creating directory: $DEPLOY_DIR/$dir"
            mkdir -p "$DEPLOY_DIR/$dir" || error "Failed to create directory: $dir"
        fi
    done

    # Verify required template files exist
    info "Checking required template files..."
    local required_templates=(
        "$DEPLOY_DIR/nginx/conf.d/app-http.conf.template"
        "$DEPLOY_DIR/.env.example"
    )

    local missing_templates=()
    for template in "${required_templates[@]}"; do
        if [[ ! -f "$template" ]]; then
            missing_templates+=("$template")
        fi
    done

    if [[ ${#missing_templates[@]} -gt 0 ]]; then
        error "Required template files are missing from $DEPLOY_DIR:"
        for template in "${missing_templates[@]}"; do
            echo "  ✗ $template"
        done
        echo ""
        warning "This typically means install.sh was not run correctly."
        echo ""

        # ENHANCEMENT v1.1.0: Attempt auto-detection of repository directory
        info "Attempting to auto-detect repository directory..."

        # Source utils.sh to get detect_repo_directory function
        local script_dir
        script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

        if [[ -f "$script_dir/scripts/lib/utils.sh" ]]; then
            source "$script_dir/scripts/lib/utils.sh"
        elif [[ -f "scripts/lib/utils.sh" ]]; then
            source "scripts/lib/utils.sh"
        else
            warning "Could not find scripts/lib/utils.sh - skipping auto-detection"
        fi

        # Try auto-detection if function is available
        if command -v detect_repo_directory &>/dev/null; then
            local detected_repo
            detected_repo=$(detect_repo_directory "$(pwd)" 2>/dev/null)

            if [[ $? -eq 0 ]] && [[ -n "$detected_repo" ]]; then
                # Auto-detection succeeded
                echo ""
                success "Repository found: $detected_repo"
                echo ""
                info "OPTION 1 - Re-run install.sh from correct directory (RECOMMENDED):"
                echo ""
                echo "  cd $detected_repo"
                echo "  sudo ./install.sh"
                echo ""
                info "OPTION 2 - Manual copy of template files (ADVANCED):"
                echo ""
                echo "  sudo cp $detected_repo/nginx/conf.d/app-http.conf.template $DEPLOY_DIR/nginx/conf.d/"
                echo "  sudo cp $detected_repo/nginx/conf.d/app-https.conf.template $DEPLOY_DIR/nginx/conf.d/"
                echo "  sudo cp $detected_repo/.env.example $DEPLOY_DIR/"
                echo ""
                echo "  Then re-run setup.sh:"
                echo "  ./setup.sh"
                echo ""
            else
                # Auto-detection failed
                echo ""
                info "Please run install.sh from the repository directory:"
                echo ""
                echo "  cd ~/familyBudget  # (or your repository location)"
                echo "  sudo ./install.sh"
                echo ""
            fi
        else
            # Function not available
            echo ""
            info "Please run install.sh from the repository directory:"
            echo ""
            echo "  cd ~/familyBudget  # (or your repository location)"
            echo "  sudo ./install.sh"
            echo ""
        fi

        exit 1
    fi

    info "All required template files present"
    success "Deployment directory OK: $DEPLOY_DIR"
}

# Print help message
print_help() {
    cat << EOF
Family Budget - Interactive Setup Script

Usage:
  ./setup.sh [OPTIONS]

Options:
  -h, --help              Show this help message
  -y, --yes               Accept all defaults (non-interactive)
  --skip-ufw              Skip UFW configuration
  --skip-build            Skip Docker image building

What this script does:
  1. Creates .env configuration file in $DEPLOY_DIR
  2. Generates secure secrets (JWT_SECRET, passwords)
  3. Generates nginx config (if full profile)
  4. Configures UFW firewall (if PostgreSQL external access enabled)
  5. Optionally builds Docker images

NOTE: This script does NOT copy source code.
      Use deploy.sh for code synchronization and deployment.

Recommended Workflow:
  1. sudo ./install.sh              # One-time: system dependencies
  2. ./setup.sh                     # Configure .env and secrets
  3. ./deploy.sh                    # Sync code + deploy containers

Interactive Prompts:
  - PostgreSQL password (or auto-generate)
  - JWT secret key (auto-generated)
  - Telegram bot token
  - Admin Telegram ID
  - Deployment profile (basic/full)
  - Domain name (for full profile)
  - PostgreSQL external access (with IP restriction)
  - S3 backup configuration (optional)

UFW Configuration (CRITICAL SECURITY):
  If PostgreSQL external access is enabled, this script configures
  UFW firewall to allow connections ONLY from a specific IP address.

  Example:
    PostgreSQL external access: yes
    Allowed IP: 203.0.113.50

    UFW rule created:
      ufw allow from 203.0.113.50 to any port 5432

  This prevents unauthorized access to your database!

Prerequisites:
  - Docker and Docker Compose installed (run install.sh)
  - UFW firewall enabled (install.sh does this)
  - Deployment directory created: sudo ./install.sh

For more information, see CLAUDE.md
EOF
}

# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."

    # Check if Docker is installed
    if ! command_exists docker; then
        error "Docker is not installed. Please run install.sh first."
    fi

    # Check if Docker Compose is installed
    if ! docker compose version >/dev/null 2>&1; then
        error "Docker Compose is not installed. Please run install.sh first."
    fi

    # Check if .env.example exists
    if [[ ! -f "$SCRIPT_DIR/.env.example" ]]; then
        error ".env.example template not found"
    fi

    # Check if UFW is installed
    if ! command_exists ufw && [[ "$SKIP_UFW" == "false" ]]; then
        error "UFW is not installed. Please run install.sh first."
    fi

    success "Prerequisites check passed"
}

# Validate IP address format
validate_ip() {
    local ip=$1

    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        local IFS='.'
        local -a octets=($ip)

        for octet in "${octets[@]}"; do
            if [[ $octet -gt 255 ]]; then
                return 1
            fi
        done

        return 0
    else
        return 1
    fi
}

# Validate Telegram ID (must be numeric)
validate_telegram_id() {
    local id=$1

    if [[ $id =~ ^[0-9]+$ ]]; then
        return 0
    else
        return 1
    fi
}

# =============================================================================
# GENERATION FUNCTIONS
# =============================================================================

# Generate random password
generate_password() {
    local length=${1:-32}

    if command_exists openssl; then
        openssl rand -base64 "$length" | tr -d "=+/" | cut -c1-"$length"
    else
        # Fallback to /dev/urandom
        tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$length"
    fi
}

# Generate JWT secret
generate_jwt_secret() {
    if command_exists openssl; then
        openssl rand -hex 32
    else
        # Fallback to /dev/urandom
        tr -dc 'a-f0-9' < /dev/urandom | head -c 64
    fi
}

# Generate VAPID keys for Web Push notifications
# Returns JSON with public_key and private_key
generate_vapid_keys() {
    # Check if Python and pywebpush are available
    if ! command_exists python3; then
        warning "Python3 not available, skipping VAPID key generation"
        return 1
    fi

    # Try to generate using py_vapid
    local vapid_output
    vapid_output=$(python3 << 'PYTHON_SCRIPT' 2>/dev/null
import json
try:
    from py_vapid import Vapid
    import base64
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

    # Generate new VAPID keys
    vapid = Vapid()
    vapid.generate_keys()

    # Public key: UncompressedPoint format (includes 0x04 prefix)
    # Works with cryptography 41.x (X962+UncompressedPoint instead of Raw)
    public_key_bytes = vapid.public_key.public_bytes(
        encoding=Encoding.X962,
        format=PublicFormat.UncompressedPoint
    )

    # Private key: extract raw 32 bytes via private_numbers
    private_numbers = vapid.private_key.private_numbers()
    private_key_bytes = private_numbers.private_value.to_bytes(32, byteorder='big')

    # Encode to base64url (no padding, URL-safe)
    def base64url_encode(data):
        return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

    print(json.dumps({
        "public_key": base64url_encode(public_key_bytes),
        "private_key": base64url_encode(private_key_bytes)
    }))
except ImportError:
    # pywebpush not installed
    print('{"error": "pywebpush not installed"}')
except Exception as e:
    print(json.dumps({"error": str(e)}))
PYTHON_SCRIPT
)

    if [[ $? -ne 0 || -z "$vapid_output" ]]; then
        return 1
    fi

    # Check for error in output
    if echo "$vapid_output" | grep -q '"error"'; then
        return 1
    fi

    echo "$vapid_output"
    return 0
}

# Ensure pywebpush is available for VAPID key generation
# Returns 0 if installed/installed successfully, exits with error if cannot install
ensure_pywebpush_installed() {
    if python3 -c "import py_vapid" 2>/dev/null; then
        return 0  # Already installed
    fi

    info "Installing pywebpush for VAPID key generation..."

    # Try standard pip install
    if pip3 install pywebpush >/dev/null 2>&1; then
        success "pywebpush installed successfully"
        return 0
    fi

    # Try with --break-system-packages for Debian 12+
    if pip3 install --break-system-packages pywebpush >/dev/null 2>&1; then
        success "pywebpush installed successfully"
        return 0
    fi

    # STRICT MODE: Fail if cannot install
    error "Failed to install pywebpush!"
    error "Push notifications require pywebpush package."
    echo ""
    info "Please install manually:"
    echo "  sudo pip3 install pywebpush"
    echo "  # or"
    echo "  pip3 install --user pywebpush"
    echo ""
    info "Then run setup.sh again."
    exit 1
}

# Get bot information from Telegram API
get_bot_info() {
    local token=$1

    if ! command_exists curl; then
        return 1
    fi

    local response
    response=$(curl -s --max-time 10 "https://api.telegram.org/bot${token}/getMe" 2>/dev/null)

    if [[ $? -eq 0 && -n "$response" ]]; then
        # Check if response is valid JSON with "ok":true
        if echo "$response" | grep -q '"ok":true'; then
            # Extract username using grep and sed
            echo "$response" | grep -o '"username":"[^"]*"' | sed 's/"username":"//;s/"$//'
            return 0
        fi
    fi

    return 1
}

# =============================================================================
# CONFIGURATION FUNCTIONS
# =============================================================================

# Prompt for value with default
prompt() {
    local prompt_text=$1
    local var_name=$2
    local default_value=${3:-}
    local is_secret=${4:-false}

    local prompt_msg="$prompt_text"
    if [[ -n "$default_value" ]]; then
        if [[ "$is_secret" == "true" ]]; then
            prompt_msg="$prompt_msg [auto-generated]"
        else
            prompt_msg="$prompt_msg [$default_value]"
        fi
    fi
    prompt_msg="$prompt_msg: "

    if [[ "$NON_INTERACTIVE" == "true" && -n "$default_value" ]]; then
        CONFIG[$var_name]=$default_value
        return
    fi

    if [[ "$is_secret" == "true" ]]; then
        read -s -p "$prompt_msg" input
        echo ""
    else
        read -p "$prompt_msg" input
    fi

    if [[ -z "$input" ]]; then
        CONFIG[$var_name]=$default_value
    else
        CONFIG[$var_name]=$input
    fi
}

# Prompt yes/no question
prompt_yes_no() {
    local prompt_text=$1
    local var_name=$2
    local default_value=${3:-"n"}

    if [[ "$NON_INTERACTIVE" == "true" ]]; then
        CONFIG[$var_name]=$default_value
        return
    fi

    local default_display
    if [[ "$default_value" == "y" ]]; then
        default_display="[Y/n]"
    else
        default_display="[y/N]"
    fi

    read -p "$prompt_text $default_display: " input

    if [[ -z "$input" ]]; then
        CONFIG[$var_name]=$default_value
    else
        CONFIG[$var_name]=${input,,}  # Convert to lowercase
    fi
}

# Collect configuration interactively
collect_configuration() {
    section "Application Configuration"

    # Generate secrets
    info "Generating secure secrets..."
    local generated_jwt_secret
    generated_jwt_secret=$(generate_jwt_secret)
    local generated_api_internal_key
    generated_api_internal_key=$(generate_jwt_secret)  # Same generation method (hex 32 bytes)
    local generated_postgres_password
    generated_postgres_password=$(generate_password 32)

    # Generate VAPID keys for Web Push notifications
    info "Preparing VAPID keys for push notifications..."

    # STRICT: pywebpush is REQUIRED - will exit if cannot install
    ensure_pywebpush_installed

    local generated_vapid_public_key=""
    local generated_vapid_private_key=""
    local vapid_json

    # Generate VAPID keys
    if vapid_json=$(generate_vapid_keys 2>&1); then
        generated_vapid_public_key=$(echo "$vapid_json" | python3 -c "import sys, json; print(json.load(sys.stdin)['public_key'])" 2>/dev/null)
        generated_vapid_private_key=$(echo "$vapid_json" | python3 -c "import sys, json; print(json.load(sys.stdin)['private_key'])" 2>/dev/null)

        if [[ -n "$generated_vapid_public_key" && -n "$generated_vapid_private_key" ]]; then
            info "VAPID keys generated for Web Push notifications"
        else
            error "VAPID key generation returned empty values"
            error "Output was: $vapid_json"
            exit 1
        fi
    else
        error "VAPID key generation failed!"
        error "Error: $vapid_json"
        exit 1
    fi
    success "Secrets generated"

    echo ""
    info "Please provide the following configuration values:"
    info "Press Enter to accept default values shown in brackets"
    echo ""

    # PostgreSQL configuration
    print_message "$CYAN" "▶ Database Configuration"
    prompt "PostgreSQL database name" "POSTGRES_DB" "familybudget"
    prompt "PostgreSQL username" "POSTGRES_USER" "familybudget"
    prompt "PostgreSQL password (or press Enter for auto-generated)" "POSTGRES_PASSWORD" "$generated_postgres_password" true

    echo ""

    # Security configuration
    print_message "$CYAN" "▶ Security Configuration"
    info "JWT secret will be auto-generated"
    CONFIG["JWT_SECRET"]=$generated_jwt_secret
    info "Internal API key will be auto-generated"
    CONFIG["API_INTERNAL_KEY"]=$generated_api_internal_key
    prompt "JWT expiration (days)" "JWT_EXPIRE_DAYS" "7"

    echo ""

    # VAPID configuration for Push Notifications
    # NOTE: At this point VAPID keys are always available (setup exits earlier if generation fails)
    print_message "$CYAN" "▶ Push Notifications (VAPID)"
    info "VAPID keys auto-generated for Web Push"
    CONFIG["VAPID_PUBLIC_KEY"]=$generated_vapid_public_key
    CONFIG["VAPID_PRIVATE_KEY"]=$generated_vapid_private_key
    # Use LETSENCRYPT_EMAIL if set, otherwise use default
    local default_vapid_email="${CONFIG[LETSENCRYPT_EMAIL]:-admin@example.com}"
    prompt "VAPID contact email (for push service notifications)" "VAPID_CONTACT_EMAIL" "$default_vapid_email"

    echo ""

    # Telegram bot configuration
    print_message "$CYAN" "▶ Telegram Bot Configuration"
    info "Get your bot token from @BotFather on Telegram"

    while true; do
        prompt "Telegram bot token" "TELEGRAM_BOT_TOKEN" ""

        if [[ -n "${CONFIG[TELEGRAM_BOT_TOKEN]}" ]]; then
            break
        else
            error "Telegram bot token is required!"
            echo ""
        fi
    done

    # Automatically get bot username from Telegram API
    echo ""
    info "Получение информации о боте..."
    local bot_username
    bot_username=$(get_bot_info "${CONFIG[TELEGRAM_BOT_TOKEN]}")

    if [[ -n "$bot_username" ]]; then
        CONFIG["TELEGRAM_BOT_USERNAME"]="$bot_username"
        success "Бот найден: @${bot_username}"
    else
        warning "Не удалось получить username бота автоматически"
        CONFIG["TELEGRAM_BOT_USERNAME"]=""
    fi

    echo ""
    info "Get your Telegram ID from @userinfobot on Telegram"

    while true; do
        prompt "Admin Telegram ID" "ADMIN_TELEGRAM_ID" ""

        if [[ -n "${CONFIG[ADMIN_TELEGRAM_ID]}" ]]; then
            if validate_telegram_id "${CONFIG[ADMIN_TELEGRAM_ID]}"; then
                break
            else
                error "Invalid Telegram ID (must be numeric)"
                echo ""
            fi
        else
            error "Admin Telegram ID is required!"
            echo ""
        fi
    done

    echo ""

    # Admin Email Authentication (optional - emergency access)
    print_message "$CYAN" "▶ Admin Email Authentication (Optional - Emergency Access)"
    info "Admin can login via email/password WITHOUT 2FA (security exception)"
    info "Regular users ALWAYS require 2FA for email/password login"
    info "Leave blank to use Telegram authentication only"
    echo ""

    prompt_yes_no "Configure admin email login?" "SETUP_ADMIN_EMAIL" "n"

    if [[ "${CONFIG[SETUP_ADMIN_EMAIL]}" == "y" ]]; then
        prompt "Admin email (optional)" "ADMIN_EMAIL" ""

        if [[ -n "${CONFIG[ADMIN_EMAIL]}" ]]; then
            # Validate email format
            if ! validate_email "${CONFIG[ADMIN_EMAIL]}"; then
                error "Invalid email format"
                CONFIG["ADMIN_EMAIL"]=""
                CONFIG["ADMIN_PASSWORD"]=""
                warning "Admin email configuration cancelled due to validation error"
            else
                echo ""
                info "Password requirements (OWASP 2023):"
                echo "  ✓ Minimum 12 characters"
                echo "  ✓ At least one uppercase letter (A-Z)"
                echo "  ✓ At least one lowercase letter (a-z)"
                echo "  ✓ At least one digit (0-9)"
                echo "  ✓ At least one special character (!@#$%^&*...)"
                echo ""

                # Generate secure password
                local generated_password
                generated_password=$(generate_admin_password)

                success "Auto-generated secure password: $generated_password"
                info "Accept this or enter your own (hidden input)"
                echo ""

                prompt "Admin password (or press Enter for auto-generated)" "ADMIN_PASSWORD" "$generated_password" true

                # Validate password is not empty (sanity check)
                if [[ -z "${CONFIG[ADMIN_PASSWORD]}" ]]; then
                    error "Password cannot be empty!"
                    CONFIG["ADMIN_EMAIL"]=""
                    CONFIG["ADMIN_PASSWORD"]=""
                    warning "Admin email configuration cancelled due to empty password"
                else
                    success "Admin email authentication configured"
                    info "Admin: ${CONFIG[ADMIN_EMAIL]}"
                    warning "SECURITY: Password is for INITIAL login only"
                    warning "Change password after first login (optional)"
                fi
            fi
        fi
    else
        info "Admin email authentication disabled (Telegram only)"
        CONFIG["ADMIN_EMAIL"]=""
        CONFIG["ADMIN_PASSWORD"]=""
    fi

    echo ""

    # Application settings
    print_message "$CYAN" "▶ Application Settings"
    prompt "Environment (development/staging/production)" "APP_ENV" "production"
    # Domain will be set based on deployment profile (localhost for basic, prompted for full)
    prompt "Backend port" "BACKEND_PORT" "8000"

    # Uvicorn workers configuration
    # With Redis Pub/Sub enabled, multi-worker deployment is supported
    # Workers share WebSocket events via Redis Pub/Sub channel (budget:events)
    echo ""
    info "Uvicorn workers configuration:"
    echo "  - 1: Development/low resources"
    echo "  - 2: Recommended for most deployments"
    echo "  - 4: High-traffic production"
    echo ""
    info "Note: Multi-worker requires Redis for WebSocket sync"
    prompt "Number of Uvicorn workers" "WORKERS" "2"

    # Validate workers (must be positive integer)
    if ! [[ "${CONFIG[WORKERS]}" =~ ^[1-9][0-9]*$ ]]; then
        warning "Invalid workers count. Using default: 2"
        CONFIG["WORKERS"]="2"
    fi

    prompt "Log level (debug/info/warning/error)" "LOG_LEVEL" "info"

    success "Configuration collected"
}

# Configure deployment profile (basic or full)
configure_deployment_profile() {
    section "Deployment Profile Selection"

    echo ""
    info "Choose deployment profile:"
    echo ""
    echo "  [1] Basic (default)"
    echo "      - PostgreSQL + Backend API"
    echo "      - Direct access via port 8000"
    echo "      - No SSL/HTTPS"
    echo "      - Suitable for: development, testing, internal networks"
    echo ""
    echo "  [2] Full (production)"
    echo "      - PostgreSQL + Backend API + Nginx + Bot + Certbot"
    echo "      - Reverse proxy with Nginx"
    echo "      - Automatic SSL via Let's Encrypt"
    echo "      - Telegram Bot for data entry"
    echo "      - Suitable for: production, public access"
    echo ""

    if [[ "$NON_INTERACTIVE" == "true" ]]; then
        CONFIG["DEPLOYMENT_PROFILE"]="basic"
        info "Using default profile: basic"
        return
    fi

    while true; do
        read -p "Select profile [1/2] (default: 1): " profile_choice

        case "${profile_choice:-1}" in
            1)
                CONFIG["DEPLOYMENT_PROFILE"]="basic"
                CONFIG["SSL_TYPE"]="none"
                CONFIG["DOMAIN"]="localhost"
                success "Selected profile: basic"
                info "Domain set to: localhost"
                break
                ;;
            2)
                CONFIG["DEPLOYMENT_PROFILE"]="full"
                CONFIG["SSL_TYPE"]="letsencrypt"
                # DOMAIN will be prompted in configure_domain_ssl()
                success "Selected profile: full"
                echo ""
                info "Next: Domain & SSL configuration"
                break
                ;;
            *)
                error "Invalid choice. Please enter 1 or 2."
                ;;
        esac
    done
}

# Validate domain name format
validate_domain() {
    local domain=$1

    # Allow localhost
    if [[ "$domain" == "localhost" ]]; then
        return 0
    fi

    # Check domain format (basic validation)
    if [[ $domain =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
        return 0
    else
        return 1
    fi
}

# Configure domain and SSL (for full profile)
configure_domain_ssl() {
    # Skip if basic profile
    if [[ "${CONFIG[DEPLOYMENT_PROFILE]}" != "full" ]]; then
        info "Basic profile selected - skipping domain/SSL configuration"
        CONFIG["DOMAIN"]="localhost"
        CONFIG["SSL_TYPE"]="none"
        CONFIG["LETSENCRYPT_EMAIL"]=""
        return
    fi

    section "Domain & SSL Configuration"

    echo ""
    warning "IMPORTANT: Domain Configuration"
    echo "  For SSL to work, your domain must:"
    echo "  1. Point to this server's public IP address (A record in DNS)"
    echo "  2. Be accessible from the internet (ports 80 and 443 open)"
    echo ""
    info "To find your server's public IP: curl ifconfig.me"
    echo ""

    # Get domain
    while true; do
        prompt "Domain name (e.g., budget.example.com)" "DOMAIN" ""

        if [[ -z "${CONFIG[DOMAIN]}" ]]; then
            error "Domain name is required for full profile!"
            echo ""
            continue
        fi

        if validate_domain "${CONFIG[DOMAIN]}"; then
            break
        else
            error "Invalid domain name format!"
            echo "  Valid examples: budget.example.com, my-budget.org"
            echo ""
        fi
    done

    # Check existing SSL certificates
    if [[ -f "$REPO_DIR/scripts/check_certificates.sh" ]]; then
        source "$REPO_DIR/scripts/check_certificates.sh"
        check_and_offer_certificate_cleanup "${CONFIG[DOMAIN]}" "$REPO_DIR/certbot/conf"
    fi

    # Check DNS (optional but recommended)
    echo ""
    info "Checking DNS configuration for ${CONFIG[DOMAIN]}..."

    if command_exists dig; then
        local dns_ip
        dns_ip=$(dig +short "${CONFIG[DOMAIN]}" | tail -1)

        if [[ -n "$dns_ip" ]]; then
            info "Domain resolves to: $dns_ip"
            local server_ip
            server_ip=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")

            if [[ "$dns_ip" != "$server_ip" && "$server_ip" != "unknown" ]]; then
                warning "DNS IP ($dns_ip) doesn't match server IP ($server_ip)"
                warning "SSL certificate generation may fail if DNS is incorrect"
                echo ""

                prompt_yes_no "Continue anyway?" "CONTINUE_WITH_DNS_MISMATCH" "n"

                if [[ "${CONFIG[CONTINUE_WITH_DNS_MISMATCH]}" != "y" ]]; then
                    error "Please update DNS and run setup.sh again"
                fi
            else
                success "DNS configuration looks correct"
            fi
        else
            warning "Could not resolve domain. SSL may fail if DNS is not configured."
        fi
    else
        warning "dig command not available - skipping DNS check"
    fi

    # Get Let's Encrypt email
    echo ""
    info "Let's Encrypt email for certificate notifications"

    while true; do
        prompt "Email address" "LETSENCRYPT_EMAIL" "admin@${CONFIG[DOMAIN]}"

        if [[ -n "${CONFIG[LETSENCRYPT_EMAIL]}" ]]; then
            # Basic email validation
            if [[ "${CONFIG[LETSENCRYPT_EMAIL]}" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
                break
            else
                error "Invalid email format!"
                echo ""
            fi
        else
            error "Email is required for Let's Encrypt!"
            echo ""
        fi
    done

    # Set webhook URL for bot
    CONFIG["TELEGRAM_WEBHOOK_URL"]="https://${CONFIG[DOMAIN]}/api/v1/telegram/webhook"

    echo ""
    success "Domain and SSL configured"
    echo ""
    info "Configuration:"
    echo "  ✓ Domain: ${CONFIG[DOMAIN]}"
    echo "  ✓ SSL Type: letsencrypt (automatic)"
    echo "  ✓ Email: ${CONFIG[LETSENCRYPT_EMAIL]}"
    echo "  ✓ Webhook: ${CONFIG[TELEGRAM_WEBHOOK_URL]}"
}

# Generate nginx configuration from template
# Uses HTTP-only template for initial setup (SSL not yet configured)
generate_nginx_config() {
    # Skip if basic profile
    if [[ "${CONFIG[DEPLOYMENT_PROFILE]}" != "full" ]]; then
        return
    fi

    section "Generating Nginx Configuration"

    info "Creating HTTP-only nginx configuration for ${CONFIG[DOMAIN]}..."

    # Use HTTP-only template for initial setup (SSL will be configured later)
    local http_template="$DEPLOY_DIR/nginx/conf.d/app-http.conf.template"

    # Check if template exists in deployment directory
    if [[ ! -f "$http_template" ]]; then
        error "Nginx HTTP template not found: $http_template"
    fi

    # Copy HTTP template and replace domain
    cp "$http_template" "$DEPLOY_DIR/nginx/conf.d/app.conf"

    # Replace {{DOMAIN}} with actual domain
    sed -i "s/{{DOMAIN}}/${CONFIG[DOMAIN]}/g" "$DEPLOY_DIR/nginx/conf.d/app.conf"

    success "Nginx HTTP configuration generated (SSL will be configured after certificate is obtained)"
    info "Configuration file: $DEPLOY_DIR/nginx/conf.d/app.conf"
}

# Configure PostgreSQL external access with UFW
configure_postgres_access() {
    section "PostgreSQL External Access Configuration (CRITICAL SECURITY)"

    if [[ "$SKIP_UFW" == "true" ]]; then
        warning "UFW configuration skipped (--skip-ufw flag)"
        CONFIG["POSTGRES_EXTERNAL_ACCESS"]="false"
        CONFIG["POSTGRES_ALLOWED_IP"]=""
        return
    fi

    echo ""
    warning "SECURITY WARNING:"
    echo "  By default, PostgreSQL is NOT accessible from outside the Docker network."
    echo "  This is the most secure configuration."
    echo ""
    echo "  Enable external access ONLY if you need to:"
    echo "  - Connect with pgAdmin from your local machine"
    echo "  - Use external backup tools"
    echo "  - Connect from other servers"
    echo ""
    echo "  If enabled, access will be restricted to a SPECIFIC IP address using UFW."
    echo ""

    prompt_yes_no "Enable PostgreSQL external access?" "POSTGRES_EXTERNAL_ACCESS_PROMPT" "n"

    if [[ "${CONFIG[POSTGRES_EXTERNAL_ACCESS_PROMPT]}" == "y" ]]; then
        CONFIG["POSTGRES_EXTERNAL_ACCESS"]="true"

        echo ""
        info "External access enabled. Configuring UFW IP restriction..."
        echo ""

        # Get allowed IP
        while true; do
            echo ""
            info "Enter the IP address that should be allowed to access PostgreSQL"
            info "Examples:"
            echo "  - Your home IP: 203.0.113.50"
            echo "  - Your office IP: 198.51.100.25"
            echo "  - Another server: 192.0.2.100"
            echo ""
            info "To find your current IP, visit: https://ifconfig.me"
            echo ""

            prompt "Allowed IP address" "POSTGRES_ALLOWED_IP" ""

            if [[ -z "${CONFIG[POSTGRES_ALLOWED_IP]}" ]]; then
                error "IP address is required for external access!"
                echo ""
                continue
            fi

            if validate_ip "${CONFIG[POSTGRES_ALLOWED_IP]}"; then
                break
            else
                error "Invalid IP address format!"
                echo "  Valid format: 203.0.113.50"
                echo ""
            fi
        done

        # Confirm IP
        echo ""
        warning "CONFIRM CONFIGURATION:"
        echo "  PostgreSQL will be accessible from: ${CONFIG[POSTGRES_ALLOWED_IP]}"
        echo "  All other IPs will be BLOCKED"
        echo ""

        prompt_yes_no "Is this correct?" "CONFIRM_IP" "y"

        if [[ "${CONFIG[CONFIRM_IP]}" != "y" ]]; then
            error "Configuration cancelled. Please run setup.sh again."
        fi

        # Configure UFW
        echo ""
        info "Configuring UFW firewall..."

        # Check if UFW rule already exists
        if sudo ufw status | grep -q "5432.*${CONFIG[POSTGRES_ALLOWED_IP]}"; then
            warning "UFW rule for PostgreSQL from ${CONFIG[POSTGRES_ALLOWED_IP]} already exists"
        else
            # Add UFW rule
            if sudo ufw allow from "${CONFIG[POSTGRES_ALLOWED_IP]}" to any port 5432 comment "PostgreSQL from ${CONFIG[POSTGRES_ALLOWED_IP]}" >> "$LOG_FILE" 2>&1; then
                success "UFW rule added: allow from ${CONFIG[POSTGRES_ALLOWED_IP]} to any port 5432"
            else
                error "Failed to add UFW rule. Check $LOG_FILE for details."
            fi
        fi

        echo ""
        success "PostgreSQL external access configured with IP restriction"
        echo ""
        info "Summary:"
        echo "  ✓ External access: ENABLED"
        echo "  ✓ Allowed IP: ${CONFIG[POSTGRES_ALLOWED_IP]}"
        echo "  ✓ UFW rule: active"
        echo "  ✓ Port 5432: exposed (docker-compose.yml)"
        echo ""
        warning "IMPORTANT:"
        echo "  - Port 5432 is exposed on host by Docker"
        echo "  - UFW allows access ONLY from ${CONFIG[POSTGRES_ALLOWED_IP]}"
        echo "  - All other IPs are blocked by UFW firewall"
        echo "  - Connection string: postgresql://familybudget:***@<server-ip>:5432/familybudget"
        echo ""

    else
        CONFIG["POSTGRES_EXTERNAL_ACCESS"]="false"
        CONFIG["POSTGRES_ALLOWED_IP"]=""

        echo ""
        success "PostgreSQL external access disabled (most secure)"
        echo ""
        info "Port 5432 is exposed on host, but blocked by UFW firewall"
        info "PostgreSQL accessible only from within Docker network"
    fi
}

# Configure S3 backup
configure_s3_backup() {
    section "S3 Backup Configuration (Optional)"

    echo ""
    info "S3-compatible storage can be used for automated database backups"
    info "Supported providers: AWS S3, DigitalOcean Spaces, Backblaze B2, etc."
    echo ""
    warning "You can skip this now and configure later by editing .env file"
    echo ""

    prompt_yes_no "Configure S3 backup now?" "CONFIGURE_S3" "n"

    if [[ "${CONFIG[CONFIGURE_S3]}" == "y" ]]; then
        echo ""
        info "S3 Configuration"
        echo ""

        # S3 Endpoint URL
        echo "S3 Endpoint URL (leave empty for AWS S3):"
        echo "  Examples:"
        echo "    - AWS S3: (leave empty)"
        echo "    - DigitalOcean Spaces: https://nyc3.digitaloceanspaces.com"
        echo "    - Backblaze B2: https://s3.us-west-002.backblazeb2.com"
        echo ""
        read -p "S3 Endpoint URL [default: empty for AWS]: " s3_endpoint
        CONFIG["S3_ENDPOINT_URL"]="${s3_endpoint:-}"

        # S3 Access Key
        echo ""
        read -p "S3 Access Key ID: " s3_access_key
        if [[ -z "$s3_access_key" ]]; then
            error "S3 Access Key ID is required"
        fi
        CONFIG["S3_ACCESS_KEY_ID"]="$s3_access_key"

        # S3 Secret Key
        echo ""
        read -s -p "S3 Secret Access Key: " s3_secret_key
        echo ""
        if [[ -z "$s3_secret_key" ]]; then
            error "S3 Secret Access Key is required"
        fi
        CONFIG["S3_SECRET_ACCESS_KEY"]="$s3_secret_key"

        # S3 Bucket Name
        echo ""
        read -p "S3 Bucket Name: " s3_bucket
        if [[ -z "$s3_bucket" ]]; then
            error "S3 Bucket Name is required"
        fi
        CONFIG["S3_BUCKET_NAME"]="$s3_bucket"

        # S3 Region
        echo ""
        read -p "S3 Region [default: us-east-1]: " s3_region
        CONFIG["S3_REGION"]="${s3_region:-us-east-1}"

        echo ""
        success "S3 backup configured"
        echo ""
        info "Summary:"
        echo "  ✓ Endpoint: ${CONFIG[S3_ENDPOINT_URL]:-AWS S3 (default)}"
        echo "  ✓ Bucket: ${CONFIG[S3_BUCKET_NAME]}"
        echo "  ✓ Region: ${CONFIG[S3_REGION]}"
        echo ""
        warning "Backups will be stored in S3 bucket: ${CONFIG[S3_BUCKET_NAME]}"
        echo ""
    else
        # User skipped S3 configuration
        CONFIG["S3_ENDPOINT_URL"]=""
        CONFIG["S3_ACCESS_KEY_ID"]=""
        CONFIG["S3_SECRET_ACCESS_KEY"]=""
        CONFIG["S3_BUCKET_NAME"]=""
        CONFIG["S3_REGION"]="us-east-1"

        echo ""
        success "S3 backup skipped"
        info "You can configure S3 later by editing .env file"
        info "Required variables: S3_ENDPOINT_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME"
    fi
}

# Configure Redis caching
configure_redis() {
    section "Redis Configuration"

    echo ""
    info "Redis is used for caching and WebSocket synchronization across workers"
    info "This improves performance and enables multi-worker deployments"
    echo ""
    info "Redis configuration:"
    echo "  - Password: Authentication for Redis (recommended)"
    echo "  - Memory limit: Controls maximum memory usage"
    echo "  - Cache TTL: How long cached data is kept"
    echo "  - Write-Behind: Async writes to PostgreSQL for lower latency"
    echo ""

    # Generate Redis password
    info "Generating Redis password..."
    local generated_redis_password
    generated_redis_password=$(generate_password 16)

    echo ""
    info "Generated Redis password: $generated_redis_password"
    echo ""
    read -p "Redis password [Enter to accept generated, or type your own]: " custom_redis_password

    if [[ -n "$custom_redis_password" ]]; then
        CONFIG["REDIS_PASSWORD"]="$custom_redis_password"
        success "Using custom Redis password"
    else
        CONFIG["REDIS_PASSWORD"]="$generated_redis_password"
        success "Using generated Redis password"
    fi

    echo ""

    # Redis memory limit
    echo "Redis memory limit examples:"
    echo "  - 256mb: Suitable for low-traffic applications"
    echo "  - 512mb: Recommended for production"
    echo "  - 1gb: High-traffic applications"
    echo ""
    read -p "Redis memory limit [default: 256mb]: " redis_maxmemory
    CONFIG["REDIS_MAXMEMORY"]="${redis_maxmemory:-256mb}"

    # Validate memory format
    if ! [[ "${CONFIG[REDIS_MAXMEMORY]}" =~ ^[0-9]+(mb|gb)$ ]]; then
        warning "Invalid format. Using default: 256mb"
        CONFIG["REDIS_MAXMEMORY"]="256mb"
    fi

    # Cache TTL settings (use defaults, advanced users can edit .env)
    CONFIG["REDIS_CACHE_TTL_DEFAULT"]="60"
    CONFIG["REDIS_CACHE_TTL_REFERENCE"]="300"
    CONFIG["REDIS_CACHE_TTL_DASHBOARD"]="30"

    # Write-Behind feature
    echo ""
    info "Write-Behind mode enables async writes to PostgreSQL for lower latency"
    info "Recommended for production deployments with Redis"
    echo ""
    prompt_yes_no "Enable Write-Behind mode?" "WRITE_BEHIND_ENABLED_PROMPT" "y"

    if [[ "${CONFIG[WRITE_BEHIND_ENABLED_PROMPT]}" == "y" ]]; then
        CONFIG["WRITE_BEHIND_ENABLED"]="true"
        # DLQ settings (use defaults from .env.example)
        CONFIG["WRITE_BEHIND_DLQ_TTL_DAYS"]="${CONFIG[WRITE_BEHIND_DLQ_TTL_DAYS]:-7}"
        CONFIG["WRITE_BEHIND_DLQ_MAX_SIZE"]="${CONFIG[WRITE_BEHIND_DLQ_MAX_SIZE]:-100}"
    else
        CONFIG["WRITE_BEHIND_ENABLED"]="false"
        CONFIG["WRITE_BEHIND_DLQ_TTL_DAYS"]="7"
        CONFIG["WRITE_BEHIND_DLQ_MAX_SIZE"]="100"
    fi

    # Redis CPU limits (auto-calculated based on CPU count)
    local cpu_count="${CONFIG[CPU_COUNT]:-1}"
    if [[ $cpu_count -eq 1 ]]; then
        CONFIG["REDIS_CPU_LIMIT"]="0.1"
        CONFIG["REDIS_CPU_RESERVATION"]="0.02"
    else
        CONFIG["REDIS_CPU_LIMIT"]="0.2"
        CONFIG["REDIS_CPU_RESERVATION"]="0.05"
    fi

    echo ""
    success "Redis configured"
    echo ""
    info "Summary:"
    echo "  ✓ Memory limit: ${CONFIG[REDIS_MAXMEMORY]}"
    echo "  ✓ Write-Behind: ${CONFIG[WRITE_BEHIND_ENABLED]}"
    echo "  ✓ DLQ TTL: ${CONFIG[WRITE_BEHIND_DLQ_TTL_DAYS]} days"
    echo "  ✓ DLQ max size: ${CONFIG[WRITE_BEHIND_DLQ_MAX_SIZE]}"
    echo "  ✓ CPU limit: ${CONFIG[REDIS_CPU_LIMIT]}"
    echo "  ✓ Cache TTL (default): ${CONFIG[REDIS_CACHE_TTL_DEFAULT]}s"
    echo ""
}

# Configure system timezone
configure_timezone() {
    section "System Timezone Configuration"

    echo ""
    info "Configure the system timezone for the application"
    info "This affects timestamps, scheduled tasks, and log entries"
    echo ""

    # Detect current system timezone
    local detected_timezone
    if [[ -f /etc/timezone ]]; then
        detected_timezone=$(cat /etc/timezone)
    elif command -v timedatectl &> /dev/null; then
        detected_timezone=$(timedatectl | grep "Time zone" | awk '{print $3}')
    else
        detected_timezone="UTC"
    fi

    info "Detected system timezone: $detected_timezone"
    echo ""

    # Common timezone examples
    echo "Common timezone examples:"
    echo "  - Europe/Moscow    (UTC+3)"
    echo "  - Europe/London    (UTC+0)"
    echo "  - America/New_York (UTC-5/-4)"
    echo "  - Asia/Tokyo       (UTC+9)"
    echo "  - UTC              (Universal Time)"
    echo ""
    info "Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
    echo ""

    # Ask user for timezone
    read -p "Enter timezone [default: $detected_timezone]: " user_timezone

    if [[ -n "$user_timezone" ]]; then
        # Validate timezone format (basic check)
        if [[ "$user_timezone" =~ ^[A-Za-z]+/[A-Za-z_]+$ ]] || [[ "$user_timezone" == "UTC" ]]; then
            CONFIG["SYSTEM_TIMEZONE"]="$user_timezone"
            success "Using timezone: $user_timezone"
        else
            warning "Invalid timezone format. Using detected: $detected_timezone"
            CONFIG["SYSTEM_TIMEZONE"]="$detected_timezone"
        fi
    else
        CONFIG["SYSTEM_TIMEZONE"]="$detected_timezone"
        success "Using detected timezone: $detected_timezone"
    fi

    echo ""
    info "Timezone configured: ${CONFIG[SYSTEM_TIMEZONE]}"
    echo ""
}

# Create .env file
create_env_file() {
    section "Creating .env File"

    local env_file="$DEPLOY_DIR/.env"

    if [[ -f "$env_file" ]]; then
        warning ".env file already exists in $DEPLOY_DIR"
        echo ""
        prompt_yes_no "Overwrite existing .env file?" "OVERWRITE_ENV" "n"

        if [[ "${CONFIG[OVERWRITE_ENV]}" != "y" ]]; then
            info ".env file not modified"
            return
        fi

        # Backup existing .env
        local backup_file="$DEPLOY_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$env_file" "$backup_file"
        success "Existing .env backed up to $backup_file"
    fi

    info "Creating .env file from template..."

    # Copy template
    cp "$DEPLOY_DIR/.env.example" "$env_file"

    # Replace values
    sed -i "s/^POSTGRES_DB=.*/POSTGRES_DB=${CONFIG[POSTGRES_DB]}/" "$env_file"
    sed -i "s/^POSTGRES_USER=.*/POSTGRES_USER=${CONFIG[POSTGRES_USER]}/" "$env_file"
    sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${CONFIG[POSTGRES_PASSWORD]}/" "$env_file"

    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${CONFIG[JWT_SECRET]}/" "$env_file"
    sed -i "s/^JWT_EXPIRE_DAYS=.*/JWT_EXPIRE_DAYS=${CONFIG[JWT_EXPIRE_DAYS]}/" "$env_file"
    sed -i "s/^API_INTERNAL_KEY=.*/API_INTERNAL_KEY=${CONFIG[API_INTERNAL_KEY]}/" "$env_file"

    # VAPID keys for Push Notifications
    if [[ -n "${CONFIG[VAPID_PUBLIC_KEY]}" ]]; then
        sed -i "s|^VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=${CONFIG[VAPID_PUBLIC_KEY]}|" "$env_file"
        sed -i "s|^VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=${CONFIG[VAPID_PRIVATE_KEY]}|" "$env_file"
        sed -i "s|^VAPID_CONTACT_EMAIL=.*|VAPID_CONTACT_EMAIL=${CONFIG[VAPID_CONTACT_EMAIL]}|" "$env_file"
    fi

    sed -i "s/^TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=${CONFIG[TELEGRAM_BOT_TOKEN]}/" "$env_file"
    sed -i "s/^TELEGRAM_BOT_USERNAME=.*/TELEGRAM_BOT_USERNAME=${CONFIG[TELEGRAM_BOT_USERNAME]}/" "$env_file"
    sed -i "s/^ADMIN_TELEGRAM_ID=.*/ADMIN_TELEGRAM_ID=${CONFIG[ADMIN_TELEGRAM_ID]}/" "$env_file"

    # Admin email authentication
    # CRITICAL FIX: Use | delimiter instead of / to handle special chars in password
    # Password may contain !@#$%^&* which break sed with / delimiter
    info "Writing admin credentials to .env..."
    if [[ -n "${CONFIG[ADMIN_EMAIL]:-}" ]]; then
        info "  ADMIN_EMAIL: ${CONFIG[ADMIN_EMAIL]}"
    else
        info "  ADMIN_EMAIL: (empty - Telegram-only auth)"
    fi
    if [[ -n "${CONFIG[ADMIN_PASSWORD]:-}" ]]; then
        info "  ADMIN_PASSWORD: ***set*** (hidden)"
    else
        info "  ADMIN_PASSWORD: (empty - Telegram-only auth)"
    fi
    # Use single quotes to prevent bash interpretation of special characters in passwords
    sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL='${CONFIG[ADMIN_EMAIL]:-}'|" "$env_file"
    sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD='${CONFIG[ADMIN_PASSWORD]:-}'|" "$env_file"

    sed -i "s/^APP_ENV=.*/APP_ENV=${CONFIG[APP_ENV]}/" "$env_file"
    sed -i "s/^DOMAIN=.*/DOMAIN=${CONFIG[DOMAIN]}/" "$env_file"
    sed -i "s/^BACKEND_PORT=.*/BACKEND_PORT=${CONFIG[BACKEND_PORT]}/" "$env_file"
    sed -i "s/^WORKERS=.*/WORKERS=${CONFIG[WORKERS]}/" "$env_file"
    sed -i "s/^LOG_LEVEL=.*/LOG_LEVEL=${CONFIG[LOG_LEVEL]}/" "$env_file"

    sed -i "s/^POSTGRES_EXTERNAL_ACCESS=.*/POSTGRES_EXTERNAL_ACCESS=${CONFIG[POSTGRES_EXTERNAL_ACCESS]}/" "$env_file"
    sed -i "s/^POSTGRES_ALLOWED_IP=.*/POSTGRES_ALLOWED_IP=${CONFIG[POSTGRES_ALLOWED_IP]}/" "$env_file"

    # Deployment profile and SSL
    sed -i "s/^DEPLOYMENT_PROFILE=.*/DEPLOYMENT_PROFILE=${CONFIG[DEPLOYMENT_PROFILE]}/" "$env_file"
    sed -i "s/^SSL_TYPE=.*/SSL_TYPE=${CONFIG[SSL_TYPE]}/" "$env_file"
    sed -i "s/^LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=${CONFIG[LETSENCRYPT_EMAIL]}/" "$env_file"

    # S3 Backup configuration
    sed -i "s|^S3_ENDPOINT_URL=.*|S3_ENDPOINT_URL=${CONFIG[S3_ENDPOINT_URL]}|" "$env_file"
    sed -i "s|^S3_ACCESS_KEY_ID=.*|S3_ACCESS_KEY_ID=${CONFIG[S3_ACCESS_KEY_ID]}|" "$env_file"
    sed -i "s|^S3_SECRET_ACCESS_KEY=.*|S3_SECRET_ACCESS_KEY=${CONFIG[S3_SECRET_ACCESS_KEY]}|" "$env_file"
    sed -i "s|^S3_BUCKET_NAME=.*|S3_BUCKET_NAME=${CONFIG[S3_BUCKET_NAME]}|" "$env_file"
    sed -i "s|^S3_REGION=.*|S3_REGION=${CONFIG[S3_REGION]}|" "$env_file"

    # Redis configuration
    sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=${CONFIG[REDIS_PASSWORD]}|" "$env_file"
    sed -i "s|^REDIS_MAXMEMORY=.*|REDIS_MAXMEMORY=${CONFIG[REDIS_MAXMEMORY]}|" "$env_file"
    sed -i "s|^REDIS_CACHE_TTL_DEFAULT=.*|REDIS_CACHE_TTL_DEFAULT=${CONFIG[REDIS_CACHE_TTL_DEFAULT]}|" "$env_file"
    sed -i "s|^REDIS_CACHE_TTL_REFERENCE=.*|REDIS_CACHE_TTL_REFERENCE=${CONFIG[REDIS_CACHE_TTL_REFERENCE]}|" "$env_file"
    sed -i "s|^REDIS_CACHE_TTL_DASHBOARD=.*|REDIS_CACHE_TTL_DASHBOARD=${CONFIG[REDIS_CACHE_TTL_DASHBOARD]}|" "$env_file"
    sed -i "s|^WRITE_BEHIND_ENABLED=.*|WRITE_BEHIND_ENABLED=${CONFIG[WRITE_BEHIND_ENABLED]}|" "$env_file"
    sed -i "s|^WRITE_BEHIND_DLQ_TTL_DAYS=.*|WRITE_BEHIND_DLQ_TTL_DAYS=${CONFIG[WRITE_BEHIND_DLQ_TTL_DAYS]}|" "$env_file"
    sed -i "s|^WRITE_BEHIND_DLQ_MAX_SIZE=.*|WRITE_BEHIND_DLQ_MAX_SIZE=${CONFIG[WRITE_BEHIND_DLQ_MAX_SIZE]}|" "$env_file"
    sed -i "s|^REDIS_CPU_LIMIT=.*|REDIS_CPU_LIMIT=${CONFIG[REDIS_CPU_LIMIT]}|" "$env_file"
    sed -i "s|^REDIS_CPU_RESERVATION=.*|REDIS_CPU_RESERVATION=${CONFIG[REDIS_CPU_RESERVATION]}|" "$env_file"

    # System timezone
    sed -i "s|^SYSTEM_TIMEZONE=.*|SYSTEM_TIMEZONE=${CONFIG[SYSTEM_TIMEZONE]}|" "$env_file"

    # Docker CPU limits (auto-detected based on available CPUs)
    sed -i "s/^CPU_COUNT=.*/CPU_COUNT=${CONFIG[CPU_COUNT]}/" "$env_file"
    sed -i "s/^BACKEND_CPU_LIMIT=.*/BACKEND_CPU_LIMIT=${CONFIG[BACKEND_CPU_LIMIT]}/" "$env_file"
    sed -i "s/^BACKEND_CPU_RESERVATION=.*/BACKEND_CPU_RESERVATION=${CONFIG[BACKEND_CPU_RESERVATION]}/" "$env_file"
    sed -i "s/^BOT_CPU_LIMIT=.*/BOT_CPU_LIMIT=${CONFIG[BOT_CPU_LIMIT]}/" "$env_file"
    sed -i "s/^BOT_CPU_RESERVATION=.*/BOT_CPU_RESERVATION=${CONFIG[BOT_CPU_RESERVATION]}/" "$env_file"
    sed -i "s/^NGINX_CPU_LIMIT=.*/NGINX_CPU_LIMIT=${CONFIG[NGINX_CPU_LIMIT]}/" "$env_file"
    sed -i "s/^NGINX_CPU_RESERVATION=.*/NGINX_CPU_RESERVATION=${CONFIG[NGINX_CPU_RESERVATION]}/" "$env_file"

    # Telegram webhook URL (for full profile)
    if [[ -n "${CONFIG[TELEGRAM_WEBHOOK_URL]:-}" ]]; then
        sed -i "s|^TELEGRAM_WEBHOOK_URL=.*|TELEGRAM_WEBHOOK_URL=${CONFIG[TELEGRAM_WEBHOOK_URL]}|" "$env_file"
    fi

    # CORS - Allowed Origins (based on deployment profile and SSL)
    # SECURITY FIX: Include Telegram origins for Telegram Login Widget and WebApp
    local allowed_origins
    local telegram_origins="https://web.telegram.org,https://oauth.telegram.org"

    if [[ "${CONFIG[DEPLOYMENT_PROFILE]}" == "full" && "${CONFIG[SSL_TYPE]}" == "letsencrypt" ]]; then
        # Full profile with SSL: HTTPS domain + Telegram origins
        allowed_origins="https://${CONFIG[DOMAIN]},${telegram_origins}"
    elif [[ "${CONFIG[DEPLOYMENT_PROFILE]}" == "full" ]]; then
        # Full profile without SSL: HTTP domain + Telegram origins
        allowed_origins="http://${CONFIG[DOMAIN]},${telegram_origins}"
    else
        # Basic profile: localhost with backend port + Telegram origins
        allowed_origins="http://localhost:${CONFIG[BACKEND_PORT]},${telegram_origins}"
    fi
    sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${allowed_origins}|" "$env_file"

    # Set secure permissions (640: owner read/write, group read)
    chmod 640 "$env_file"

    # Set correct ownership (root:username if running as root, otherwise username:username)
    # This ensures .env is readable by docker-compose when run by non-root user
    local username="${SUDO_USER:-$USER}"
    if [[ "$EUID" -eq 0 ]] && [[ -n "$username" ]] && [[ "$username" != "root" ]]; then
        # Running as root (via sudo), set owner to root and group to actual user
        chown "root:$username" "$env_file"
        info "File ownership set to root:$username (secure for docker-compose)"
    elif [[ "$username" != "root" ]]; then
        # Running as non-root user
        chown "$username:$username" "$env_file"
        info "File ownership set to $username:$username"
    fi

    success ".env file created"
    info "File permissions set to 640 (read/write for owner, read for group)"
}

# Fix file permissions for project files
# This ensures Docker containers can read mounted source files
fix_project_permissions() {
    section "Fixing Project File Permissions"

    info "Ensuring all Python files are readable by Docker containers..."

    # Fix permissions for Python files that may have restrictive permissions (600)
    # Docker containers run as non-root user (UID 65532 in distroless) and need group read access
    local fixed_count=0

    # Find all Python files with 600 permissions and change to 664
    while IFS= read -r -d '' file; do
        chmod 664 "$file"
        ((fixed_count++))
    done < <(find "$DEPLOY_DIR/backend" -type f -name "*.py" -perm 600 -print0 2>/dev/null)

    if [[ $fixed_count -gt 0 ]]; then
        success "Fixed permissions for $fixed_count Python files"
    else
        info "No permission issues found"
    fi

    # Also ensure directories are executable
    find "$DEPLOY_DIR/backend" -type d -exec chmod 755 {} \; 2>/dev/null || true

    info "Project file permissions verified"
}

# Validate configuration
validate_configuration() {
    section "Validating Configuration"

    local env_file="$DEPLOY_DIR/.env"

    info "Checking .env file in $DEPLOY_DIR..."

    if [[ ! -f "$env_file" ]]; then
        error ".env file not found in $DEPLOY_DIR"
    fi

    # Source .env
    set -a
    source "$env_file"
    set +a

    # Check required variables
    local required_vars=(
        "POSTGRES_PASSWORD"
        "JWT_SECRET"
        "API_INTERNAL_KEY"
        "TELEGRAM_BOT_TOKEN"
        "ADMIN_TELEGRAM_ID"
    )

    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required variables: ${missing_vars[*]}"
    fi

    # Check for default values
    if [[ "$POSTGRES_PASSWORD" == "CHANGE_ME_STRONG_PASSWORD_HERE" ]]; then
        error "POSTGRES_PASSWORD still has default value"
    fi

    if [[ "$JWT_SECRET" == "CHANGE_ME_GENERATE_WITH_OPENSSL" ]]; then
        error "JWT_SECRET still has default value"
    fi

    if [[ "$API_INTERNAL_KEY" == "CHANGE_ME_GENERATE_WITH_OPENSSL" ]]; then
        error "API_INTERNAL_KEY still has default value"
    fi

    success "Configuration validated"

    echo ""
    info "Configuration summary:"
    echo "  ✓ Deployment profile: ${DEPLOYMENT_PROFILE}"
    echo "  ✓ Database: ${POSTGRES_USER}@${POSTGRES_DB}"
    if [[ -n "${TELEGRAM_BOT_USERNAME}" ]]; then
        echo "  ✓ Telegram bot: @${TELEGRAM_BOT_USERNAME}"
    else
        echo "  ✓ Telegram bot: configured"
    fi
    echo "  ✓ Admin Telegram ID: ${ADMIN_TELEGRAM_ID}"
    echo "  ✓ Domain: ${DOMAIN}"
    echo "  ✓ Backend port: ${BACKEND_PORT}"
    echo "  ✓ Environment: ${APP_ENV}"
    echo "  ✓ SSL Type: ${SSL_TYPE}"

    if [[ "$POSTGRES_EXTERNAL_ACCESS" == "true" ]]; then
        echo "  ✓ PostgreSQL external access: ENABLED (IP: ${POSTGRES_ALLOWED_IP})"
    else
        echo "  ✓ PostgreSQL external access: DISABLED (most secure)"
    fi
}

# Build Docker images
build_docker_images() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        warning "Docker image building skipped (--skip-build flag)"
        return
    fi

    section "Building Docker Images"

    echo ""
    prompt_yes_no "Build Docker images now?" "BUILD_IMAGES" "y"

    if [[ "${CONFIG[BUILD_IMAGES]}" == "y" ]]; then
        info "Building Docker images (this may take several minutes)..."
        info "Running docker compose build in $DEPLOY_DIR"
        echo ""

        if (cd "$DEPLOY_DIR" && docker compose build >> "$LOG_FILE" 2>&1); then
            success "Docker images built successfully"
        else
            warning "Docker image build failed. Check $LOG_FILE for details."
            info "You can build images later with:"
            echo "  cd $DEPLOY_DIR"
            echo "  docker compose build"
        fi
    else
        info "Skipping Docker image build"
        info "Build images later with:"
        echo "  cd $DEPLOY_DIR"
        echo "  docker compose build"
    fi
}

# Print final instructions
print_final_instructions() {
    echo ""
    echo "========================================================================"
    print_message "$GREEN" "           Family Budget - Setup Complete!"
    echo "========================================================================"
    echo ""
    echo "✅ Configuration file created: $DEPLOY_DIR/.env"
    echo "✅ Secrets generated securely"
    echo "✅ Deployment profile: ${CONFIG[DEPLOYMENT_PROFILE]}"

    if [[ "${CONFIG[DEPLOYMENT_PROFILE]}" == "full" ]]; then
        echo "✅ Nginx configuration generated"
        echo "✅ SSL configured (Let's Encrypt)"
    fi

    if [[ "${CONFIG[POSTGRES_EXTERNAL_ACCESS]}" == "true" ]]; then
        echo "✅ UFW configured for PostgreSQL (IP: ${CONFIG[POSTGRES_ALLOWED_IP]})"
    else
        echo "✅ PostgreSQL secured (no external access)"
    fi

    echo ""
    echo "Next steps:"
    echo ""
    echo "  1. Review configuration:"
    echo "     cat $DEPLOY_DIR/.env"
    echo ""
    echo "  2. Deploy the application:"
    echo "     ./deploy.sh"
    echo ""
    echo "     NOTE: deploy.sh will automatically sync code from repository"
    echo "           to $DEPLOY_DIR before deployment"
    echo ""
    echo "  3. Access the application:"
    if [[ "${CONFIG[DEPLOYMENT_PROFILE]}" == "full" && "${CONFIG[SSL_TYPE]}" == "letsencrypt" ]]; then
        echo "     https://${CONFIG[DOMAIN]}"
    elif [[ "${CONFIG[DEPLOYMENT_PROFILE]}" == "full" ]]; then
        echo "     http://${CONFIG[DOMAIN]}"
    else
        echo "     http://${CONFIG[DOMAIN]}:${CONFIG[BACKEND_PORT]}"
    fi
    echo ""

    if [[ "${CONFIG[POSTGRES_EXTERNAL_ACCESS]}" == "true" ]]; then
        echo "  4. Connect to PostgreSQL from ${CONFIG[POSTGRES_ALLOWED_IP]}:"
        echo "     Host: <your-server-ip>"
        echo "     Port: 5432"
        echo "     Database: ${CONFIG[POSTGRES_DB]}"
        echo "     Username: ${CONFIG[POSTGRES_USER]}"
        echo "     Password: <from .env file>"
        echo ""
        echo "     Connection string:"
        echo "     postgresql://${CONFIG[POSTGRES_USER]}:<password>@<server-ip>:5432/${CONFIG[POSTGRES_DB]}"
        echo ""
    fi

    echo "Security reminders:"
    echo "  • .env file permissions: 640 (owner read/write, group read)"
    echo "  • Never commit .env file to git"
    echo "  • Change secrets if .env is exposed"

    if [[ "${CONFIG[POSTGRES_EXTERNAL_ACCESS]}" == "true" ]]; then
        echo "  • PostgreSQL access restricted to: ${CONFIG[POSTGRES_ALLOWED_IP]}"
        echo "  • Update UFW rule if IP changes: sudo ufw allow from <new-ip> to any port 5432"
    fi

    echo ""
    echo "Logs: $LOG_FILE"
    echo "========================================================================"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                print_help
                exit 0
                ;;
            -y|--yes)
                NON_INTERACTIVE=true
                shift
                ;;
            --skip-ufw)
                SKIP_UFW=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            *)
                error "Unknown option: $1 (use --help for usage)"
                ;;
        esac
    done
}

main() {
    # Parse arguments
    parse_args "$@"

    # Initialize log file
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    chmod 644 "$LOG_FILE"

    echo "========================================================================"
    print_message "$BLUE" "       Family Budget - Interactive Setup Script"
    echo "========================================================================"
    echo ""

    # Check deployment directory and create subdirectories
    check_deploy_dir
    echo ""

    # Check prerequisites
    check_prerequisites
    echo ""

    # Detect CPU resources and calculate optimal limits
    detect_cpu_resources
    echo ""

    # Collect configuration
    collect_configuration
    echo ""

    configure_deployment_profile
    echo ""

    configure_domain_ssl
    echo ""

    generate_nginx_config
    echo ""

    configure_postgres_access
    echo ""

    configure_s3_backup
    echo ""

    configure_redis
    echo ""

    configure_timezone
    echo ""

    create_env_file
    echo ""

    validate_configuration
    echo ""

    fix_project_permissions
    echo ""

    build_docker_images
    echo ""

    print_final_instructions
}

# Run main function
main "$@"
