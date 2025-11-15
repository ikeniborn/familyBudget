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
    local required_dirs=("data" "backups" "logs" "nginx/conf.d")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$DEPLOY_DIR/$dir" ]]; then
            info "Creating directory: $DEPLOY_DIR/$dir"
            mkdir -p "$DEPLOY_DIR/$dir" || error "Failed to create directory: $dir"
        fi
    done

    # Verify required template files exist
    info "Checking required template files..."
    local required_templates=(
        "$DEPLOY_DIR/nginx/conf.d/app.conf.template"
        "$DEPLOY_DIR/.env.example"
    )

    local missing_templates=()
    for template in "${required_templates[@]}"; do
        if [[ ! -f "$template" ]]; then
            missing_templates+=("$template")
        fi
    done

    if [[ ${#missing_templates[@]} -gt 0 ]]; then
        error "Required template files are missing:"
        for template in "${missing_templates[@]}"; do
            echo "  ✗ $template"
        done
        echo ""
        warning "This typically means install.sh was not run correctly."
        info "Please run install.sh from the repository directory:"
        echo "  cd ~/familyBudget  # (or your repository location)"
        echo "  sudo ./install.sh"
        echo ""
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
    local generated_postgres_password
    generated_postgres_password=$(generate_password 32)
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
    prompt "JWT expiration (days)" "JWT_EXPIRE_DAYS" "7"

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

    # Application settings
    print_message "$CYAN" "▶ Application Settings"
    prompt "Environment (development/staging/production)" "APP_ENV" "production"
    # Domain will be set based on deployment profile (localhost for basic, prompted for full)
    prompt "Backend port" "BACKEND_PORT" "8000"
    prompt "Number of Uvicorn workers" "WORKERS" "4"
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
generate_nginx_config() {
    # Skip if basic profile
    if [[ "${CONFIG[DEPLOYMENT_PROFILE]}" != "full" ]]; then
        return
    fi

    section "Generating Nginx Configuration"

    info "Creating nginx configuration for ${CONFIG[DOMAIN]}..."

    # Check if template exists in deployment directory
    if [[ ! -f "$DEPLOY_DIR/nginx/conf.d/app.conf.template" ]]; then
        error "Nginx template not found: $DEPLOY_DIR/nginx/conf.d/app.conf.template"
    fi

    # Copy template and replace domain
    cp "$DEPLOY_DIR/nginx/conf.d/app.conf.template" "$DEPLOY_DIR/nginx/conf.d/app.conf"

    # Replace {{DOMAIN}} with actual domain
    sed -i "s/{{DOMAIN}}/${CONFIG[DOMAIN]}/g" "$DEPLOY_DIR/nginx/conf.d/app.conf"

    success "Nginx configuration generated"
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

# Configure CouchDB Notes (Optional)
configure_couchdb() {
    section "CouchDB Notes Configuration (Optional)"

    echo ""
    info "CouchDB provides document storage for notes (Obsidian, etc.)"
    info "Isolated from Family Budget with separate domain and data directory"
    echo ""
    warning "Requirements:"
    echo "  - DEPLOYMENT_PROFILE=full (nginx + SSL)"
    echo "  - Subdomain DNS configured (e.g., notes.yourdomain.com)"
    echo "  - Let's Encrypt SSL certificate will be auto-generated"
    echo ""
    warning "You can skip this now and configure later by editing .env file"
    echo ""

    prompt_yes_no "Enable CouchDB Notes?" "ENABLE_COUCHDB" "n"

    if [[ "${CONFIG[ENABLE_COUCHDB]}" == "y" ]]; then
        echo ""
        info "CouchDB Notes Configuration"
        echo ""

        # Generate strong password
        info "Generating CouchDB admin password..."
        local couchdb_password
        couchdb_password=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
        CONFIG["COUCHDB_PASSWORD"]="$couchdb_password"
        success "Generated secure password (32 characters)"
        echo ""

        # CouchDB admin username (default: admin)
        CONFIG["COUCHDB_USER"]="admin"

        # Notes subdomain
        echo "Notes Domain (subdomain for CouchDB access):"
        echo "  Requirements:"
        echo "    - Must be different from main DOMAIN"
        echo "    - DNS must be configured to point to this server"
        echo "    - SSL certificate will be auto-generated via Let's Encrypt"
        echo ""
        echo "  Examples:"
        echo "    - Production: notes.yourdomain.com"
        echo "    - Development: notes.localhost (HTTP only, no SSL)"
        echo ""

        local notes_domain_valid=false
        while [[ "$notes_domain_valid" == false ]]; do
            read -p "Notes Domain [default: notes.localhost]: " notes_domain
            notes_domain="${notes_domain:-notes.localhost}"

            # Validate domain format
            if [[ "$notes_domain" == "notes.localhost" ]]; then
                warning "Using notes.localhost - HTTP only, no SSL (development mode)"
                notes_domain_valid=true
            elif [[ "$notes_domain" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
                # Check if different from main domain
                if [[ "$notes_domain" == "${CONFIG[DOMAIN]}" ]]; then
                    error "Notes domain must be different from main domain: ${CONFIG[DOMAIN]}"
                    echo "Please use a subdomain (e.g., notes.${CONFIG[DOMAIN]})"
                else
                    notes_domain_valid=true
                fi
            else
                error "Invalid domain format: $notes_domain"
                echo "Please use format: notes.yourdomain.com"
            fi
        done

        CONFIG["NOTES_DOMAIN"]="$notes_domain"

        # Set directory paths
        CONFIG["NOTES_DATA_DIR"]="/opt/notes/data"
        CONFIG["NOTES_BACKUP_DIR"]="/opt/notes/backups"
        CONFIG["NOTES_LOG_DIR"]="/opt/notes/logs"

        echo ""
        success "CouchDB Notes configured"
        echo ""
        info "Summary:"
        echo "  ✓ Admin User: ${CONFIG[COUCHDB_USER]}"
        echo "  ✓ Password: [hidden - 32 characters]"
        echo "  ✓ Domain: ${CONFIG[NOTES_DOMAIN]}"
        echo "  ✓ Data Directory: ${CONFIG[NOTES_DATA_DIR]}"
        echo ""
        warning "Access: https://${CONFIG[NOTES_DOMAIN]}"
        if [[ "${CONFIG[NOTES_DOMAIN]}" != "notes.localhost" ]]; then
            warning "Ensure DNS is configured before running deploy.sh"
        fi
        echo ""

        # Copy nginx template if exists
        if [[ -f "$REPO_DIR/nginx/conf.d/notes.conf.template" ]]; then
            info "Copying nginx template for CouchDB..."
            cp "$REPO_DIR/nginx/conf.d/notes.conf.template" "$DEPLOY_DIR/nginx/conf.d/" || \
                warning "Failed to copy nginx notes template"
            success "Nginx template copied"
        else
            warning "Nginx notes template not found: $REPO_DIR/nginx/conf.d/notes.conf.template"
        fi

    else
        # User skipped CouchDB configuration
        CONFIG["ENABLE_COUCHDB"]="n"
        CONFIG["COUCHDB_USER"]="admin"
        CONFIG["COUCHDB_PASSWORD"]=""
        CONFIG["NOTES_DOMAIN"]="notes.localhost"
        CONFIG["NOTES_DATA_DIR"]="/opt/notes/data"
        CONFIG["NOTES_BACKUP_DIR"]="/opt/notes/backups"
        CONFIG["NOTES_LOG_DIR"]="/opt/notes/logs"

        echo ""
        success "CouchDB Notes skipped"
        info "You can enable CouchDB later by editing .env file"
        info "Set: ENABLE_COUCHDB=y and configure COUCHDB_PASSWORD, NOTES_DOMAIN"
    fi
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

    sed -i "s/^TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=${CONFIG[TELEGRAM_BOT_TOKEN]}/" "$env_file"
    sed -i "s/^TELEGRAM_BOT_USERNAME=.*/TELEGRAM_BOT_USERNAME=${CONFIG[TELEGRAM_BOT_USERNAME]}/" "$env_file"
    sed -i "s/^ADMIN_TELEGRAM_ID=.*/ADMIN_TELEGRAM_ID=${CONFIG[ADMIN_TELEGRAM_ID]}/" "$env_file"

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

    success ".env file created"
    info "File permissions set to 640 (read/write for owner, read for group)"
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

    configure_couchdb
    echo ""

    create_env_file
    echo ""

    validate_configuration
    echo ""

    build_docker_images
    echo ""

    print_final_instructions
}

# Run main function
main "$@"
