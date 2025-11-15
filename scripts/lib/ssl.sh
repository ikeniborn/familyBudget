#!/bin/bash
#
# scripts/lib/ssl.sh - SSL certificate management functions
#
# This module handles SSL-related operations:
# - SSL marker cleanup in nginx configuration
# - Let's Encrypt certificate setup (via host certbot)
# - Nginx HTTPS configuration updates
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
#

# =============================================================================
# SSL MARKER CLEANUP
# =============================================================================

cleanup_nginx_markers() {
    local nginx_conf="$DEPLOY_DIR/nginx/conf.d/app.conf"

    # Check if nginx config exists
    if [[ ! -f "$nginx_conf" ]]; then
        # No config yet, nothing to clean
        return 0
    fi

    # Check if file contains old markers (from previous deployments)
    if grep -q "^SSL_HTTPS_START$\|^SSL_HTTPS_END$\|^SSL_REDIRECT_START$\|^SSL_REDIRECT_END$" "$nginx_conf"; then
        info "Detected old SSL markers in nginx config, cleaning up..."

        # Remove marker lines (they should have been removed by update_nginx_for_https)
        sed -i '/^SSL_HTTPS_START$/d' "$nginx_conf"
        sed -i '/^SSL_HTTPS_END$/d' "$nginx_conf"
        sed -i '/^SSL_REDIRECT_START$/d' "$nginx_conf"
        sed -i '/^SSL_REDIRECT_END$/d' "$nginx_conf"

        success "Old SSL markers removed from nginx config"
        info "Configuration file: $nginx_conf"
    fi
}

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

            # Update nginx configuration to enable HTTPS if not already done
            update_nginx_for_https "$domain"

            # Reload nginx to pick up certificates
            if compose_cmd ps -q nginx >/dev/null 2>&1; then
                info "Reloading nginx with certificates..."
                if compose_cmd exec nginx nginx -s reload >> "$LOG_FILE" 2>&1; then
                    success "Nginx reloaded successfully"
                else
                    warning "Failed to reload nginx"
                fi
            fi

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

        # Update nginx configuration to enable HTTPS
        update_nginx_for_https "$domain"

        # Start nginx if not running (may have been stopped by ssl_certificate_manager)
        if ! compose_cmd ps -q nginx >/dev/null 2>&1; then
            info "Starting nginx..."
            compose_cmd start nginx >> "$LOG_FILE" 2>&1 || true
            sleep 3
        fi

        # Reload nginx with new configuration
        info "Reloading nginx with new configuration..."
        if compose_cmd exec nginx nginx -s reload >> "$LOG_FILE" 2>&1; then
            success "Nginx reloaded successfully"
        else
            warning "Failed to reload nginx. Restarting..."
            compose_cmd restart nginx >> "$LOG_FILE" 2>&1 || true
        fi

        success "SSL certificate setup completed!"
    else
        error "Failed to obtain SSL certificate. Check $LOG_FILE for details."
    fi
}

# Update nginx configuration to enable HTTPS
update_nginx_for_https() {
    local domain=$1
    local nginx_conf="$DEPLOY_DIR/nginx/conf.d/app.conf"

    if [[ ! -f "$nginx_conf" ]]; then
        error "Nginx configuration not found: $nginx_conf"
    fi

    info "Updating nginx configuration to enable HTTPS..."

    # Create backup before modification
    cp "$nginx_conf" "$nginx_conf.backup" || true

    # Check if markers exist
    if ! grep -q "SSL_HTTPS_START" "$nginx_conf"; then
        info "SSL markers not found - SSL configuration already applied (skipping)"
        success "Nginx SSL configuration is up to date"
        return 0
    fi

    info "Processing nginx configuration using SSL markers..."

    # Uncomment HTTPS block (between SSL_HTTPS_START and SSL_HTTPS_END)
    # This removes "# " from the beginning of lines, but preserves "# #" comments
    sed -i '/^# SSL_HTTPS_START$/,/^# SSL_HTTPS_END$/{
        /^# SSL_HTTPS_START$/d
        /^# SSL_HTTPS_END$/d
        s/^# \(.*\)/\1/
    }' "$nginx_conf"

    # Uncomment HTTP redirect block (between SSL_REDIRECT_START and SSL_REDIRECT_END)
    sed -i '/^# SSL_REDIRECT_START$/,/^# SSL_REDIRECT_END$/{
        /^# SSL_REDIRECT_START$/d
        /^# SSL_REDIRECT_END$/d
        s/^# \(.*\)/\1/
    }' "$nginx_conf"

    # Comment out initial HTTP block (between SSL_HTTP_INITIAL_START and SSL_HTTP_INITIAL_END)
    # to prevent conflicting server names after enabling SSL redirect
    sed -i '/^# SSL_HTTP_INITIAL_START$/,/^# SSL_HTTP_INITIAL_END$/{
        /^# SSL_HTTP_INITIAL_START$/d
        /^# SSL_HTTP_INITIAL_END$/d
        s/^\([^#]\)/# \1/
    }' "$nginx_conf"

    # Verify the result is not empty
    if [[ ! -s "$nginx_conf" ]]; then
        error "Nginx configuration became empty after processing"
        mv "$nginx_conf.backup" "$nginx_conf" 2>/dev/null || true
        return 1
    fi

    # Validate nginx configuration (if container is running)
    if compose_cmd ps -q nginx >/dev/null 2>&1 && compose_cmd ps nginx | grep -q "Up"; then
        info "Validating nginx configuration..."
        if compose_cmd exec nginx nginx -t >> "$LOG_FILE" 2>&1; then
            success "Nginx configuration is valid"
            # Remove backup on success
            rm -f "$nginx_conf.backup"
        else
            error "Nginx configuration is invalid after update"
            warning "Restoring previous configuration..."
            mv "$nginx_conf.backup" "$nginx_conf" 2>/dev/null || true
            error "Configuration validation failed. Check $LOG_FILE for details."
        fi
    else
        info "Nginx container not running, skipping validation (will be validated on start)"
        # Still remove backup
        rm -f "$nginx_conf.backup"
    fi

    success "Nginx configuration updated for HTTPS"
    info "Configuration file: $nginx_conf"
}

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
