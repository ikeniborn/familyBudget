#!/bin/bash
#
# nginx.sh - Nginx Configuration Management
#
# This module manages Nginx configuration generation and lifecycle.
# Replaces old sed-based marker manipulation with clean template-based approach.
#
# Usage:
#   source scripts/lib/config.sh
#   source scripts/lib/utils.sh
#   source scripts/lib/nginx.sh
#
# Dependencies:
#   - config.sh (for DEPLOY_DIR)
#   - utils.sh (for logging functions)
#

# =============================================================================
# CONFIGURATION PATHS
# =============================================================================

NGINX_CONF_DIR="$DEPLOY_DIR/nginx/conf.d"
NGINX_HTTP_TEMPLATE="$NGINX_CONF_DIR/app-http.conf.template"
NGINX_HTTPS_TEMPLATE="$NGINX_CONF_DIR/app-https.conf.template"
NGINX_ACTIVE_CONFIG="$NGINX_CONF_DIR/app.conf"

# =============================================================================
# SSL STATE DETECTION
# =============================================================================

# Check if SSL certificate exists for domain
# Usage: check_nginx_ssl_state "example.com"
# Returns: 0 if cert exists, 1 if not
# Exports: NGINX_SSL_AVAILABLE (true/false)
check_nginx_ssl_state() {
    local domain=$1

    if [[ -z "$domain" ]]; then
        error_return "check_nginx_ssl_state: domain parameter required"
        return 1
    fi

    local cert_path="/etc/letsencrypt/live/$domain/fullchain.pem"

    if [[ -f "$cert_path" ]]; then
        export NGINX_SSL_AVAILABLE=true
        info "SSL certificate detected for $domain"
        return 0
    else
        export NGINX_SSL_AVAILABLE=false
        info "No SSL certificate found for $domain"
        return 1
    fi
}

# =============================================================================
# CONFIGURATION GENERATION
# =============================================================================

# Generate HTTP-only configuration (for initial setup and certbot)
# Usage: generate_nginx_http_config "example.com"
# Creates: app.conf from app-http.conf.template
generate_nginx_http_config() {
    local domain=$1

    if [[ -z "$domain" ]]; then
        error_return "generate_nginx_http_config: domain parameter required"
        return 1
    fi

    if [[ ! -f "$NGINX_HTTP_TEMPLATE" ]]; then
        error_return "HTTP template not found: $NGINX_HTTP_TEMPLATE"
        return 1
    fi

    info "Generating HTTP-only nginx configuration for $domain"

    # Create config from template
    cp "$NGINX_HTTP_TEMPLATE" "$NGINX_ACTIVE_CONFIG" || {
        error_return "Failed to copy HTTP template"
        return 1
    }

    # Replace domain placeholder
    sed -i "s/{{DOMAIN}}/$domain/g" "$NGINX_ACTIVE_CONFIG" || {
        error_return "Failed to replace domain in HTTP config"
        return 1
    }

    success "HTTP configuration generated: $NGINX_ACTIVE_CONFIG"
    return 0
}

# Generate HTTPS configuration (final production config)
# Usage: generate_nginx_https_config "example.com"
# Creates: app.conf from app-https.conf.template
generate_nginx_https_config() {
    local domain=$1

    if [[ -z "$domain" ]]; then
        error_return "generate_nginx_https_config: domain parameter required"
        return 1
    fi

    if [[ ! -f "$NGINX_HTTPS_TEMPLATE" ]]; then
        error_return "HTTPS template not found: $NGINX_HTTPS_TEMPLATE"
        return 1
    fi

    # Verify SSL certificate exists
    local cert_path="/etc/letsencrypt/live/$domain/fullchain.pem"
    if [[ ! -f "$cert_path" ]]; then
        error_return "SSL certificate not found: $cert_path"
        error_return "Cannot generate HTTPS config without certificate"
        return 1
    fi

    info "Generating HTTPS nginx configuration for $domain"

    # Backup existing config if it exists
    if [[ -f "$NGINX_ACTIVE_CONFIG" ]]; then
        local backup_file="$NGINX_ACTIVE_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$NGINX_ACTIVE_CONFIG" "$backup_file"
        info "Backed up existing config to: $backup_file"
    fi

    # Create config from template
    cp "$NGINX_HTTPS_TEMPLATE" "$NGINX_ACTIVE_CONFIG" || {
        error_return "Failed to copy HTTPS template"
        return 1
    }

    # Replace domain placeholder
    sed -i "s/{{DOMAIN}}/$domain/g" "$NGINX_ACTIVE_CONFIG" || {
        error_return "Failed to replace domain in HTTPS config"
        return 1
    }

    success "HTTPS configuration generated: $NGINX_ACTIVE_CONFIG"
    return 0
}

# =============================================================================
# SMART CONFIGURATION SELECTION
# =============================================================================

# Select and generate appropriate nginx configuration based on SSL state
# Usage: select_nginx_config "example.com"
# Logic:
#   - If SSL cert exists AND config already HTTPS → skip (no changes)
#   - If SSL cert exists AND config is HTTP → upgrade to HTTPS
#   - If no SSL cert → generate HTTP config
select_nginx_config() {
    local domain=$1

    if [[ -z "$domain" ]]; then
        error_return "select_nginx_config: domain parameter required"
        return 1
    fi

    step "Selecting nginx configuration for $domain"

    # Check SSL state
    check_nginx_ssl_state "$domain"
    local has_ssl=$?

    # Determine current config type (if exists)
    local current_config_type="none"
    if [[ -f "$NGINX_ACTIVE_CONFIG" ]]; then
        if grep -q "listen 443 ssl" "$NGINX_ACTIVE_CONFIG" && ! grep -q "^#.*listen 443 ssl" "$NGINX_ACTIVE_CONFIG"; then
            current_config_type="https"
        else
            current_config_type="http"
        fi
    fi

    info "Current config type: $current_config_type"
    info "SSL available: $NGINX_SSL_AVAILABLE"

    # Decision logic
    if [[ "$NGINX_SSL_AVAILABLE" == "true" ]]; then
        if [[ "$current_config_type" == "https" ]]; then
            # Verify domain matches
            local current_domain
            current_domain=$(grep "server_name" "$NGINX_ACTIVE_CONFIG" | grep -v "^#" | head -1 | awk '{print $2}' | tr -d ';')

            if [[ "$current_domain" == "$domain" ]]; then
                success "HTTPS configuration already active for $domain - no changes needed"
                return 0
            else
                warning "Domain changed ($current_domain → $domain)"
                info "Regenerating HTTPS configuration"
                generate_nginx_https_config "$domain"
                return $?
            fi
        else
            info "Upgrading from HTTP to HTTPS configuration"
            generate_nginx_https_config "$domain"
            return $?
        fi
    else
        # No SSL - use HTTP config
        if [[ "$current_config_type" == "http" ]]; then
            # Verify domain matches
            local current_domain
            current_domain=$(grep "server_name" "$NGINX_ACTIVE_CONFIG" | grep -v "^#" | head -1 | awk '{print $2}' | tr -d ';')

            if [[ "$current_domain" == "$domain" ]]; then
                success "HTTP configuration already active for $domain - no changes needed"
                return 0
            else
                warning "Domain changed ($current_domain → $domain)"
                info "Regenerating HTTP configuration"
                generate_nginx_http_config "$domain"
                return $?
            fi
        else
            info "Generating initial HTTP configuration"
            generate_nginx_http_config "$domain"
            return $?
        fi
    fi
}

# =============================================================================
# CONFIGURATION VALIDATION
# =============================================================================

# Validate nginx configuration syntax
# Usage: validate_nginx_config
# Returns: 0 if valid, 1 if invalid
validate_nginx_config() {
    info "Validating nginx configuration syntax"

    # Check if nginx container is running
    if ! docker ps --format "{{.Names}}" 2>/dev/null | grep -q "^familybudget-nginx$"; then
        warning "Nginx container not running - skipping validation"
        info "Validation will occur when container starts"
        return 0
    fi

    # Test configuration
    if docker exec familybudget-nginx nginx -t 2>&1 | tee -a "$LOG_FILE"; then
        success "Nginx configuration is valid"
        return 0
    else
        error_return "Nginx configuration validation failed"
        error_return "Check syntax in: $NGINX_ACTIVE_CONFIG"
        return 1
    fi
}

# =============================================================================
# NGINX SERVICE MANAGEMENT
# =============================================================================

# Reload nginx configuration (without restart)
# Usage: reload_nginx
# Returns: 0 if success, 1 if failure
reload_nginx() {
    info "Reloading nginx configuration"

    # Check if nginx container is running
    if ! docker ps --format "{{.Names}}" 2>/dev/null | grep -q "^familybudget-nginx$"; then
        warning "Nginx container not running - cannot reload"
        info "Configuration will be applied when container starts"
        return 0
    fi

    # Reload configuration
    if docker exec familybudget-nginx nginx -s reload 2>&1 | tee -a "$LOG_FILE"; then
        success "Nginx configuration reloaded successfully"
        return 0
    else
        error_return "Failed to reload nginx configuration"
        return 1
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f check_nginx_ssl_state
export -f generate_nginx_http_config
export -f generate_nginx_https_config
export -f select_nginx_config
export -f validate_nginx_config
export -f reload_nginx
