#!/bin/bash
#
# Family Budget - System Installation Script
#
# This script installs all required system dependencies:
# - Docker Engine
# - Docker Compose
# - Basic utilities
# - UFW firewall
# - Creates necessary directories
#
# Usage:
#   sudo ./install.sh
#
# Requirements:
#   - Ubuntu 20.04+ or Debian 11+
#   - Root/sudo access
#   - Internet connection
#
# Author: Family Budget Team
# Version: 1.0.0
# Date: 2025-10-14
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="familybudget"
LOG_FILE="/var/log/${PROJECT_NAME}_install.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Docker versions
DOCKER_COMPOSE_VERSION="v2.24.0"  # Latest stable as of script creation

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

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    else
        error "Cannot detect OS. /etc/os-release not found."
    fi

    info "Detected OS: $OS $VER"

    # Check if supported OS
    case "$OS" in
        ubuntu|debian)
            if [[ "$OS" == "ubuntu" && $(echo "$VER < 20.04" | bc -l) -eq 1 ]]; then
                error "Ubuntu version must be 20.04 or higher. Detected: $VER"
            fi
            if [[ "$OS" == "debian" && $(echo "$VER < 11" | bc -l) -eq 1 ]]; then
                error "Debian version must be 11 or higher. Detected: $VER"
            fi
            ;;
        *)
            error "Unsupported OS: $OS. This script supports Ubuntu 20.04+ and Debian 11+"
            ;;
    esac
}

# =============================================================================
# INSTALLATION FUNCTIONS
# =============================================================================

# Update system packages
update_system() {
    info "Updating system packages..."
    apt-get update -y >> "$LOG_FILE" 2>&1
    apt-get upgrade -y >> "$LOG_FILE" 2>&1
    success "System packages updated"
}

# Install basic utilities
install_utilities() {
    info "Installing basic utilities..."

    local packages=(
        "curl"
        "wget"
        "git"
        "ca-certificates"
        "gnupg"
        "lsb-release"
        "software-properties-common"
        "apt-transport-https"
        "bc"  # For version comparison
        "jq"  # JSON processor
        "vim"
        "nano"
        "htop"
        "net-tools"
        "ufw"  # Firewall
        "certbot"  # Let's Encrypt SSL certificates
    )

    for package in "${packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            info "Installing $package..."
            apt-get install -y "$package" >> "$LOG_FILE" 2>&1
        else
            info "$package is already installed"
        fi
    done

    success "Basic utilities installed"
}

# Install Docker
install_docker() {
    if command_exists docker; then
        local docker_version
        docker_version=$(docker --version | awk '{print $3}' | sed 's/,//')
        warning "Docker is already installed (version: $docker_version)"
        read -p "Do you want to reinstall Docker? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            info "Skipping Docker installation"
            return 0
        fi
    fi

    info "Installing Docker..."

    # Remove old versions
    info "Removing old Docker versions if any..."
    apt-get remove -y docker docker-engine docker.io containerd runc >> "$LOG_FILE" 2>&1 || true

    # Add Docker's official GPG key
    info "Adding Docker GPG key..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Add Docker repository
    info "Adding Docker repository..."
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Update package index
    apt-get update -y >> "$LOG_FILE" 2>&1

    # Install Docker Engine
    info "Installing Docker Engine..."
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >> "$LOG_FILE" 2>&1

    # Start and enable Docker
    systemctl start docker
    systemctl enable docker

    # Verify installation
    if docker --version >> "$LOG_FILE" 2>&1; then
        local docker_version
        docker_version=$(docker --version | awk '{print $3}' | sed 's/,//')
        success "Docker installed successfully (version: $docker_version)"
    else
        error "Docker installation failed"
    fi
}

# Add user to docker group and apply permissions
add_user_to_docker_group() {
    local username="${SUDO_USER:-$USER}"

    if [[ "$username" == "root" ]]; then
        warning "Running as root. Skipping docker group addition."
        return 0
    fi

    info "Adding user '$username' to docker group..."

    if groups "$username" | grep -q docker; then
        info "User '$username' is already in docker group"
    else
        usermod -aG docker "$username"
        success "User '$username' added to docker group"
    fi

    # Fix Docker directory permissions for the user
    info "Applying Docker permissions for user '$username'..."

    # Create .docker directory if it doesn't exist
    local docker_dir="/home/$username/.docker"
    if [[ ! -d "$docker_dir" ]]; then
        mkdir -p "$docker_dir"
    fi

    # Set correct ownership and permissions
    chown -R "$username:$username" "$docker_dir" 2>/dev/null || true
    chmod -R 755 "$docker_dir" 2>/dev/null || true

    # Fix Docker socket permissions
    if [[ -S /var/run/docker.sock ]]; then
        chmod 666 /var/run/docker.sock 2>/dev/null || true
    fi

    # Clean up any problematic buildx cache
    if [[ -d "$docker_dir/buildx" ]]; then
        rm -rf "$docker_dir/buildx" 2>/dev/null || true
        info "Cleaned up Docker buildx cache"
    fi

    success "Docker permissions configured for user '$username'"
    echo ""
    info "User can now use Docker without sudo"
    info "Note: If you're currently logged in as $username, run: newgrp docker"
    info "Or log out and log back in for changes to take full effect"
}

# Configure UFW firewall
configure_ufw() {
    info "Configuring UFW firewall..."

    if ! command_exists ufw; then
        error "UFW is not installed. This should not happen."
    fi

    # Check if UFW is already enabled
    if ufw status | grep -q "Status: active"; then
        warning "UFW is already active"
        read -p "Do you want to reconfigure UFW? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            info "Skipping UFW configuration"
            return 0
        fi
    fi

    # Reset UFW to default state
    info "Resetting UFW to default state..."
    ufw --force reset >> "$LOG_FILE" 2>&1

    # Set default policies
    info "Setting UFW default policies..."
    ufw default deny incoming >> "$LOG_FILE" 2>&1
    ufw default allow outgoing >> "$LOG_FILE" 2>&1

    # Allow SSH (critical - don't lock yourself out!)
    info "Allowing SSH (port 22)..."
    ufw allow 22/tcp comment 'SSH' >> "$LOG_FILE" 2>&1

    # Allow HTTP and HTTPS
    info "Allowing HTTP (port 80) and HTTPS (port 443)..."
    ufw allow 80/tcp comment 'HTTP' >> "$LOG_FILE" 2>&1
    ufw allow 443/tcp comment 'HTTPS' >> "$LOG_FILE" 2>&1

    # Enable UFW
    info "Enabling UFW..."
    ufw --force enable >> "$LOG_FILE" 2>&1

    # Show status
    success "UFW configured successfully"
    echo ""
    echo "Current UFW status:"
    ufw status verbose
    echo ""
    warning "IMPORTANT: SSH (port 22) is allowed. Make sure you can reconnect before logging out!"
    warning "PostgreSQL port (5432) will be configured later by setup.sh if needed"
}

# Create project directories
create_directories() {
    info "Creating project directories..."

    local dirs=(
        "$SCRIPT_DIR/data"
        "$SCRIPT_DIR/data/postgres"
        "$SCRIPT_DIR/backups"
        "$SCRIPT_DIR/logs"
        "$SCRIPT_DIR/logs/nginx"
        "$SCRIPT_DIR/uploads"
        "$SCRIPT_DIR/certbot/conf"
        "$SCRIPT_DIR/certbot/www"
        "$SCRIPT_DIR/nginx/conf.d"
    )

    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            info "Created directory: $dir"
        else
            info "Directory already exists: $dir"
        fi
    done

    # Set permissions
    info "Setting directory permissions..."
    chmod 700 "$SCRIPT_DIR/data/postgres"
    chmod 700 "$SCRIPT_DIR/backups"
    chmod 755 "$SCRIPT_DIR/logs"
    chmod 755 "$SCRIPT_DIR/uploads"

    # Set ownership (to the user who ran sudo)
    local username="${SUDO_USER:-$USER}"
    if [[ "$username" != "root" ]]; then
        chown -R "$username:$username" "$SCRIPT_DIR/data"
        chown -R "$username:$username" "$SCRIPT_DIR/backups"
        chown -R "$username:$username" "$SCRIPT_DIR/logs"
        chown -R "$username:$username" "$SCRIPT_DIR/uploads"
    fi

    success "Directories created and configured"
}

# Test Docker installation
test_docker() {
    info "Testing Docker installation..."

    if docker run --rm hello-world >> "$LOG_FILE" 2>&1; then
        success "Docker is working correctly"
    else
        error "Docker test failed. Check $LOG_FILE for details."
    fi
}

# =============================================================================
# SUMMARY FUNCTIONS
# =============================================================================

# Print installation summary
print_summary() {
    echo ""
    echo "========================================================================"
    print_message "$GREEN" "           Family Budget - Installation Complete!"
    echo "========================================================================"
    echo ""
    echo "Installed components:"
    echo "  ✓ Docker Engine: $(docker --version | awk '{print $3}' | sed 's/,//')"
    echo "  ✓ Docker Compose: $(docker compose version | awk '{print $4}')"
    echo "  ✓ UFW Firewall: $(ufw --version | head -1)"
    echo "  ✓ Certbot: $(certbot --version 2>&1 | head -1)"
    echo "  ✓ Basic utilities (curl, git, jq, etc.)"
    echo ""
    echo "Created directories:"
    echo "  ✓ $SCRIPT_DIR/data/postgres"
    echo "  ✓ $SCRIPT_DIR/backups"
    echo "  ✓ $SCRIPT_DIR/logs"
    echo "  ✓ $SCRIPT_DIR/uploads"
    echo ""
    echo "Next steps:"
    echo "  1. Log out and log back in (for docker group to take effect)"
    echo "     Or run: newgrp docker"
    echo ""
    echo "  2. Run setup script to configure the application:"
    echo "     ./setup.sh"
    echo ""
    echo "  3. Deploy the application:"
    echo "     ./deploy.sh"
    echo ""
    echo "Security notes:"
    echo "  • UFW firewall is enabled"
    echo "  • SSH (port 22) is allowed"
    echo "  • HTTP (port 80) and HTTPS (port 443) are allowed"
    echo "  • PostgreSQL (port 5432) is NOT exposed (will be configured by setup.sh if needed)"
    echo ""
    echo "Logs: $LOG_FILE"
    echo "========================================================================"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    # Initialize log file
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    chmod 644 "$LOG_FILE"

    echo "========================================================================"
    print_message "$BLUE" "       Family Budget - System Installation Script"
    echo "========================================================================"
    echo ""

    # Pre-flight checks
    info "Running pre-flight checks..."
    check_root
    detect_os

    # Confirmation
    echo ""
    warning "This script will install:"
    echo "  • Docker Engine"
    echo "  • Docker Compose"
    echo "  • UFW Firewall"
    echo "  • Basic utilities (curl, git, jq, etc.)"
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Installation cancelled by user"
        exit 0
    fi

    # Installation steps
    echo ""
    info "Starting installation..."
    echo ""

    update_system
    echo ""

    install_utilities
    echo ""

    install_docker
    echo ""

    add_user_to_docker_group
    echo ""

    configure_ufw
    echo ""

    create_directories
    echo ""

    test_docker
    echo ""

    # Summary
    print_summary
}

# Run main function
main "$@"
