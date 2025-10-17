#!/bin/bash
#
# Family Budget - Clean Old Certificates Script
#
# This script removes old SSL certificates from previous projects
# that may interfere with Family Budget certificate setup.
#
# Usage:
#   ./clean_old_certificates.sh
#
# Author: Family Budget Team
# Version: 1.0.0
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored message
print_message() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

info() {
    print_message "$BLUE" "[INFO] $*"
}

success() {
    print_message "$GREEN" "[SUCCESS] $*"
}

warning() {
    print_message "$YELLOW" "[WARNING] $*"
}

error() {
    print_message "$RED" "[ERROR] $*"
    exit 1
}

echo "========================================================================"
print_message "$BLUE" "       Family Budget - Certificate Cleanup"
echo "========================================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTBOT_CONF_DIR="$SCRIPT_DIR/certbot/conf"

# Check if certbot/conf directory exists
if [[ ! -d "$CERTBOT_CONF_DIR" ]]; then
    info "No certbot/conf directory found - nothing to clean"
    exit 0
fi

# Check if there are any certificates
if [[ ! -d "$CERTBOT_CONF_DIR/live" ]] && [[ ! -d "$CERTBOT_CONF_DIR/archive" ]]; then
    info "No certificates found - nothing to clean"
    exit 0
fi

# Display current certificates
warning "Found SSL certificates in certbot directory:"
echo ""

if [[ -d "$CERTBOT_CONF_DIR/live" ]]; then
    info "Live certificates:"
    ls -la "$CERTBOT_CONF_DIR/live" 2>/dev/null | tail -n +4 || echo "  (empty)"
    echo ""
fi

if [[ -d "$CERTBOT_CONF_DIR/archive" ]]; then
    info "Archived certificates:"
    ls -la "$CERTBOT_CONF_DIR/archive" 2>/dev/null | tail -n +4 || echo "  (empty)"
    echo ""
fi

if [[ -d "$CERTBOT_CONF_DIR/renewal" ]]; then
    info "Renewal configurations:"
    ls -la "$CERTBOT_CONF_DIR/renewal" 2>/dev/null | tail -n +4 || echo "  (empty)"
    echo ""
fi

# Check for host system certificates (require sudo)
HOST_LETSENCRYPT_DIR="/etc/letsencrypt"
if sudo test -d "$HOST_LETSENCRYPT_DIR/live" 2>/dev/null; then
    warning "Also found certificates in host system: $HOST_LETSENCRYPT_DIR"
    echo ""
fi

# Ask for confirmation
echo "========================================================================"
warning "This will DELETE all certificates and configurations!"
echo ""
echo "This action:"
echo "  • Removes all certificates from $CERTBOT_CONF_DIR"
echo "  • Allows certbot to obtain new certificates for your domain"
echo "  • Does NOT affect certificates on host system ($HOST_LETSENCRYPT_DIR)"
echo ""
warning "To clean host system certificates, run:"
echo "  sudo rm -rf $HOST_LETSENCRYPT_DIR/*"
echo ""
echo "========================================================================"
echo ""

read -p "Type 'DELETE' to confirm certificate cleanup: " confirm
echo ""

if [[ "$confirm" != "DELETE" ]]; then
    info "Certificate cleanup cancelled"
    exit 0
fi

# Perform cleanup
info "Removing certificates from $CERTBOT_CONF_DIR..."

# Remove all certificate directories
rm -rf "$CERTBOT_CONF_DIR/live" 2>/dev/null || true
rm -rf "$CERTBOT_CONF_DIR/archive" 2>/dev/null || true
rm -rf "$CERTBOT_CONF_DIR/renewal" 2>/dev/null || true
rm -rf "$CERTBOT_CONF_DIR/accounts" 2>/dev/null || true
rm -rf "$CERTBOT_CONF_DIR/csr" 2>/dev/null || true
rm -rf "$CERTBOT_CONF_DIR/keys" 2>/dev/null || true
rm -rf "$CERTBOT_CONF_DIR/renewal-hooks" 2>/dev/null || true

# Keep the directory structure
mkdir -p "$CERTBOT_CONF_DIR"

success "Certificate cleanup completed!"
echo ""
info "Certbot directory is now clean and ready for new certificates"
echo ""

# Check if user wants to clean host system certificates
if sudo test -d "$HOST_LETSENCRYPT_DIR/live" 2>/dev/null; then
    echo "========================================================================"
    warning "Host system still has certificates in $HOST_LETSENCRYPT_DIR"
    echo ""
    read -p "Do you want to clean host system certificates too? [y/N]: " clean_host
    echo ""

    if [[ "${clean_host,,}" == "y" ]]; then
        warning "Cleaning host system certificates (requires sudo)..."

        read -p "Type 'DELETE' to confirm host cleanup: " confirm_host
        echo ""

        if [[ "$confirm_host" == "DELETE" ]]; then
            sudo rm -rf "$HOST_LETSENCRYPT_DIR"/* 2>/dev/null || true
            success "Host system certificates cleaned"
        else
            info "Host system cleanup cancelled"
        fi
    else
        info "Keeping host system certificates"
        warning "Note: Old certificates on host may cause conflicts if mounted"
    fi
fi

echo ""
echo "========================================================================"
success "Cleanup complete! You can now deploy with fresh certificates."
echo "========================================================================"
