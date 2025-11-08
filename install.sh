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

# Deployment directory (where the application will be deployed)
DEPLOY_DIR="/opt/budget"
REPO_DIR="$SCRIPT_DIR"  # Repository directory (source code)

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
        "rsync"  # Required for deploy.sh code synchronization
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

    # HTTP/HTTPS ports will be configured during deployment
    info "HTTP/HTTPS ports (80/443) will be configured by deploy.sh based on deployment profile"
    echo ""
    warning "Note: Ports 80/443 are NOT open yet. They will be opened by deploy.sh if needed."
    echo ""

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

# Create deployment directory structure
create_directories() {
    info "Creating deployment directory structure in $DEPLOY_DIR..."

    # Create deployment directory if it doesn't exist
    if [[ ! -d "$DEPLOY_DIR" ]]; then
        mkdir -p "$DEPLOY_DIR"
        info "Created deployment directory: $DEPLOY_DIR"
    else
        info "Deployment directory already exists: $DEPLOY_DIR"
    fi

    # Create subdirectories
    local dirs=(
        "$DEPLOY_DIR/data"
        "$DEPLOY_DIR/data/postgres"
        "$DEPLOY_DIR/backups"
        "$DEPLOY_DIR/logs"
        "$DEPLOY_DIR/logs/nginx"
        "$DEPLOY_DIR/uploads"
        "$DEPLOY_DIR/certbot/conf"
        "$DEPLOY_DIR/certbot/www"
        "$DEPLOY_DIR/nginx/conf.d"
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
    chmod 700 "$DEPLOY_DIR/data/postgres"
    chmod 700 "$DEPLOY_DIR/backups"
    chmod 755 "$DEPLOY_DIR/logs"
    chmod 755 "$DEPLOY_DIR/uploads"

    # Set ownership (to the user who ran sudo)
    local username="${SUDO_USER:-$USER}"
    if [[ "$username" != "root" ]]; then
        chown -R "$username:$username" "$DEPLOY_DIR"
        info "Set ownership: $username:$username on $DEPLOY_DIR"
    fi

    success "Deployment directory structure created: $DEPLOY_DIR"

    # Copy template files from repository
    info "Copying template files to deployment directory..."

    # Get the username for ownership
    local username="${SUDO_USER:-$USER}"

    # Verify we're running from the repository
    if [[ ! -f "$REPO_DIR/nginx/conf.d/app.conf.template" ]]; then
        warning "Nginx template not found in repository: $REPO_DIR/nginx/conf.d/app.conf.template"
        warning "Please ensure install.sh is run from the repository directory"
        warning "setup.sh may fail without this template"
    else
        cp "$REPO_DIR/nginx/conf.d/app.conf.template" "$DEPLOY_DIR/nginx/conf.d/" || \
            warning "Failed to copy nginx template (setup.sh may fail)"
        # Set correct ownership on copied file
        if [[ "$username" != "root" ]]; then
            chown "$username:$username" "$DEPLOY_DIR/nginx/conf.d/app.conf.template"
        fi
        info "Copied: nginx/conf.d/app.conf.template"
    fi

    if [[ ! -f "$REPO_DIR/.env.example" ]]; then
        warning ".env.example not found in repository: $REPO_DIR/.env.example"
        warning "setup.sh may fail without this template"
    else
        cp "$REPO_DIR/.env.example" "$DEPLOY_DIR/" || \
            warning "Failed to copy .env.example (setup.sh may fail)"
        # Set correct ownership on copied file
        if [[ "$username" != "root" ]]; then
            chown "$username:$username" "$DEPLOY_DIR/.env.example"
        fi
        info "Copied: .env.example"
    fi

    success "Template files initialized"
}

# Install Node.js and npm
install_nodejs() {
    info "Installing Node.js and npm..."

    # Check if Node.js is already installed
    if command_exists node; then
        local node_version
        node_version=$(node --version)
        warning "Node.js is already installed (version: $node_version)"

        # Check if version is >= 18.0.0
        local major_version
        major_version=$(echo "$node_version" | sed 's/v//' | cut -d. -f1)
        if [[ "$major_version" -ge 18 ]]; then
            info "Node.js version is sufficient (>= 18.x)"
            return 0
        else
            warning "Node.js version is too old (< 18.x). Upgrading..."
        fi
    fi

    # Remove old Node.js versions if any
    info "Removing old Node.js versions..."
    apt-get remove -y nodejs npm >> "$LOG_FILE" 2>&1 || true

    # Install NodeSource repository (Node.js 20.x LTS)
    info "Adding NodeSource repository for Node.js 20.x LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1

    # Install Node.js (includes npm)
    info "Installing Node.js and npm..."
    apt-get install -y nodejs >> "$LOG_FILE" 2>&1

    # Verify installation
    if command_exists node && command_exists npm; then
        local node_version
        local npm_version
        node_version=$(node --version)
        npm_version=$(npm --version)
        success "Node.js installed successfully (version: $node_version)"
        success "npm installed successfully (version: $npm_version)"
    else
        error "Node.js/npm installation failed"
    fi
}

# Install npm dependencies for the project
install_npm_dependencies() {
    info "Installing npm dependencies for Family Budget project..."

    # Get the username for ownership
    local username="${SUDO_USER:-$USER}"

    # Change to repository directory
    cd "$REPO_DIR" || error "Failed to cd to repository directory: $REPO_DIR"

    # Check if package.json exists
    if [[ ! -f "package.json" ]]; then
        warning "package.json not found in $REPO_DIR - skipping npm dependencies"
        return 0
    fi

    # Install dependencies as the non-root user (important for permissions)
    if [[ "$username" != "root" ]]; then
        info "Installing npm packages as user '$username'..."
        su - "$username" -c "cd $REPO_DIR && npm install" >> "$LOG_FILE" 2>&1
    else
        warning "Running as root - installing npm packages as root (not recommended)"
        npm install >> "$LOG_FILE" 2>&1
    fi

    # Verify node_modules exists
    if [[ -d "$REPO_DIR/node_modules" ]]; then
        local package_count
        package_count=$(find "$REPO_DIR/node_modules" -maxdepth 1 -type d | wc -l)
        success "npm dependencies installed ($package_count packages in node_modules)"
    else
        error "npm install failed - node_modules not found"
    fi
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
    echo "  ✓ Node.js: $(node --version 2>/dev/null || echo 'Not installed')"
    echo "  ✓ npm: $(npm --version 2>/dev/null || echo 'Not installed')"
    echo "  ✓ UFW Firewall: $(ufw --version | head -1)"
    echo "  ✓ Certbot: $(certbot --version 2>&1 | head -1)"
    echo "  ✓ Basic utilities (curl, git, jq, etc.)"
    echo ""
    echo "Deployment structure:"
    echo "  ✓ Repository (source code): $REPO_DIR"
    echo "  ✓ Deployment directory:     $DEPLOY_DIR"
    echo ""
    echo "Created directories in $DEPLOY_DIR:"
    echo "  ✓ data/postgres  (PostgreSQL data)"
    echo "  ✓ backups/       (Database backups)"
    echo "  ✓ logs/          (Application logs)"
    echo "  ✓ uploads/       (User uploads)"
    echo "  ✓ certbot/       (SSL certificates)"
    echo "  ✓ nginx/conf.d/  (Nginx configuration)"
    echo ""
    echo "Template files initialized:"
    echo "  ✓ nginx/conf.d/app.conf.template"
    echo "  ✓ .env.example"
    echo ""
    echo "NPM dependencies:"
    if [[ -d "$REPO_DIR/node_modules" ]]; then
        local package_count
        package_count=$(find "$REPO_DIR/node_modules" -maxdepth 1 -type d | wc -l)
        echo "  ✓ npm packages installed in repository ($package_count packages)"
    else
        echo "  ✗ npm packages not installed (node_modules not found)"
    fi
    echo ""
    echo "Next steps:"
    echo "  1. Log out and log back in (for docker group to take effect)"
    echo "     Or run: newgrp docker"
    echo ""
    echo "  2. Run setup script to configure the application:"
    echo "     cd $REPO_DIR"
    echo "     ./setup.sh"
    echo "     (This will copy code to $DEPLOY_DIR and create .env)"
    echo ""
    echo "  3. Deploy the application (from repository):"
    echo "     cd $REPO_DIR"
    echo "     ./deploy.sh"
    echo ""
    echo "Important notes:"
    echo "  • Repository ($REPO_DIR) - contains source code (use git pull)"
    echo "  • Deployment ($DEPLOY_DIR) - contains running application"
    echo "  • Never modify files in $DEPLOY_DIR manually - use setup.sh"
    echo ""
    echo "Security notes:"
    echo "  • UFW firewall is enabled"
    echo "  • SSH (port 22) is allowed"
    echo "  • HTTP (port 80) and HTTPS (port 443) are NOT open yet"
    echo "    (will be configured by deploy.sh based on deployment profile)"
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

    install_nodejs
    echo ""

    install_npm_dependencies
    echo ""

    test_docker
    echo ""

    # Summary
    print_summary
}

# Run main function
main "$@"
