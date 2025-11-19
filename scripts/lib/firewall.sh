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
    local port_80_status="closed"
    local port_443_status="not configured"

    if sudo ufw status 2>/dev/null | grep -q "80/tcp.*ALLOW"; then
        port_80_status="⚠ OPEN (should be closed)"
    fi

    if sudo ufw status 2>/dev/null | grep -q "443/tcp.*ALLOW"; then
        port_443_status="✓ configured"
    fi

    info "Current firewall status:"
    echo "  Port 80 (HTTP):   $port_80_status"
    echo "  Port 443 (HTTPS): $port_443_status"
    echo ""

    # SECURITY: Port 80 should NOT be open permanently
    # It opens ONLY temporarily during certbot renewal (managed by ssl_certificate_manager.sh)
    if sudo ufw status 2>/dev/null | grep -q "80/tcp.*ALLOW"; then
        warning "Port 80 is currently OPEN - closing for security"
        sudo ufw delete allow 80/tcp 2>/dev/null || true
        success "✓ Port 80 closed (will open temporarily for certbot when needed)"
    else
        info "✓ Port 80 is closed (correct - certbot will open temporarily)"
    fi

    # Open port 443 (HTTPS) - this should be ALWAYS open
    if ! sudo ufw status 2>/dev/null | grep -q "443/tcp.*ALLOW"; then
        sudo ufw allow 443/tcp comment 'HTTPS for Family Budget' >> "$LOG_FILE" 2>&1 || true
        success "✓ Port 443 (HTTPS) opened in firewall"
    else
        info "✓ Port 443 (HTTPS) already open"
    fi

    echo ""
    success "Firewall configured for SSL"
    info "Security policy:"
    echo "  ✓ Port 443 (HTTPS): OPEN permanently"
    echo "  ✓ Port 80 (HTTP): CLOSED (opens only for certbot renewal)"
}
