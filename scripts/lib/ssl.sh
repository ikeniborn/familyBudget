#!/bin/bash
#
# scripts/lib/ssl.sh - SSL certificate management functions
#
# This module handles SSL-related operations:
# - Let's Encrypt certificate setup (via host certbot)
# - SSL certificate verification
#
# Dependencies: config.sh, utils.sh
#
# Usage:
#   source scripts/lib/ssl.sh
#   setup_ssl_certificates
#   verify_ssl
#
# Part of Phase 3 refactoring (SSL functions extracted from deploy.sh)
# Nginx configuration is now embedded in Docker image (v9.0 registry-first)
#

# =============================================================================
# SSL CERTIFICATE FUNCTIONS
# =============================================================================

# Setup SSL certificates with Let's Encrypt (using host certbot)
setup_ssl_certificates() {
    # Source .env to check SSL_TYPE
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    local ssl_type="${SSL_TYPE:-none}"
    local domain="${DOMAIN:-localhost}"

    # Skip if SSL is not letsencrypt
    if [[ "$ssl_type" != "letsencrypt" ]]; then
        info "SSL type is '$ssl_type' - skipping certificate setup"
        return 0
    fi

    # Skip if domain is localhost
    if [[ "$domain" == "localhost" ]]; then
        info "Domain is localhost - skipping SSL certificate setup"
        return 0
    fi

    step "Setting up SSL certificate for $domain..."

    # Check if ssl_certificate_manager.sh exists
    local ssl_manager="$DEPLOY_DIR/scripts/ssl_certificate_manager.sh"
    if [[ ! -f "$ssl_manager" ]]; then
        error "SSL certificate manager script not found: $ssl_manager"
    fi

    # Get Let's Encrypt email
    local email="${LETSENCRYPT_EMAIL:-}"
    if [[ -z "$email" ]]; then
        error "LETSENCRYPT_EMAIL is not set in .env file"
    fi

    # Get server IP (try to detect automatically)
    local server_ip="${SERVER_IP:-}"
    if [[ -z "$server_ip" ]]; then
        # Try to detect public IP
        server_ip=$(curl -s ifconfig.me 2>/dev/null || echo "")
        if [[ -z "$server_ip" ]]; then
            error "SERVER_IP not set in .env and auto-detection failed. Please set SERVER_IP in .env file."
        fi
        info "Auto-detected server IP: $server_ip"
    fi

    # Check if certificate already exists
    if [ -d "/etc/letsencrypt/live/$domain" ]; then
        success "SSL certificate already exists for $domain"

        # Validate certificate
        if sudo "$ssl_manager" check "$domain" >> "$LOG_FILE" 2>&1; then
            info "Certificate is valid"

            # Ensure auto-renewal is configured (idempotent)
            info "Ensuring auto-renewal cron job is configured..."
            if sudo "$ssl_manager" setup-cron >> "$LOG_FILE" 2>&1; then
                success "Auto-renewal configuration verified"
                info "Certificates will auto-renew 2x daily via cron"
            else
                warning "Failed to setup auto-renewal. Check $LOG_FILE for details."
                warning "You may need to run manually: sudo scripts/ssl_certificate_manager.sh setup-cron"
            fi

            # Registry-first v9.0: nginx entrypoint auto-selects HTTPS template when cert exists
            # No need to check nginx.conf — just restart nginx to pick up the certificate
            if compose_cmd ps -q nginx > /dev/null 2>&1; then
                info "Restarting nginx to pick up certificate..."
                compose_cmd restart nginx >> "$LOG_FILE" 2>&1 || true
                wait_for_service nginx 60
            fi
            success "SSL certificate valid for $domain - no changes needed"
            return 0
        else
            warning "Certificate validation failed, will obtain new certificate"
        fi
    fi

    # Obtain new certificate using ssl_certificate_manager.sh
    info "Obtaining SSL certificate from Let's Encrypt (host certbot)..."
    info "Domain: $domain"
    info "Email: $email"
    info "Server IP: $server_ip"
    echo ""

    if sudo "$ssl_manager" obtain "$domain" "$email" "$server_ip" >> "$LOG_FILE" 2>&1; then
        success "SSL certificate obtained successfully!"

        # Restart nginx to pick up new certificate
        # Registry-first v9.0: entrypoint automatically detects SSL cert and uses HTTPS template
        if ! compose_cmd ps -q nginx >/dev/null 2>&1; then
            info "Starting nginx..."
            compose_cmd start nginx >> "$LOG_FILE" 2>&1 || true
            wait_for_service nginx 60
        else
            info "Restarting nginx to pick up new SSL certificate..."
            compose_cmd restart nginx >> "$LOG_FILE" 2>&1 || true
            wait_for_service nginx 60
        fi

        success "SSL certificate setup completed!"
        info "Nginx will automatically use HTTPS configuration (docker-entrypoint.sh)"
    else
        error "Failed to obtain SSL certificate. Check $LOG_FILE for details."
    fi
}

# =============================================================================
# SSL CERTIFICATE VERIFICATION
# =============================================================================

# Verify SSL certificate
verify_ssl() {
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    local ssl_type="${SSL_TYPE:-none}"
    local domain="${DOMAIN:-localhost}"

    if [[ "$ssl_type" != "letsencrypt" || "$domain" == "localhost" ]]; then
        return 0
    fi

    step "Verifying SSL certificate..."

    # Check certificate file exists (now on host system)
    local cert_path="/etc/letsencrypt/live/$domain/fullchain.pem"
    if [[ ! -f "$cert_path" ]]; then
        warning "Certificate file not found: $cert_path"
        return 0
    fi

    # Check certificate expiry
    if command_exists openssl; then
        local expiry_date
        expiry_date=$(openssl x509 -enddate -noout -in "$cert_path" | cut -d= -f2)
        info "Certificate expires: $expiry_date"
    fi

    # Test HTTPS connectivity
    info "Testing HTTPS connectivity..."
    if command_exists curl; then
        if curl -Is --max-time 10 "https://$domain/health" >/dev/null 2>&1; then
            success "HTTPS is working correctly!"
            info "URL: https://$domain"
            # Set global variable for close_http_port() function
            export HTTPS_WORKING="true"
        else
            warning "HTTPS test failed. Certificate may need time to propagate."
            info "Try accessing: https://$domain in a few minutes"
            # Set global variable for close_http_port() function
            export HTTPS_WORKING="false"
        fi
    else
        info "curl not available - skipping HTTPS test"
        # Cannot verify, assume HTTPS not working
        export HTTPS_WORKING="false"
    fi
}
