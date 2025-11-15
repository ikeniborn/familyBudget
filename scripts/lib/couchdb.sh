#!/bin/bash
#
# scripts/lib/couchdb.sh - CouchDB Notes management functions
#
# This module handles CouchDB-related deployment operations:
# - SSL certificate setup for notes subdomain
# - Nginx configuration for CouchDB reverse proxy
# - CouchDB health verification
# - Backup cron job setup
# - CouchDB initialization
#
# Dependencies: config.sh, utils.sh, ssl.sh
#
# Usage:
#   source scripts/lib/couchdb.sh
#   setup_couchdb_deployment
#
# Part of CouchDB Notes integration (isolated document storage)
#

# =============================================================================
# COUCHDB HEALTH CHECK
# =============================================================================

verify_couchdb_health() {
    info "Verifying CouchDB health..."

    # Source .env
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    # Check if CouchDB is enabled
    if [[ "${ENABLE_COUCHDB:-n}" != "y" ]]; then
        info "CouchDB is not enabled (ENABLE_COUCHDB != y)"
        return 0
    fi

    # Wait for CouchDB to be healthy
    local max_attempts=30
    local attempt=0
    local couchdb_url="http://localhost:5984/_up"

    info "Waiting for CouchDB to be healthy (max ${max_attempts} attempts)..."

    while [[ $attempt -lt $max_attempts ]]; do
        if curl -sf "$couchdb_url" >/dev/null 2>&1; then
            success "CouchDB is healthy"
            return 0
        fi

        ((attempt++))
        sleep 2
        echo -n "."
    done

    echo ""
    error "CouchDB health check failed after ${max_attempts} attempts"
    info "Troubleshooting:"
    info "  1. Check container status: docker ps | grep couchdb"
    info "  2. Check container logs: docker logs familybudget-couchdb"
    info "  3. Verify port 5984 is accessible: curl http://localhost:5984/_up"
    return 1
}

# =============================================================================
# COUCHDB SSL SETUP
# =============================================================================

setup_couchdb_ssl() {
    info "Setting up SSL for CouchDB Notes..."

    # Source .env
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    # Check if CouchDB is enabled
    if [[ "${ENABLE_COUCHDB:-n}" != "y" ]]; then
        info "CouchDB is not enabled - skipping SSL setup"
        return 0
    fi

    local notes_domain="${NOTES_DOMAIN:-notes.localhost}"
    local letsencrypt_email="${LETSENCRYPT_EMAIL:-}"

    # Skip if domain is localhost
    if [[ "$notes_domain" == "notes.localhost" ]]; then
        info "Notes domain is localhost - skipping SSL setup (HTTP only)"
        return 0
    fi

    # Validate Let's Encrypt email
    if [[ -z "$letsencrypt_email" ]]; then
        error "LETSENCRYPT_EMAIL is required for SSL certificate"
        info "Please set LETSENCRYPT_EMAIL in .env file"
        return 1
    fi

    step "Requesting SSL certificate for $notes_domain..."

    # Check if certbot is installed
    if ! command -v certbot >/dev/null 2>&1; then
        error "certbot is not installed"
        info "Install certbot: sudo apt-get install certbot python3-certbot-nginx"
        return 1
    fi

    # Check if certificate already exists
    if sudo test -d "/etc/letsencrypt/live/$notes_domain"; then
        info "SSL certificate already exists for $notes_domain"
        success "Certificate found: /etc/letsencrypt/live/$notes_domain"
    else
        # Request new certificate
        info "Requesting new SSL certificate from Let's Encrypt..."
        info "Domain: $notes_domain"
        info "Email: $letsencrypt_email"

        if sudo certbot certonly \
            --nginx \
            --non-interactive \
            --agree-tos \
            --email "$letsencrypt_email" \
            -d "$notes_domain" 2>&1 | tee -a "$LOG_FILE"; then
            success "SSL certificate obtained successfully"
        else
            error "Failed to obtain SSL certificate"
            info "Troubleshooting:"
            info "  1. Ensure DNS is configured: $notes_domain → server IP"
            info "  2. Ensure port 80/443 are accessible"
            info "  3. Check nginx is running: sudo systemctl status nginx"
            return 1
        fi
    fi

    # Update nginx configuration to use HTTPS
    update_nginx_for_couchdb_https

    success "CouchDB SSL setup completed for $notes_domain"
}

# =============================================================================
# NGINX CONFIGURATION FOR COUCHDB
# =============================================================================

update_nginx_for_couchdb_https() {
    local nginx_conf="$DEPLOY_DIR/nginx/conf.d/notes.conf"

    if [[ ! -f "$nginx_conf" ]]; then
        warning "Nginx notes config not found: $nginx_conf"
        return 1
    fi

    info "Updating nginx configuration for HTTPS..."

    # Generate notes.conf from template
    generate_nginx_notes_config

    # Uncomment SSL_HTTPS sections
    sed -i 's/^# SSL_HTTPS //' "$nginx_conf"

    # Comment SSL_HTTP_INITIAL sections
    sed -i 's/^\(# SSL_HTTP_INITIAL \)/# \1/' "$nginx_conf"

    # Uncomment SSL_REDIRECT section
    sed -i 's/^# SSL_REDIRECT //' "$nginx_conf"

    success "Nginx configuration updated for HTTPS"

    # Test nginx configuration
    if sudo nginx -t >/dev/null 2>&1; then
        success "Nginx configuration is valid"

        # Reload nginx
        info "Reloading nginx..."
        if sudo systemctl reload nginx; then
            success "Nginx reloaded successfully"
        else
            error "Failed to reload nginx"
            return 1
        fi
    else
        error "Nginx configuration test failed"
        info "Please check: sudo nginx -t"
        return 1
    fi
}

generate_nginx_notes_config() {
    local template="$DEPLOY_DIR/nginx/conf.d/notes.conf.template"
    local output="$DEPLOY_DIR/nginx/conf.d/notes.conf"

    if [[ ! -f "$template" ]]; then
        warning "Nginx notes template not found: $template"
        return 1
    fi

    # Source .env
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    local notes_domain="${NOTES_DOMAIN:-notes.localhost}"

    info "Generating nginx notes configuration..."
    info "Template: $template"
    info "Output: $output"
    info "Domain: $notes_domain"

    # Replace {{NOTES_DOMAIN}} with actual domain
    sed "s/{{NOTES_DOMAIN}}/$notes_domain/g" "$template" > "$output"

    success "Nginx notes configuration generated"
}

# =============================================================================
# COUCHDB BACKUP SETUP
# =============================================================================

setup_couchdb_backup_cron() {
    info "Setting up CouchDB backup cron job..."

    # Source .env
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    # Check if CouchDB is enabled
    if [[ "${ENABLE_COUCHDB:-n}" != "y" ]]; then
        info "CouchDB is not enabled - skipping backup cron setup"
        return 0
    fi

    local backup_script="$DEPLOY_DIR/notes/couchdb-backup.sh"

    # Check if backup script exists
    if [[ ! -f "$backup_script" ]]; then
        warning "CouchDB backup script not found: $backup_script"
        info "Backup cron job will NOT be created"
        return 0
    fi

    # Make backup script executable
    chmod +x "$backup_script"

    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "couchdb-backup.sh"; then
        info "CouchDB backup cron job already exists"
        return 0
    fi

    # Add cron job (daily at 3 AM)
    local cron_cmd="0 3 * * * cd $DEPLOY_DIR && bash notes/couchdb-backup.sh >> /opt/notes/logs/backup.log 2>&1"

    info "Adding CouchDB backup cron job (daily at 3 AM)..."
    (crontab -l 2>/dev/null; echo "$cron_cmd") | crontab -

    success "CouchDB backup cron job added"
    info "Schedule: Daily at 3:00 AM"
    info "Log file: /opt/notes/logs/backup.log"
}

# =============================================================================
# COUCHDB DEPLOYMENT MAIN FUNCTION
# =============================================================================

setup_couchdb_deployment() {
    section "CouchDB Notes Deployment"

    # Source .env
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    # Check if CouchDB is enabled
    if [[ "${ENABLE_COUCHDB:-n}" != "y" ]]; then
        info "CouchDB is not enabled (ENABLE_COUCHDB != y)"
        info "To enable: set ENABLE_COUCHDB=y in .env and run setup.sh"
        return 0
    fi

    info "CouchDB Notes is enabled"
    echo ""

    # 1. Sync local.ini configuration
    step "Syncing CouchDB configuration..."
    if [[ -f "$REPO_DIR/notes/local.ini" ]]; then
        cp "$REPO_DIR/notes/local.ini" /opt/notes/local.ini || warning "Failed to copy local.ini"
        success "CouchDB configuration synced"
    else
        warning "CouchDB local.ini not found in repository"
    fi
    echo ""

    # 2. Verify CouchDB health
    verify_couchdb_health || return 1
    echo ""

    # 3. Generate nginx configuration
    step "Generating nginx configuration..."
    generate_nginx_notes_config
    echo ""

    # 4. Setup SSL if needed
    setup_couchdb_ssl
    echo ""

    # 5. Setup backup cron job
    setup_couchdb_backup_cron
    echo ""

    success "CouchDB Notes deployment completed"
    info "Access: https://${NOTES_DOMAIN:-notes.localhost}"
    echo ""
}
