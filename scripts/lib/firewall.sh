#!/bin/bash
#
# firewall.sh - Firewall Management
#
# Module for configuring UFW firewall rules
#
# Dependencies: config.sh, utils.sh
#

# Configure firewall for SSL
configure_firewall_for_ssl() {
    # Check if UFW is available
    if ! command_exists ufw; then
        warning "UFW is not installed, skipping firewall configuration"
        return 0
    fi

    step "Configuring Firewall for SSL"

    # Check current status
    local port_80_status="not configured"
    local port_443_status="not configured"

    if sudo ufw status 2>/dev/null | grep -q "80/tcp.*ALLOW"; then
        port_80_status="✓ configured"
    fi

    if sudo ufw status 2>/dev/null | grep -q "443/tcp.*ALLOW"; then
        port_443_status="✓ configured"
    fi

    info "Current firewall status:"
    echo "  Port 80 (HTTP):   $port_80_status"
    echo "  Port 443 (HTTPS): $port_443_status"
    echo ""

    info "Automatically opening ports 80 and 443 for SSL and HTTP→HTTPS redirect..."

    # Open port 80 (HTTP)
    if ! sudo ufw status 2>/dev/null | grep -q "80/tcp.*ALLOW"; then
        sudo ufw allow 80/tcp comment 'HTTP for Family Budget' >> "$LOG_FILE" 2>&1 || true
        success "✓ Port 80 (HTTP) opened in firewall"
    else
        info "✓ Port 80 (HTTP) already open"
    fi

    # Open port 443 (HTTPS)
    if ! sudo ufw status 2>/dev/null | grep -q "443/tcp.*ALLOW"; then
        sudo ufw allow 443/tcp comment 'HTTPS for Family Budget' >> "$LOG_FILE" 2>&1 || true
        success "✓ Port 443 (HTTPS) opened in firewall"
    else
        info "✓ Port 443 (HTTPS) already open"
    fi

    echo ""
    success "Firewall configured for SSL: Ports 80 and 443 are open"
}
