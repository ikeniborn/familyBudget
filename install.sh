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

# Prevent interactive prompts from apt-get
export DEBIAN_FRONTEND=noninteractive

# Source timeout and retry library
# Note: Must source after LOG_FILE is set (done after check_root)
# Will be sourced in main() function

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

    if ! apt_with_retry update -y; then
        error "apt-get update failed after retries. Check network connection and $LOG_FILE"
    fi

    # SKIP apt-get upgrade by default (can hang on interactive prompts)
    # User can run manually after installation: sudo apt-get upgrade -y
    warning "Skipping apt-get upgrade (prevents hanging on interactive prompts)"
    info "To upgrade system packages manually after installation:"
    info "  sudo apt-get upgrade -y"
    echo ""

    success "System package list updated (upgrade skipped)"
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
        "cron"  # Cron daemon for automated backups (CRITICAL for backup automation)
        "python3-pip"  # Python package manager for boto3 (S3 backups)
        "imagemagick"  # Image processing for PWA icons generation
        "librsvg2-bin"  # SVG to PNG conversion (rsvg-convert) for PWA icons
    )

    for package in "${packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            # Use apt_with_retry which handles exponential backoff and retries
            if ! apt_with_retry install -y "$package"; then
                error "Failed to install $package after retries. Check $LOG_FILE for details."
            fi
        else
            info "$package is already installed"
        fi
    done

    success "Basic utilities installed"
}

# Install Python packages for S3 backups and VAPID key generation
install_python_packages() {
    info "Installing Python packages for S3 backups and VAPID key generation..."

    # Check if pip3 is available
    if ! command -v pip3 &> /dev/null; then
        warning "pip3 not found - skipping Python packages installation"
        warning "Install python3-pip first: apt-get install python3-pip"
        return 0
    fi

    # Check if boto3 is already installed
    if python3 -c "import boto3" 2>/dev/null; then
        local boto3_version=$(python3 -c "import boto3; print(boto3.__version__)" 2>/dev/null)
        info "boto3 is already installed (version: $boto3_version)"
    else
        info "Installing boto3..."
        # Install with --break-system-packages for externally-managed environments (Debian 12+)
        if pip3 install boto3 >> "$LOG_FILE" 2>&1; then
            success "boto3 installed successfully"
        elif pip3 install --break-system-packages boto3 >> "$LOG_FILE" 2>&1; then
            success "boto3 installed successfully (with --break-system-packages)"
        else
            warning "Failed to install boto3 - S3 backups may not work"
            warning "You can install manually with: pip3 install boto3"
        fi
    fi

    # Check if pywebpush is already installed (for VAPID key generation in setup.sh)
    if python3 -c "import py_vapid" 2>/dev/null; then
        local pywebpush_version=$(python3 -c "import pywebpush; print(pywebpush.__version__)" 2>/dev/null)
        info "pywebpush is already installed (version: $pywebpush_version)"
    else
        info "Installing pywebpush (for VAPID key generation)..."
        # Install with --break-system-packages for externally-managed environments (Debian 12+)
        if pip3 install pywebpush >> "$LOG_FILE" 2>&1; then
            success "pywebpush installed successfully"
        elif pip3 install --break-system-packages pywebpush >> "$LOG_FILE" 2>&1; then
            success "pywebpush installed successfully (with --break-system-packages)"
        else
            warning "Failed to install pywebpush - VAPID keys will not be auto-generated"
            warning "You can generate them manually with: ./scripts/generate_vapid_keys.sh --update-env"
        fi
    fi

    success "Python packages installed"
}

# =============================================================================
# GPG KEY VALIDATION FUNCTIONS (v1.1.0)
# =============================================================================

# Validate binary GPG key file structure
# Validates that a GPG keyring file is valid and contains keys
# Args:
#   $1: path to GPG key file (binary format)
# Returns:
#   0 if valid, 1 if invalid
# Validation checks:
#   - File exists and non-empty
#   - File has GPG binary signature (specific magic bytes)
#   - gpg can list keys without errors
#   - Key data is present in output
validate_gpg_key_file() {
    local gpg_file=$1

    # Check file exists and non-empty
    if [[ ! -f "$gpg_file" ]]; then
        warning "GPG key file does not exist: $gpg_file"
        return 1
    fi

    if [[ ! -s "$gpg_file" ]]; then
        warning "GPG key file is empty: $gpg_file"
        return 1
    fi

    info "Validating GPG key structure: $gpg_file"

    # Check binary signature (GPG binary files start with specific bytes)
    # Common GPG packet types:
    # 0x99 = Public Key Packet (most common)
    # 0x9a = Public-Key Encrypted Session Key Packet
    # 0xc5 = Compressed Data Packet
    # 0xc6 = Symmetrically Encrypted Data Packet
    # 0xa6 = Public-Subkey Packet
    # 0x8c = Marker Packet
    # 0x95 = Trust Packet
    local first_byte
    first_byte=$(od -An -tx1 -N1 "$gpg_file" 2>/dev/null | tr -d ' ')

    if [[ ! "$first_byte" =~ ^(99|9a|c5|c6|a6|8c|95)$ ]]; then
        warning "GPG key file has invalid binary signature: 0x$first_byte"
        info "Expected GPG packet marker: 0x99, 0x9a, 0xc5, 0xc6, 0xa6, 0x8c, or 0x95"
        return 1
    fi

    info "GPG binary signature check: PASSED (0x$first_byte)"

    # Try to list keys using gpg (most reliable validation)
    # Redirect stderr to capture errors
    local gpg_output
    local gpg_exit_code

    info "Running: gpg --no-default-keyring --keyring $gpg_file --list-keys"
    gpg_output=$(gpg --no-default-keyring --keyring "$gpg_file" --list-keys 2>&1)
    gpg_exit_code=$?

    if [[ $gpg_exit_code -ne 0 ]]; then
        warning "GPG key file failed validation: gpg --list-keys returned exit code $gpg_exit_code"
        echo "GPG output:" >> "$LOG_FILE"
        echo "$gpg_output" >> "$LOG_FILE"
        return 1
    fi

    # Check that gpg output contains key information (not empty/error)
    if [[ -z "$gpg_output" ]]; then
        warning "GPG key file appears empty: no keys found in keyring"
        return 1
    fi

    # Check for error keywords in output (even if exit code was 0)
    if echo "$gpg_output" | grep -qiE "(error|failed|invalid|no valid)"; then
        warning "GPG validation output contains errors:"
        echo "$gpg_output" | head -5
        echo "Full GPG output:" >> "$LOG_FILE"
        echo "$gpg_output" >> "$LOG_FILE"
        return 1
    fi

    info "GPG key validation: PASSED"
    info "Keys found in keyring:"
    echo "$gpg_output" | grep -E "^(pub|sub)" | while IFS= read -r line; do
        info "  $line"
    done

    return 0
}

# Create timestamped backup of GPG key file
# Creates backup with format: filename.backup.YYYYMMDD_HHMMSS
# Cleans up old backups (keeps only 5 most recent)
# Args:
#   $1: path to GPG key file
# Returns:
#   0 if backup created, 1 if failed
backup_gpg_key() {
    local gpg_file=$1
    local backup_file="${gpg_file}.backup.$(date +%Y%m%d_%H%M%S)"

    if [[ ! -f "$gpg_file" ]]; then
        info "No existing GPG key to backup"
        return 0
    fi

    info "Creating backup of GPG key..."

    if cp "$gpg_file" "$backup_file" 2>>"$LOG_FILE"; then
        chmod 644 "$backup_file"
        success "Backed up GPG key to: $backup_file"

        # Clean up old backups (keep only 5 most recent)
        local backup_dir
        backup_dir=$(dirname "$gpg_file")
        local backup_pattern
        backup_pattern="$(basename "$gpg_file").backup.*"

        # Count existing backups
        local backup_count
        backup_count=$(find "$backup_dir" -maxdepth 1 -name "$backup_pattern" 2>/dev/null | wc -l)

        if [[ $backup_count -gt 5 ]]; then
            info "Cleaning up old GPG backups (keeping 5 most recent)..."

            # List backups by modification time (oldest first), skip first (backup_count - 5)
            find "$backup_dir" -maxdepth 1 -name "$backup_pattern" -type f 2>/dev/null | \
                xargs ls -t | tail -n +6 | while IFS= read -r old_backup; do
                    rm -f "$old_backup"
                    info "Removed old backup: $old_backup"
                done
        fi

        return 0
    else
        warning "Failed to backup GPG key to: $backup_file"
        return 1
    fi
}

# Helper function: calculate exponential backoff delay
# Args:
#   $1: attempt number (1-based)
# Returns:
#   delay in seconds (5, 10, 20, capped at 60)
calculate_backoff_delay() {
    local attempt=$1
    local base_delay=5
    local max_delay=60

    # Exponential: 5 * 2^(attempt-1)
    local delay=$((base_delay * (1 << (attempt - 1))))

    # Cap at max_delay
    if [[ $delay -gt $max_delay ]]; then
        delay=$max_delay
    fi

    echo "$delay"
}

# Download, validate, and install Docker GPG key with retry
# Comprehensive validation at multiple checkpoints:
# 1. Check existing key - keep if valid
# 2. Download to temp file - validate text format
# 3. Convert to binary (gpg --dearmor) - check stderr
# 4. Validate binary result - check structure
# 5. Install to final location - cleanup temp files
# Uses execute_with_retry for resilience with exponential backoff
# Returns:
#   0 if successful, exits on failure after max attempts
setup_docker_gpg_key() {
    local max_attempts=3
    local attempt=1
    local gpg_keyring="/etc/apt/keyrings/docker.gpg"

    info "Setting up Docker GPG key with validation (max attempts: $max_attempts)..."

    # CRITICAL FIX v1.1.0: Check if existing key is valid BEFORE removing
    # Previous version blindly deleted existing key, risking loss of valid key
    if [[ -f "$gpg_keyring" ]]; then
        info "Existing Docker GPG key found at: $gpg_keyring"
        info "Validating existing key before replacement..."

        if validate_gpg_key_file "$gpg_keyring"; then
            success "Existing Docker GPG key is VALID - keeping it (no re-download needed)"
            info "Skipping GPG key setup - existing key passes all validation checks"
            return 0
        else
            warning "Existing Docker GPG key is INVALID or corrupted"
            info "Key will be replaced with fresh download from Docker repository"

            # Backup before replacement (even if invalid, for forensics)
            backup_gpg_key "$gpg_keyring" || warning "Backup failed, continuing anyway"

            # Remove invalid key
            info "Removing invalid GPG key: $gpg_keyring"
            rm -f "$gpg_keyring"
        fi
    else
        info "No existing Docker GPG key found - will download fresh key"
    fi

    # Retry loop for download + conversion
    while [[ $attempt -le $max_attempts ]]; do
        info "========================================="
        info "GPG Key Setup Attempt $attempt of $max_attempts"
        info "========================================="

        local temp_gpg_file="/tmp/docker-gpg-$$.tmp"
        local temp_binary_file="/tmp/docker-gpg-binary-$$.tmp"
        local gpg_stderr="/tmp/gpg-stderr-$$.tmp"

        # Step 1: Download GPG key
        info "[Step 1/5] Downloading Docker GPG key from https://download.docker.com/linux/$OS/gpg"

        if ! curl_with_retry -fsSL "https://download.docker.com/linux/$OS/gpg" -o "$temp_gpg_file"; then
            warning "[$attempt/$max_attempts] Download failed via curl_with_retry"
            rm -f "$temp_gpg_file"

            if [[ $attempt -lt $max_attempts ]]; then
                local delay
                delay=$(calculate_backoff_delay "$attempt")
                warning "Retrying in ${delay}s..."
                sleep "$delay"
                ((attempt++))
                continue
            else
                error "Failed to download Docker GPG key after $max_attempts attempts. Check network connection and $LOG_FILE"
            fi
        fi

        info "[Step 1/5] Download complete: $(stat --format='%s bytes' "$temp_gpg_file" 2>/dev/null || echo 'size unknown')"

        # Step 2: Validate downloaded content (TEXT format)
        info "[Step 2/5] Validating downloaded content (text format)"

        # Check 2.1: Not empty
        if [[ ! -s "$temp_gpg_file" ]]; then
            warning "[$attempt/$max_attempts] Downloaded file is empty"
            rm -f "$temp_gpg_file"

            if [[ $attempt -lt $max_attempts ]]; then
                local delay
                delay=$(calculate_backoff_delay "$attempt")
                warning "Retrying in ${delay}s..."
                sleep "$delay"
                ((attempt++))
                continue
            else
                error "Downloaded GPG key file is empty after $max_attempts attempts. Check Docker repository availability."
            fi
        fi

        # Check 2.2: Not HTML/XML (common proxy/captive portal error)
        if file "$temp_gpg_file" 2>/dev/null | grep -qiE "(html|xml)"; then
            warning "[$attempt/$max_attempts] Downloaded file is HTML/XML (not GPG key)"
            info "File type: $(file "$temp_gpg_file" 2>/dev/null)"
            info "First 10 lines (saved to $LOG_FILE):"
            head -10 "$temp_gpg_file" | tee -a "$LOG_FILE"
            rm -f "$temp_gpg_file"

            if [[ $attempt -lt $max_attempts ]]; then
                local delay
                delay=$(calculate_backoff_delay "$attempt")
                warning "Retrying in ${delay}s..."
                sleep "$delay"
                ((attempt++))
                continue
            else
                error "Downloaded file is HTML/XML after $max_attempts attempts. Check proxy/firewall and Docker repository availability."
            fi
        fi

        # Check 2.3: Contains GPG format markers (ASCII-armored)
        if ! grep -q "BEGIN PGP" "$temp_gpg_file" 2>/dev/null; then
            warning "[$attempt/$max_attempts] Downloaded file missing 'BEGIN PGP' marker"
            info "File type: $(file "$temp_gpg_file" 2>/dev/null || echo 'unknown')"
            info "First 5 lines:"
            head -5 "$temp_gpg_file" | tee -a "$LOG_FILE"
            rm -f "$temp_gpg_file"

            if [[ $attempt -lt $max_attempts ]]; then
                local delay
                delay=$(calculate_backoff_delay "$attempt")
                warning "Retrying in ${delay}s..."
                sleep "$delay"
                ((attempt++))
                continue
            else
                error "Downloaded file failed GPG format validation after $max_attempts attempts"
            fi
        fi

        info "[Step 2/5] Text format validation: PASSED"

        # Step 3: Convert to binary format (gpg --dearmor)
        info "[Step 3/5] Converting GPG key to binary format (gpg --dearmor)"

        # CRITICAL FIX v1.1.0: Capture and check stderr from gpg --dearmor
        # Previous version redirected stderr to log but never checked it
        if gpg --yes --dearmor < "$temp_gpg_file" > "$temp_binary_file" 2>"$gpg_stderr"; then
            info "[Step 3/5] Conversion exit code: 0 (success)"

            # Even if exit code 0, check stderr for warnings
            if [[ -s "$gpg_stderr" ]]; then
                info "[Step 3/5] GPG stderr output (check for warnings):"
                cat "$gpg_stderr" | tee -a "$LOG_FILE"

                # Check for critical errors in stderr (even if exit code was 0)
                if grep -qiE "(error|failed|invalid|no valid)" "$gpg_stderr" 2>/dev/null; then
                    warning "[$attempt/$max_attempts] GPG conversion produced errors in stderr"
                    cat "$gpg_stderr"
                    rm -f "$temp_gpg_file" "$temp_binary_file" "$gpg_stderr"

                    if [[ $attempt -lt $max_attempts ]]; then
                        local delay
                        delay=$(calculate_backoff_delay "$attempt")
                        warning "Retrying in ${delay}s..."
                        sleep "$delay"
                        ((attempt++))
                        continue
                    else
                        error "GPG conversion failed (stderr errors) after $max_attempts attempts. Check $LOG_FILE"
                    fi
                fi
            fi
        else
            local gpg_exit=$?
            warning "[$attempt/$max_attempts] GPG conversion command failed with exit code: $gpg_exit"
            if [[ -s "$gpg_stderr" ]]; then
                warning "GPG stderr output:"
                cat "$gpg_stderr" | tee -a "$LOG_FILE"
            fi
            rm -f "$temp_gpg_file" "$temp_binary_file" "$gpg_stderr"

            if [[ $attempt -lt $max_attempts ]]; then
                local delay
                delay=$(calculate_backoff_delay "$attempt")
                warning "Retrying in ${delay}s..."
                sleep "$delay"
                ((attempt++))
                continue
            else
                error "GPG conversion failed after $max_attempts attempts. Check $LOG_FILE for details."
            fi
        fi

        info "[Step 3/5] Conversion complete: $(stat --format='%s bytes' "$temp_binary_file" 2>/dev/null || echo 'size unknown')"

        # Step 4: Validate binary output BEFORE installing
        # CRITICAL FIX v1.1.0: Validate converted binary, not just text format
        # Previous version skipped binary validation entirely
        info "[Step 4/5] Validating converted binary GPG key"

        if validate_gpg_key_file "$temp_binary_file"; then
            info "[Step 4/5] Binary validation: PASSED"
        else
            warning "[$attempt/$max_attempts] Converted GPG key failed binary validation"
            rm -f "$temp_gpg_file" "$temp_binary_file" "$gpg_stderr"

            if [[ $attempt -lt $max_attempts ]]; then
                local delay
                delay=$(calculate_backoff_delay "$attempt")
                warning "Retrying in ${delay}s..."
                sleep "$delay"
                ((attempt++))
                continue
            else
                error "Converted GPG key failed validation after $max_attempts attempts"
            fi
        fi

        # Step 5: Install to final location
        info "[Step 5/5] Installing validated GPG key to $gpg_keyring"

        if mv "$temp_binary_file" "$gpg_keyring" 2>>"$LOG_FILE"; then
            chmod a+r "$gpg_keyring"
            rm -f "$temp_gpg_file" "$gpg_stderr"
            success "Docker GPG key installed and validated successfully"
            info "Final validation of installed key:"
            validate_gpg_key_file "$gpg_keyring"
            return 0
        else
            error "Failed to install GPG key to $gpg_keyring (filesystem error)"
        fi
    done

    # Should never reach here (error exits above handle all failure paths)
    error "Unexpected error in Docker GPG key setup - this should not happen"
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

    # Add Docker's official GPG key with comprehensive validation (v1.1.0)
    # Uses new setup_docker_gpg_key() function which:
    # - Validates existing key before removing (keep if valid)
    # - Downloads to temp file and validates text format
    # - Converts to binary (gpg --dearmor) and checks stderr
    # - Validates binary result before installation
    # - Retries on failure with exponential backoff (3 attempts)
    # - Creates backup before replacing valid keys
    install -m 0755 -d /etc/apt/keyrings
    setup_docker_gpg_key

    # Add Docker repository
    info "Adding Docker repository..."
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Update package index
    if ! apt_with_retry update -y; then
        error "apt-get update failed after retries while setting up Docker. Check $LOG_FILE"
    fi

    # Install Docker Engine
    info "Installing Docker Engine..."
    if ! apt_with_retry install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; then
        error "Docker installation failed after retries. Check $LOG_FILE for details."
    fi

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
    # SECURITY: Use 660 (not 666) - only owner and docker group can access
    # 666 would allow any process to access Docker daemon
    if [[ -S /var/run/docker.sock ]]; then
        chmod 660 /var/run/docker.sock 2>/dev/null || true
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

# Configure Redis kernel settings for optimal performance
configure_redis_kernel_settings() {
    info "Configuring Redis kernel settings for optimal performance..."

    local sysctl_file="/etc/sysctl.conf"
    local sysctl_d_file="/etc/sysctl.d/99-redis.conf"

    # Check if vm.overcommit_memory is already set
    if grep -q "^vm.overcommit_memory" "$sysctl_file" 2>/dev/null || \
       grep -q "^vm.overcommit_memory" "$sysctl_d_file" 2>/dev/null; then
        local current_value
        current_value=$(sysctl -n vm.overcommit_memory 2>/dev/null || echo "unknown")
        if [[ "$current_value" == "1" ]]; then
            info "vm.overcommit_memory already set to 1 - skipping"
            return 0
        else
            warning "vm.overcommit_memory is set to $current_value (not optimal for Redis)"
            info "Updating to recommended value: 1"
        fi
    fi

    # Create sysctl.d config file for Redis settings
    info "Creating Redis sysctl configuration: $sysctl_d_file"
    cat > "$sysctl_d_file" << 'EOF'
# Redis kernel settings for optimal performance
# See: https://redis.io/docs/getting-started/installation/install-redis-on-linux/

# Enable memory overcommit for Redis background saves
# Value 1 = always overcommit, never check (required for Redis fork/COW)
# Without this, Redis may fail to persist data under memory pressure
vm.overcommit_memory = 1

# Disable Transparent Huge Pages (THP) warning workaround
# Note: THP should be disabled at boot via systemd or rc.local
# This setting helps but doesn't fully disable THP
# vm.nr_hugepages = 0
EOF

    chmod 644 "$sysctl_d_file"

    # Apply the setting immediately
    info "Applying sysctl settings..."
    if sysctl -p "$sysctl_d_file" >> "$LOG_FILE" 2>&1; then
        success "Redis kernel settings applied (vm.overcommit_memory = 1)"
    else
        warning "Failed to apply sysctl settings - may require reboot"
    fi

    # Verify the setting
    local applied_value
    applied_value=$(sysctl -n vm.overcommit_memory 2>/dev/null || echo "unknown")
    if [[ "$applied_value" == "1" ]]; then
        success "Verified: vm.overcommit_memory = $applied_value"
    else
        warning "vm.overcommit_memory = $applied_value (expected 1)"
        warning "Reboot may be required for settings to take effect"
    fi

    # Disable Transparent Huge Pages (THP) if possible
    # This is another Redis recommendation
    if [[ -f /sys/kernel/mm/transparent_hugepage/enabled ]]; then
        local thp_status
        thp_status=$(cat /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null | grep -o '\[.*\]' | tr -d '[]')
        if [[ "$thp_status" != "never" ]]; then
            info "Disabling Transparent Huge Pages for current session..."
            echo never > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true
            echo never > /sys/kernel/mm/transparent_hugepage/defrag 2>/dev/null || true
            info "THP disabled for current session (add to rc.local for persistence)"
        else
            info "Transparent Huge Pages already disabled"
        fi
    fi
}

# Create deployment directory structure
create_directories() {
    info "Creating deployment directory structure in $DEPLOY_DIR..."

    # PRE-FLIGHT CHECK: Verify we're in repository and critical templates exist
    info "Verifying repository structure and template files..."

    local critical_templates=(
        "$REPO_DIR/nginx/conf.d/app-http.conf.template"
        "$REPO_DIR/nginx/conf.d/app-https.conf.template"
        "$REPO_DIR/.env.example"
    )

    local missing_templates=()
    for template in "${critical_templates[@]}"; do
        if [[ ! -f "$template" ]]; then
            missing_templates+=("$template")
        fi
    done

    if [[ ${#missing_templates[@]} -gt 0 ]]; then
        echo ""
        error_return "CRITICAL: Template files not found in repository!"
        echo ""
        echo "Missing template files:"
        for template in "${missing_templates[@]}"; do
            # Remove REPO_DIR prefix for cleaner output
            echo "  ✗ ${template/#$REPO_DIR\//}"
        done
        echo ""
        warning "This means install.sh was run from the WRONG directory!"
        echo ""

        # ENHANCEMENT v1.1.0: Attempt auto-detection of repository directory
        info "Attempting to auto-detect correct repository directory..."
        echo ""

        local detected_repo
        detected_repo=$(detect_repo_directory "$REPO_DIR")

        if [[ $? -eq 0 ]] && [[ -n "$detected_repo" ]]; then
            # Auto-detection succeeded
            success "Repository found: $detected_repo"
            echo ""
            info "SUGGESTED FIX - Re-run install.sh from detected repository:"
            echo ""
            echo "  cd $detected_repo"
            echo "  sudo ./install.sh"
            echo ""
        else
            # Auto-detection failed
            warning "Could not auto-detect repository directory"
            echo ""
            info "MANUAL STEPS to find and run install.sh correctly:"
            echo ""
            echo "  1. Find your repository directory:"
            echo "     find ~ -name 'install.sh' -type f 2>/dev/null | grep familyBudget"
            echo ""
            echo "  2. Change to repository directory (from step 1):"
            echo "     cd <path-from-step-1-directory>"
            echo ""
            echo "  3. Run install.sh from repository root:"
            echo "     sudo ./install.sh"
            echo ""
            echo "  Alternative: Clone repository fresh if not found:"
            echo "     git clone <repository-url> ~/familyBudget"
            echo "     cd ~/familyBudget"
            echo "     sudo ./install.sh"
            echo ""
        fi

        info "Current directory: $REPO_DIR"
        info "Expected: Repository root directory containing:"
        echo "  - nginx/conf.d/app-http.conf.template"
        echo "  - nginx/conf.d/app-https.conf.template"
        echo "  - .env.example"
        echo "  - install.sh, setup.sh, deploy.sh"
        echo ""
        exit 1
    fi

    success "Repository structure verified - all critical template files found"

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

    # Verify we're running from the repository and copy nginx templates
    local nginx_templates_found=0

    # Copy app-http.conf.template
    if [[ -f "$REPO_DIR/nginx/conf.d/app-http.conf.template" ]]; then
        cp "$REPO_DIR/nginx/conf.d/app-http.conf.template" "$DEPLOY_DIR/nginx/conf.d/" || \
            warning "Failed to copy nginx HTTP template (setup.sh may fail)"
        # Set correct ownership on copied file
        if [[ "$username" != "root" ]]; then
            chown "$username:$username" "$DEPLOY_DIR/nginx/conf.d/app-http.conf.template"
        fi
        info "Copied: nginx/conf.d/app-http.conf.template"
        nginx_templates_found=1
    else
        warning "Nginx HTTP template not found: $REPO_DIR/nginx/conf.d/app-http.conf.template"
    fi

    # Copy app-https.conf.template
    if [[ -f "$REPO_DIR/nginx/conf.d/app-https.conf.template" ]]; then
        cp "$REPO_DIR/nginx/conf.d/app-https.conf.template" "$DEPLOY_DIR/nginx/conf.d/" || \
            warning "Failed to copy nginx HTTPS template (setup.sh may fail)"
        # Set correct ownership on copied file
        if [[ "$username" != "root" ]]; then
            chown "$username:$username" "$DEPLOY_DIR/nginx/conf.d/app-https.conf.template"
        fi
        info "Copied: nginx/conf.d/app-https.conf.template"
        nginx_templates_found=1
    else
        warning "Nginx HTTPS template not found: $REPO_DIR/nginx/conf.d/app-https.conf.template"
    fi

    # Check if any templates were found
    if [[ $nginx_templates_found -eq 0 ]]; then
        warning "No nginx templates found in repository"
        warning "Please ensure install.sh is run from the repository directory"
        warning "setup.sh may fail without these templates"
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

    # PRE-INSTALLATION CHECKS
    info "Running pre-installation checks..."

    # Check 1: Disk space (need at least 500MB free for Node.js + npm packages)
    local free_space_mb
    free_space_mb=$(df /var/cache/apt/archives --output=avail | tail -1 | awk '{print int($1/1024)}')
    info "Available disk space: ${free_space_mb}MB"

    if [[ $free_space_mb -lt 500 ]]; then
        warning "Low disk space detected (${free_space_mb}MB < 500MB)"
        warning "Cleaning apt cache to free up space..."
        apt-get clean >> "$LOG_FILE" 2>&1
        apt-get autoclean >> "$LOG_FILE" 2>&1

        # Re-check space after cleanup
        free_space_mb=$(df /var/cache/apt/archives --output=avail | tail -1 | awk '{print int($1/1024)}')
        if [[ $free_space_mb -lt 500 ]]; then
            error "Insufficient disk space: ${free_space_mb}MB (need at least 500MB). Please free up disk space."
        fi
        info "Disk space after cleanup: ${free_space_mb}MB"
    fi

    # Check 2: Fix any broken dpkg state (from previous failed installations)
    info "Checking dpkg state..."
    if dpkg --audit 2>&1 | grep -q "error\|broken"; then
        warning "Broken dpkg packages detected - attempting to fix..."
        dpkg --configure -a >> "$LOG_FILE" 2>&1 || true
        apt-get install -f -y >> "$LOG_FILE" 2>&1 || true
    fi

    # Check 3: Clean apt cache (remove corrupted .deb files)
    info "Cleaning apt cache..."
    apt-get clean >> "$LOG_FILE" 2>&1
    rm -rf /var/cache/apt/archives/*.deb 2>/dev/null || true

    # Remove old Node.js versions if any
    info "Removing old Node.js versions..."
    apt-get remove -y nodejs npm >> "$LOG_FILE" 2>&1 || true
    apt-get autoremove -y >> "$LOG_FILE" 2>&1 || true

    # Install NodeSource repository (Node.js 20.x LTS)
    info "Adding NodeSource repository for Node.js 20.x LTS..."

    # Download NodeSource setup script with retry
    local setup_script="/tmp/nodesource_setup.sh"
    if ! curl_with_retry -fsSL https://deb.nodesource.com/setup_20.x -o "$setup_script"; then
        error "Failed to download NodeSource setup script after retries. Check network connection and $LOG_FILE for details."
    fi

    # Execute setup script with retry (5 minutes max)
    if ! execute_with_retry 300 3 "NodeSource repository setup" bash "$setup_script"; then
        rm -f "$setup_script"
        error "NodeSource repository setup failed after retries. Check $LOG_FILE for details."
    fi
    rm -f "$setup_script"

    info "NodeSource repository added successfully"

    # Update package index with retry
    info "Updating package index..."
    if ! apt_with_retry update -y; then
        error "apt-get update failed after retries. Check $LOG_FILE for details."
    fi

    # Install Node.js (includes npm) with error handling and retry
    info "Installing Node.js and npm..."

    # Fix any dpkg errors before installation
    dpkg --configure -a >> "$LOG_FILE" 2>&1 || true
    apt-get install -f -y >> "$LOG_FILE" 2>&1 || true

    # Clean cache before installation
    apt-get clean >> "$LOG_FILE" 2>&1
    rm -rf /var/cache/apt/archives/nodejs*.deb 2>/dev/null || true

    # Install with retry and timeout
    if ! apt_with_retry install -y nodejs; then
        warning "Node.js installation via apt failed after retries."
        warning "Trying alternative installation method (direct binary download)..."

        if ! install_nodejs_manual; then
            error "Node.js installation failed with both methods. Check $LOG_FILE for details."
        fi
    fi

    # Verify installation
    if command_exists node && command_exists npm; then
        local node_version
        local npm_version
        node_version=$(node --version)
        npm_version=$(npm --version)
        success "Node.js installed successfully (version: $node_version)"
        success "npm installed successfully (version: $npm_version)"
    else
        error "Node.js/npm installation failed - executables not found in PATH"
    fi
}

# Alternative installation method: Install Node.js from official binaries
# Used as fallback when apt-get installation fails or times out
install_nodejs_manual() {
    info "Installing Node.js from official binaries (alternative method)..."

    # Detect architecture
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64)
            arch="x64"
            ;;
        aarch64|arm64)
            arch="arm64"
            ;;
        armv7l)
            arch="armv7l"
            ;;
        *)
            error "Unsupported architecture: $arch"
            return 1
            ;;
    esac

    # Node.js version to install (LTS)
    local node_version="20.18.1"  # Latest LTS as of Dec 2024
    local node_tarball="node-v${node_version}-linux-${arch}.tar.xz"
    local node_url="https://nodejs.org/dist/v${node_version}/${node_tarball}"
    local download_path="/tmp/${node_tarball}"

    info "Downloading Node.js v${node_version} for ${arch}..."
    if ! curl_with_retry -fsSL -o "$download_path" "$node_url"; then
        error_return "Failed to download Node.js binary from nodejs.org"
        return 1
    fi

    # Verify download
    if [[ ! -f "$download_path" ]]; then
        error_return "Download failed - file not found: $download_path"
        return 1
    fi

    local file_size
    file_size=$(stat -c%s "$download_path" 2>/dev/null || echo "0")
    if [[ "$file_size" -lt 10000000 ]]; then  # Less than 10MB is suspicious
        error_return "Downloaded file is too small (${file_size} bytes) - download may be incomplete"
        rm -f "$download_path"
        return 1
    fi

    info "Extracting Node.js to /usr/local..."

    # Extract to temporary location first
    local temp_extract="/tmp/node-extract-$$"
    mkdir -p "$temp_extract"

    if ! tar -xJf "$download_path" -C "$temp_extract" >> "$LOG_FILE" 2>&1; then
        error_return "Failed to extract Node.js tarball"
        rm -rf "$temp_extract" "$download_path"
        return 1
    fi

    # Move files to /usr/local
    local extracted_dir="$temp_extract/node-v${node_version}-linux-${arch}"

    if [[ ! -d "$extracted_dir" ]]; then
        error_return "Extracted directory not found: $extracted_dir"
        rm -rf "$temp_extract" "$download_path"
        return 1
    fi

    # Copy binaries
    info "Installing binaries to /usr/local/bin..."
    cp -f "$extracted_dir/bin/node" /usr/local/bin/node
    cp -f "$extracted_dir/bin/npm" /usr/local/bin/npm
    cp -f "$extracted_dir/bin/npx" /usr/local/bin/npx
    chmod +x /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx

    # Copy libraries and includes
    cp -rf "$extracted_dir/lib" /usr/local/
    cp -rf "$extracted_dir/include" /usr/local/
    cp -rf "$extracted_dir/share" /usr/local/

    # Cleanup
    rm -rf "$temp_extract" "$download_path"

    # Verify installation
    if command_exists node && command_exists npm; then
        local node_version_installed
        node_version_installed=$(node --version)
        success "Node.js installed manually (version: $node_version_installed)"
        return 0
    else
        error_return "Manual Node.js installation failed - executables not found"
        return 1
    fi
}

# Setup isolated npm environment in production directory (/opt/budget)
# ARCHITECTURE CHANGE (2025-11-08):
# - npm env now created ONLY in production directory
# - NOT copied via rsync (excluded in sync.sh)
# - Uses absolute paths (not ${PROJECT_DIR} variable)
setup_isolated_npm_env() {
    info "Setting up isolated npm environment in production directory..."

    local username="${SUDO_USER:-$USER}"
    local isolated_dir="/opt/budget/.npm-isolated"

    # Create isolated directory structure in production directory
    if [[ ! -d "$isolated_dir" ]]; then
        info "Creating isolated npm directory: $isolated_dir"
        mkdir -p "$isolated_dir"
    else
        info "Isolated npm directory already exists: $isolated_dir"
    fi

    # Create .npmrc for project-level isolation with ABSOLUTE PATHS
    # IMPORTANT: Using absolute path to prevent ${PROJECT_DIR} literal directory creation
    local npmrc_file="$isolated_dir/.npmrc"
    info "Creating npm configuration: $npmrc_file"
    cat > "$npmrc_file" << EOF
# Isolated npm environment for Family Budget (Production Directory)
# This configuration ensures dependencies are installed in /opt/budget

# Cache directory (ABSOLUTE path - prevents \${PROJECT_DIR} corruption)
cache=/opt/budget/.npm-isolated/cache

# Audit level
audit-level=moderate

# Engine strict (enforce node/npm versions from package.json)
engine-strict=true

# Save exact versions (no ^ or ~)
save-exact=true

# Production flag (install devDependencies for build tools)
production=false
EOF

    # Set ownership to non-root user
    if [[ "$username" != "root" ]]; then
        chown -R "$username:$username" "$isolated_dir"
    fi

    success "Isolated npm environment configured: $isolated_dir (production-only)"
}

# Check npm dependencies integrity and versions
check_npm_dependencies() {
    local repo_dir="$1"
    local isolated_dir="$repo_dir/.npm-isolated"
    local node_modules="$isolated_dir/node_modules"

    info "Checking npm dependencies integrity..."

    # Check 1: node_modules exists
    if [[ ! -d "$node_modules" ]]; then
        info "node_modules not found - need to install"
        return 1  # Need install
    fi

    # Check 2: package-lock.json integrity
    if [[ ! -f "$node_modules/.package-lock.json" ]]; then
        warning "package-lock.json missing in node_modules - may be corrupted"
        return 1  # Corrupted
    fi

    # Check 3: package.json vs node_modules freshness
    if [[ "$repo_dir/package.json" -nt "$node_modules" ]]; then
        info "package.json modified after node_modules - need to reinstall"
        return 1  # Need reinstall
    fi

    # Check 4: Critical packages exist
    local missing_packages=0
    local critical_packages=("terser" "cssnano" "postcss" "postcss-cli" "tailwindcss" "daisyui")

    for pkg in "${critical_packages[@]}"; do
        if [[ ! -d "$node_modules/$pkg" ]]; then
            warning "Missing critical package: $pkg"
            ((missing_packages++))
        fi
    done

    if [[ $missing_packages -gt 0 ]]; then
        warning "Found $missing_packages missing critical packages"
        info "Triggering clean reinstall of all npm dependencies..."
        return 1  # Triggers reinstall in install_npm_dependencies()
    fi

    # Check 5: Verify Tailwind CSS version (prevent 4.x mismatch)
    if command -v jq &> /dev/null && [[ -f "$repo_dir/package.json" ]]; then
        local expected_tailwind
        local installed_tailwind

        expected_tailwind=$(jq -r '.devDependencies.tailwindcss // empty' "$repo_dir/package.json")

        if [[ -f "$node_modules/tailwindcss/package.json" ]]; then
            installed_tailwind=$(jq -r '.version // empty' "$node_modules/tailwindcss/package.json")

            if [[ -n "$expected_tailwind" && -n "$installed_tailwind" ]]; then
                if [[ "$expected_tailwind" != "$installed_tailwind" ]]; then
                    warning "Tailwind CSS version mismatch!"
                    warning "  Expected: $expected_tailwind"
                    warning "  Installed: $installed_tailwind"
                    return 1  # Version mismatch
                else
                    info "Tailwind CSS version verified: $installed_tailwind"
                fi
            fi
        fi
    fi

    info "npm dependencies integrity check passed"
    return 0  # All checks passed
}

# Install npm dependencies for the project (in production isolated environment)
# ARCHITECTURE CHANGE (2025-11-08):
# - Installs to /opt/budget/.npm-isolated (not ~/familyBudget/.npm-isolated)
# - Uses absolute paths for reliability
install_npm_dependencies() {
    info "Installing npm dependencies in production isolated environment..."

    # Get the username for ownership
    local username="${SUDO_USER:-$USER}"

    # Check if package.json exists in repository
    if [[ ! -f "$REPO_DIR/package.json" ]]; then
        warning "package.json not found in $REPO_DIR - skipping npm dependencies"
        return 0
    fi

    # Setup isolated npm environment first (creates /opt/budget/.npm-isolated)
    setup_isolated_npm_env

    local isolated_dir="/opt/budget/.npm-isolated"
    local node_modules="$isolated_dir/node_modules"

    # Check if dependencies are already installed and up-to-date
    # Note: check_npm_dependencies checks if node_modules is fresh
    if [[ -d "$node_modules" ]] && check_npm_dependencies "/opt/budget"; then
        success "npm dependencies already installed and up-to-date in production"
        return 0
    fi

    # Dependencies need to be installed/reinstalled
    info "npm dependencies validation failed - missing or corrupted packages detected"
    info "Performing clean reinstall of all npm dependencies in production isolated environment..."

    # Remove old/corrupted node_modules if exists
    if [[ -d "$node_modules" ]]; then
        warning "Removing old node_modules for clean reinstall..."
        rm -rf "$node_modules"
    fi

    # Remove old package-lock.json from isolated dir if exists
    if [[ -f "$isolated_dir/package-lock.json" ]]; then
        rm -f "$isolated_dir/package-lock.json"
    fi

    # Copy package.json and package-lock.json from repository to isolated directory
    cp "$REPO_DIR/package.json" "$isolated_dir/"
    if [[ -f "$REPO_DIR/package-lock.json" ]]; then
        cp -f "$REPO_DIR/package-lock.json" "$isolated_dir/"
        info "Copied package.json and package-lock.json to $isolated_dir"
    else
        info "Copied package.json to $isolated_dir (no lock file yet)"
    fi

    # Install dependencies using npm ci (clean install with locked versions)
    cd "$isolated_dir" || error "Failed to cd to isolated directory: $isolated_dir"

    if [[ "$username" != "root" ]]; then
        info "Installing npm packages in production isolated environment as user '$username'..."

        # Use npm ci for reproducible builds (if package-lock.json exists)
        if [[ -f "package-lock.json" ]]; then
            info "Using npm ci (clean install with locked versions)..."
            if ! execute_with_retry "$TIMEOUT_NPM_INSTALL" "$MAX_RETRY_ATTEMPTS" "npm ci (as user $username)" \
                su - "$username" -c "cd $isolated_dir && npm ci"; then
                error "npm ci failed after retries. Check $LOG_FILE for details."
            fi
        else
            warning "package-lock.json not found - using npm install (will create lock file)"
            if ! execute_with_retry "$TIMEOUT_NPM_INSTALL" "$MAX_RETRY_ATTEMPTS" "npm install (as user $username)" \
                su - "$username" -c "cd $isolated_dir && npm install"; then
                error "npm install failed after retries. Check $LOG_FILE for details."
            fi

            # Copy generated package-lock.json back to repository for version control
            if [[ -f "$isolated_dir/package-lock.json" ]]; then
                cp "$isolated_dir/package-lock.json" "$REPO_DIR/"
                info "Generated package-lock.json copied to repository (commit this file)"
            fi
        fi
    else
        warning "Running as root - installing npm packages as root (not recommended)"

        if [[ -f "package-lock.json" ]]; then
            if ! npm_with_retry ci; then
                error "npm ci failed after retries. Check $LOG_FILE for details."
            fi
        else
            if ! npm_with_retry install; then
                error "npm install failed after retries. Check $LOG_FILE for details."
            fi

            # Copy generated package-lock.json back to repository
            if [[ -f "$isolated_dir/package-lock.json" ]]; then
                cp "$isolated_dir/package-lock.json" "$REPO_DIR/"
            fi
        fi
    fi

    cd "$REPO_DIR" || error "Failed to cd back to repository: $REPO_DIR"

    # Set correct ownership on isolated directory
    if [[ "$username" != "root" ]]; then
        chown -R "$username:$username" "$isolated_dir"
    fi

    # Verify installation
    if [[ -d "$node_modules" ]]; then
        local package_count
        package_count=$(find "$node_modules" -maxdepth 1 -type d ! -name ".*" | wc -l)
        success "npm dependencies installed in production isolated environment ($package_count packages)"

        # Verify Tailwind CSS version
        if [[ -f "$node_modules/tailwindcss/package.json" ]]; then
            local tailwind_version
            tailwind_version=$(jq -r '.version' "$node_modules/tailwindcss/package.json" 2>/dev/null || echo "unknown")
            info "Tailwind CSS version: $tailwind_version"
        fi
    else
        error "npm install failed - node_modules not found in production isolated directory"
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
    echo "  ✓ ImageMagick: $(convert --version 2>&1 | head -1 | awk '{print $3}')"
    echo "  ✓ librsvg: $(rsvg-convert --version 2>&1 | head -1)"
    echo "  ✓ Basic utilities (curl, git, jq, rsync, etc.)"
    echo "  ✓ Python packages:"
    if python3 -c "import boto3" 2>/dev/null; then
        echo "    - boto3 $(python3 -c "import boto3; print(boto3.__version__)" 2>/dev/null) (S3 backups)"
    else
        echo "    - boto3 (not installed)"
    fi
    if python3 -c "import pywebpush" 2>/dev/null; then
        echo "    - pywebpush $(python3 -c "import pywebpush; print(pywebpush.__version__)" 2>/dev/null) (VAPID key generation)"
    else
        echo "    - pywebpush (not installed)"
    fi
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
    echo "NPM isolated environment (Production Directory):"
    if [[ -d "/opt/budget/.npm-isolated/node_modules" ]]; then
        local package_count
        package_count=$(find "/opt/budget/.npm-isolated/node_modules" -maxdepth 1 -type d ! -name ".*" | wc -l)
        echo "  ✓ Isolated npm environment: /opt/budget/.npm-isolated/ (production-only)"
        echo "  ✓ npm packages installed ($package_count packages)"

        # Show Tailwind CSS version
        if [[ -f "/opt/budget/.npm-isolated/node_modules/tailwindcss/package.json" ]]; then
            local tailwind_version
            tailwind_version=$(jq -r '.version' "/opt/budget/.npm-isolated/node_modules/tailwindcss/package.json" 2>/dev/null || echo "unknown")
            echo "  ✓ Tailwind CSS version: $tailwind_version"
        fi
    else
        echo "  ✗ npm packages not installed (run install.sh again)"
    fi
    echo ""
    echo "IMPORTANT: npm environment is now in production directory (/opt/budget)"
    echo "  • NOT copied via rsync (excluded in sync.sh)"
    echo "  • Faster deployments (~100-200MB not transferred)"
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

# Show usage information
# Displays help message with available command-line options
show_usage() {
    cat << EOF
Family Budget - System Installation Script

Usage:
  $0 [OPTIONS]

Options:
  --repo-dir DIR        Use custom repository directory instead of script location
                        (Default: directory where install.sh is located)
  -h, --help            Show this help message and exit

Examples:
  # Standard installation from repository directory
  cd ~/familyBudget
  sudo ./install.sh

  # Installation with custom repository directory
  sudo /path/to/install.sh --repo-dir ~/familyBudget

  # Show help
  ./install.sh --help

Description:
  This script installs system dependencies for Family Budget:
  • Docker Engine and Docker Compose
  • Node.js (via NVM or NodeSource)
  • Python packages (boto3, pywebpush)
  • UFW Firewall with basic rules
  • Required system utilities

  Run this script FIRST before setup.sh or deploy.sh.

Logs:
  Installation log: $LOG_FILE

For more information, see:
  README.md - User documentation
  CLAUDE.md - Developer documentation
EOF
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    # Parse command-line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --repo-dir)
                if [[ -z "$2" ]]; then
                    echo "[ERROR] --repo-dir requires a directory argument"
                    echo ""
                    show_usage
                    exit 1
                fi
                if [[ ! -d "$2" ]]; then
                    echo "[ERROR] Repository directory does not exist: $2"
                    exit 1
                fi
                REPO_DIR="$(cd "$2" && pwd)"
                echo "[INFO] Using custom repository directory: $REPO_DIR"
                shift 2
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                echo "[ERROR] Unknown option: $1"
                echo ""
                show_usage
                exit 1
                ;;
        esac
    done

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

    # Source timeout and retry library
    if [[ -f "$SCRIPT_DIR/scripts/lib/timeout.sh" ]]; then
        # shellcheck source=scripts/lib/timeout.sh
        source "$SCRIPT_DIR/scripts/lib/timeout.sh"
        info "Loaded timeout and retry library"
    else
        warning "timeout.sh not found - using hardcoded timeouts"
    fi

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

    # Run network pre-flight checks
    if command -v network_preflight_check &>/dev/null; then
        if ! network_preflight_check "false"; then
            suggest_network_fixes
            echo ""
            warning "Network issues detected. Installation may fail or be slow."
            warning "It is recommended to resolve network issues before continuing."
            echo ""
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                info "Installation cancelled by user"
                exit 0
            fi
        fi
    fi

    # Installation steps
    echo ""
    info "Starting installation..."
    echo ""

    update_system
    echo ""

    install_utilities
    echo ""

    install_python_packages
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

    configure_redis_kernel_settings
    echo ""

    # Summary
    print_summary
}

# Run main function
main "$@"
