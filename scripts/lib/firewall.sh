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

# Validate UFW configuration (added for SEC-004, SEC-005 audit compliance)
validate_ufw_rules() {
    step "Validating UFW Configuration"

    # Check if UFW is available
    if ! command_exists ufw; then
        warning "UFW is not installed, skipping validation"
        return 0
    fi

    # Check UFW is active
    if ! sudo ufw status 2>/dev/null | grep -q "Status: active"; then
        error "UFW is not active!"
        warning "To enable: sudo ufw enable"
        return 1
    fi

    local ufw_verbose=$(sudo ufw status verbose)
    local ufw_numbered=$(sudo ufw status numbered)

    # Check default policies
    info "Checking default policies..."
    if echo "$ufw_verbose" | grep -q "Default:.*deny (incoming)"; then
        success "  ✓ Default incoming: DENY"
    else
        error "  ✗ Default incoming policy is NOT deny!"
        warning "    Run: sudo ufw default deny incoming"
    fi

    if echo "$ufw_verbose" | grep -q "Default:.*allow (outgoing)"; then
        success "  ✓ Default outgoing: ALLOW"
    else
        warning "  ⚠ Default outgoing policy is NOT allow (unusual but may be intentional)"
    fi

    # Check required ports
    info "Checking required ports..."

    if echo "$ufw_numbered" | grep -q "22.*ALLOW IN"; then
        success "  ✓ SSH port 22: ALLOWED"
    else
        error "  ✗ SSH port 22 is not allowed!"
        warning "    Run: sudo ufw allow 22/tcp"
    fi

    if echo "$ufw_numbered" | grep -q "443.*ALLOW IN"; then
        success "  ✓ HTTPS port 443: ALLOWED"
    else
        error "  ✗ HTTPS port 443 is not allowed!"
        warning "    Run: sudo ufw allow 443/tcp"
    fi

    # Port 80 is optional (for ACME challenge)
    if echo "$ufw_numbered" | grep -q "80.*ALLOW IN"; then
        info "  ℹ HTTP port 80: ALLOWED (for Let's Encrypt)"
    else
        info "  ℹ HTTP port 80: CLOSED (will open temporarily for certbot)"
    fi

    # Check PostgreSQL external access
    info "Checking PostgreSQL access..."
    if [[ "${POSTGRES_EXTERNAL_ACCESS:-false}" == "true" ]]; then
        if echo "$ufw_numbered" | grep -q "5432.*ALLOW IN"; then
            success "  ✓ PostgreSQL external access configured"
            # Show which IP is allowed
            local allowed_ip=$(echo "$ufw_numbered" | grep "5432.*ALLOW IN" | head -1)
            info "    Rule: $allowed_ip"
        else
            warning "  ⚠ POSTGRES_EXTERNAL_ACCESS=true but UFW rule missing!"
            warning "    Run: sudo ufw allow from <IP> to any port 5432"
        fi
    else
        if echo "$ufw_numbered" | grep -q "5432.*ALLOW IN"; then
            warning "  ⚠ PostgreSQL port 5432 is allowed in UFW but POSTGRES_EXTERNAL_ACCESS=false"
            info "    This may indicate stale configuration"
        else
            success "  ✓ PostgreSQL access blocked (internal only)"
        fi
    fi

    # Check that ports 8000 and 5432 are NOT publicly accessible (if exposed, should be blocked by UFW)
    info "Checking security (ports should be protected by UFW)..."
    if echo "$ufw_numbered" | grep -q "8000.*ALLOW IN"; then
        warning "  ⚠ Backend port 8000 is ALLOWED in UFW (should use Nginx reverse proxy instead)"
    else
        success "  ✓ Backend port 8000: Protected by UFW (access via Nginx only)"
    fi

    echo ""
    success "UFW validation completed"
    return 0
}
