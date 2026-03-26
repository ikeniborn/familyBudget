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

# Configure Docker firewall (DOCKER-USER chain)
# CRITICAL: Docker bypasses UFW by adding iptables rules before UFW chain
# Solution: Use DOCKER-USER chain to block ports before Docker's DOCKER chain
configure_docker_firewall() {
    step "Configuring Docker Firewall (DOCKER-USER chain)"

    # Check if iptables is available
    if ! command_exists iptables; then
        warning "iptables is not available, skipping Docker firewall configuration"
        return 0
    fi

    # Flush existing DOCKER-USER rules (clean slate)
    info "Flushing existing DOCKER-USER rules..."
    sudo iptables -F DOCKER-USER 2>/dev/null || true

    # Rule 1: Allow established connections (required for Docker to work)
    sudo iptables -I DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
    success "✓ Allowed established connections"

    # Rule 2: Allow internal Docker network traffic
    sudo iptables -I DOCKER-USER -i br-+ -j ACCEPT
    sudo iptables -I DOCKER-USER -i docker0 -j ACCEPT
    success "✓ Allowed internal Docker network traffic"

    # Rule 3: Block backend port 8000 from external access (must use Nginx reverse proxy)
    # Note: Internal traffic (docker0/br-+) already ACCEPTED above, so no -i filter needed
    sudo iptables -A DOCKER-USER -p tcp --dport 8000 -j DROP
    success "✓ Blocked external access to backend port 8000 (use Nginx)"

    # Rule 4: PostgreSQL external access control
    if [[ "${POSTGRES_EXTERNAL_ACCESS:-false}" == "true" ]]; then
        if [[ -n "${POSTGRES_ALLOWED_IP:-}" ]]; then
            # Allow only specific IP
            sudo iptables -A DOCKER-USER -p tcp --dport 5432 -s "${POSTGRES_ALLOWED_IP}" -j ACCEPT
            # Note: Internal traffic (docker0/br-+) already ACCEPTED above, so no -i filter needed
            sudo iptables -A DOCKER-USER -p tcp --dport 5432 -j DROP
            success "✓ PostgreSQL: allowed from ${POSTGRES_ALLOWED_IP}, blocked from others"
        else
            warning "⚠ POSTGRES_EXTERNAL_ACCESS=true but POSTGRES_ALLOWED_IP not set!"
            warning "  PostgreSQL is OPEN to the internet - set POSTGRES_ALLOWED_IP in .env"

            # For safety, block by default and show warning
            # Note: Internal traffic (docker0/br-+) already ACCEPTED above, so no -i filter needed
            sudo iptables -A DOCKER-USER -p tcp --dport 5432 -j DROP
            warning "  Blocked PostgreSQL external access for security (set POSTGRES_ALLOWED_IP to allow specific IP)"
        fi
    else
        # Block PostgreSQL external access completely
        # Note: Internal traffic (docker0/br-+) already ACCEPTED above, so no -i filter needed
        sudo iptables -A DOCKER-USER -p tcp --dport 5432 -j DROP
        success "✓ Blocked external access to PostgreSQL (internal only)"
    fi

    # Rule 5: Allow all other traffic (return to DOCKER chain)
    sudo iptables -A DOCKER-USER -j RETURN
    success "✓ Return to Docker default rules for other ports"

    echo ""
    success "Docker firewall configured successfully"

    # Show current DOCKER-USER rules
    info "Current DOCKER-USER rules:"
    sudo iptables -L DOCKER-USER -n -v --line-numbers | head -20

    # Persist iptables rules across Docker/host restarts
    info "Persisting iptables rules..."

    # Ensure iptables-persistent is installed (provides netfilter-persistent restore on boot)
    if ! dpkg -l iptables-persistent > /dev/null 2>&1; then
        info "Installing iptables-persistent for rule persistence..."
        if sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent > /dev/null 2>&1; then
            success "iptables-persistent installed"
        else
            warning "Could not install iptables-persistent — rules will not survive reboot"
            warning "Manual install: sudo apt-get install iptables-persistent"
            return 0
        fi
    fi

    # Save current iptables rules (loaded on boot by netfilter-persistent)
    if sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null 2>&1; then
        success "iptables rules saved to /etc/iptables/rules.v4 (persistent across reboots)"
    else
        warning "Could not save iptables rules — rules will be lost on Docker/host restart"
    fi

    return 0
}

# Configure UFW rules for PostgreSQL external access
# Automatically creates/deletes UFW rules based on POSTGRES_EXTERNAL_ACCESS and POSTGRES_ALLOWED_IP
configure_ufw_for_postgres() {
    step "Configuring UFW Rules for PostgreSQL"

    # Check if UFW is available
    if ! command_exists ufw; then
        warning "UFW is not installed, skipping PostgreSQL firewall configuration"
        return 0
    fi

    # Check UFW status
    if ! sudo ufw status 2>/dev/null | grep -q "Status: active"; then
        warning "UFW is not active, skipping PostgreSQL firewall configuration"
        info "To enable UFW: sudo ufw enable"
        return 0
    fi

    # Get current UFW rules for port 5432
    local current_rules=$(sudo ufw status numbered 2>/dev/null | grep "5432" || true)

    info "Current PostgreSQL UFW rules:"
    if [[ -z "$current_rules" ]]; then
        echo "  (no rules configured)"
    else
        echo "$current_rules" | sed 's/^/  /'
    fi
    echo ""

    # Check configuration
    if [[ "${POSTGRES_EXTERNAL_ACCESS:-false}" == "true" ]]; then
        # External access enabled
        if [[ -z "${POSTGRES_ALLOWED_IP:-}" ]]; then
            error "POSTGRES_EXTERNAL_ACCESS=true but POSTGRES_ALLOWED_IP is not set!"
            error "This would allow PostgreSQL access from ANY IP (security risk)."
            error "Please set POSTGRES_ALLOWED_IP in .env to a specific IP address."
            echo ""
            warning "Skipping PostgreSQL UFW configuration for security."
            warning "To fix: Add POSTGRES_ALLOWED_IP=<your-ip> to .env and re-run deploy"
            return 1
        fi

        info "PostgreSQL external access: ENABLED"
        info "Allowed IP: ${POSTGRES_ALLOWED_IP}"
        echo ""

        # Check if rule already exists for this IP
        if echo "$current_rules" | grep -q "from ${POSTGRES_ALLOWED_IP}.*5432"; then
            success "✓ UFW rule already exists for ${POSTGRES_ALLOWED_IP}"
            return 0
        fi

        # Delete old rules (if any)
        if [[ -n "$current_rules" ]]; then
            info "Removing old PostgreSQL UFW rules..."
            # Extract rule numbers in reverse order (to avoid shifting)
            local rule_numbers=$(echo "$current_rules" | grep -oP '^\[\s*\K\d+' | sort -rn)
            for rule_num in $rule_numbers; do
                echo "yes" | sudo ufw delete "$rule_num" >> "$LOG_FILE" 2>&1 || true
            done
            success "✓ Old rules removed"
        fi

        # Create new rule
        info "Creating UFW rule: allow from ${POSTGRES_ALLOWED_IP} to any port 5432..."
        if sudo ufw allow from "${POSTGRES_ALLOWED_IP}" to any port 5432 comment "PostgreSQL external access" >> "$LOG_FILE" 2>&1; then
            success "✓ UFW rule created successfully"

            # Verify rule was created
            local new_rule=$(sudo ufw status numbered 2>/dev/null | grep "5432" || true)
            if [[ -n "$new_rule" ]]; then
                info "Verified rule:"
                echo "$new_rule" | sed 's/^/  /'
            fi
        else
            error "Failed to create UFW rule"
            return 1
        fi

    else
        # External access disabled
        info "PostgreSQL external access: DISABLED (internal only)"
        echo ""

        # Remove all UFW rules for port 5432
        if [[ -n "$current_rules" ]]; then
            info "Removing all PostgreSQL UFW rules..."
            # Extract rule numbers in reverse order (to avoid shifting)
            local rule_numbers=$(echo "$current_rules" | grep -oP '^\[\s*\K\d+' | sort -rn)
            for rule_num in $rule_numbers; do
                echo "yes" | sudo ufw delete "$rule_num" >> "$LOG_FILE" 2>&1 || true
            done
            success "✓ All PostgreSQL UFW rules removed (internal access only)"
        else
            success "✓ No PostgreSQL UFW rules to remove (already internal only)"
        fi
    fi

    echo ""
    success "PostgreSQL UFW configuration completed"
    return 0
}
