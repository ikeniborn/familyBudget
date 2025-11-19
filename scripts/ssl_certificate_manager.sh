#!/bin/bash
#==============================================================================
# SSL Certificate Manager for Family Budget
# Based on VLESS v4.2 implementation
#
# This script manages Let's Encrypt SSL certificates using certbot on the host
# system (NOT in Docker container) for better reliability and simplicity.
#
# Features:
# - DNS validation before certificate acquisition
# - Automatic UFW firewall management (port 80)
# - Standalone mode (HTTP-01 challenge)
# - Certificate validation and expiry checking
# - Auto-renewal setup with cron
# - Deploy hook for nginx reload
#
# Version: 1.0.0
# Author: Family Budget Team
# Date: 2025-10-17
#==============================================================================

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly LETSENCRYPT_DIR="/etc/letsencrypt/live"
readonly CERTBOT_LOG="/var/log/letsencrypt/letsencrypt.log"
readonly DEPLOY_HOOK="/usr/local/bin/familybudget-cert-renew"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Renewal thresholds (days)
readonly AUTO_RENEW_THRESHOLD=30
readonly WARNING_THRESHOLD=14
readonly CRITICAL_THRESHOLD=7

#==============================================================================
# LOGGING
#==============================================================================

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" >&2
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${YELLOW}WARNING:${NC} $*" >&2
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${RED}ERROR:${NC} $*" >&2
}

log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${BLUE}INFO:${NC} $*" >&2
}

#==============================================================================
# DNS VALIDATION
#==============================================================================

validate_domain_dns() {
    local domain="$1"
    local server_ip="$2"

    log "Validating DNS for domain: $domain"
    log_info "Expected IP: $server_ip"

    # Check if dig is available
    if ! command -v dig &> /dev/null; then
        log_warn "dig command not found, installing dnsutils..."
        sudo apt update -qq
        sudo apt install -y dnsutils
    fi

    # Get DNS A record
    local dns_ip
    dns_ip=$(dig +short "$domain" A | head -1)

    # Check if domain resolves
    if [ -z "$dns_ip" ]; then
        log_error "DNS resolution failed for $domain"
        log_info "No DNS A record found"
        log_info "FIX: Configure DNS A record to point to $server_ip"
        return 1
    fi

    # Check if DNS points to server
    if [ "$dns_ip" != "$server_ip" ]; then
        log_error "DNS mismatch!"
        log_info "Domain: $domain"
        log_info "Resolves to: $dns_ip"
        log_info "Expected: $server_ip"
        log_info "FIX: Update DNS A record to point to $server_ip"
        return 1
    fi

    log "✅ DNS validation successful"
    log_info "Domain: $domain → $dns_ip ✓"
    return 0
}

#==============================================================================
# CERTBOT INSTALLATION
#==============================================================================

install_certbot() {
    log "Checking certbot installation..."

    # Check if already installed
    if command -v certbot &> /dev/null; then
        local version
        version=$(certbot --version 2>&1 | head -1)
        log "✅ Certbot already installed: $version"
        return 0
    fi

    log "Installing certbot..."

    sudo apt update -qq || {
        log_error "apt update failed"
        return 1
    }

    sudo apt install -y certbot || {
        log_error "Certbot installation failed"
        return 1
    }

    # Verify installation
    if ! command -v certbot &> /dev/null; then
        log_error "Certbot verification failed"
        return 1
    fi

    local version
    version=$(certbot --version 2>&1 | head -1)
    log "✅ Certbot installed successfully: $version"
    return 0
}

#==============================================================================
# FIREWALL MANAGEMENT
#==============================================================================

open_port_80() {
    log "Opening UFW port 80 for ACME HTTP-01 challenge..."

    sudo ufw allow 80/tcp comment 'ACME HTTP-01 Challenge (temporary)' || {
        log_error "Failed to open UFW port 80"
        return 1
    }

    log "✅ Port 80 opened"
    return 0
}

close_port_80() {
    log "Closing UFW port 80..."

    sudo ufw delete allow 80/tcp 2>/dev/null || {
        log_warn "Failed to remove UFW rule for port 80 (may not exist)"
    }

    log "✅ Port 80 closed"
    return 0
}

#==============================================================================
# CERTIFICATE OPERATIONS
#==============================================================================

obtain_certificate() {
    local domain="$1"
    local email="$2"
    local force="${3:-false}"

    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "SSL Certificate Acquisition"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "Domain: $domain"
    log_info "Email: $email"
    log_info "Method: Standalone (HTTP-01 challenge)"

    # Validate parameters
    if [[ -z "$domain" || -z "$email" ]]; then
        log_error "Missing required parameters"
        log_info "Usage: obtain_certificate <domain> <email>"
        return 1
    fi

    # Check if certificate already exists
    if [ -d "${LETSENCRYPT_DIR}/${domain}" ] && [ "$force" != "true" ]; then
        log "Certificate already exists for $domain"
        log_info "Use --force-renewal to renew existing certificate"

        # Show expiry info
        if validate_certificate "$domain"; then
            return 0
        else
            log_warn "Certificate validation failed, will obtain new certificate"
        fi
    fi

    # Temporarily open port 80
    if ! open_port_80; then
        return 1
    fi

    # Stop nginx temporarily (if running in Docker)
    local nginx_was_running=false
    if docker ps --format '{{.Names}}' | grep -q "familybudget-nginx"; then
        log_info "Stopping nginx container temporarily..."
        docker compose -f "$PROJECT_ROOT/docker-compose.yml" stop nginx || true
        nginx_was_running=true
        sleep 2
    fi

    # Run certbot in standalone mode
    log "Running certbot (this may take 30-60 seconds)..."

    local certbot_args=(
        certonly
        --standalone
        --non-interactive
        --agree-tos
        --email "$email"
        --domain "$domain"
        --preferred-challenges http
    )

    if [ "$force" == "true" ]; then
        certbot_args+=(--force-renewal)
    fi

    if sudo certbot "${certbot_args[@]}" 2>&1 | tee -a "$CERTBOT_LOG"; then
        log "✅ Certificate obtained successfully!"

        # Secure permissions
        sudo chmod 600 "${LETSENCRYPT_DIR}/${domain}/privkey.pem" 2>/dev/null || true
        sudo chmod 644 "${LETSENCRYPT_DIR}/${domain}/fullchain.pem" 2>/dev/null || true

        # Show certificate info
        show_certificate_info "$domain"

        # Close port 80
        close_port_80

        # Restart nginx if it was running
        if [ "$nginx_was_running" == "true" ]; then
            log_info "Restarting nginx container..."
            docker compose -f "$PROJECT_ROOT/docker-compose.yml" start nginx || true
            sleep 2

            # Reload nginx configuration
            docker exec familybudget-nginx nginx -s reload 2>/dev/null || true
        fi

        log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        return 0
    else
        log_error "Certificate acquisition failed!"
        log_info "Check logs: sudo tail -f $CERTBOT_LOG"

        # Cleanup
        close_port_80

        # Restart nginx if it was running
        if [ "$nginx_was_running" == "true" ]; then
            docker compose -f "$PROJECT_ROOT/docker-compose.yml" start nginx || true
        fi

        return 1
    fi
}

renew_certificate() {
    local domain="$1"

    log "Renewing certificate for: $domain"

    if [ ! -d "${LETSENCRYPT_DIR}/${domain}" ]; then
        log_error "Certificate not found for domain: $domain"
        return 1
    fi

    # Use obtain_certificate with force flag
    obtain_certificate "$domain" "$(get_cert_email "$domain")" "true"
}

validate_certificate() {
    local domain="$1"

    local cert_dir="${LETSENCRYPT_DIR}/${domain}"

    if [ ! -d "$cert_dir" ]; then
        log_error "Certificate directory not found: $cert_dir"
        return 1
    fi

    # Check required files
    local required_files=("fullchain.pem" "privkey.pem" "cert.pem" "chain.pem")
    for file in "${required_files[@]}"; do
        if [ ! -f "${cert_dir}/${file}" ]; then
            log_error "Missing certificate file: ${cert_dir}/${file}"
            return 1
        fi
    done

    # Check certificate expiration
    local expiry_date
    expiry_date=$(sudo openssl x509 -enddate -noout -in "${cert_dir}/fullchain.pem" | cut -d= -f2)

    if [[ -z "$expiry_date" ]]; then
        log_error "Failed to extract expiry date from certificate"
        return 1
    fi

    local expiry_epoch
    expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch
    current_epoch=$(date +%s)
    local days_left=$(( (expiry_epoch - current_epoch) / 86400 ))

    log_info "Certificate expiry: $expiry_date ($days_left days left)"

    if [ "$days_left" -lt 0 ]; then
        log_error "Certificate has expired!"
        return 1
    fi

    if [ "$days_left" -lt "$CRITICAL_THRESHOLD" ]; then
        log_warn "Certificate expires in less than $CRITICAL_THRESHOLD days!"
    elif [ "$days_left" -lt "$WARNING_THRESHOLD" ]; then
        log_warn "Certificate expires in less than $WARNING_THRESHOLD days"
    fi

    log "✅ Certificate is valid"
    return 0
}

show_certificate_info() {
    local domain="$1"
    local cert_path="${LETSENCRYPT_DIR}/${domain}"

    if [ ! -d "$cert_path" ]; then
        log_error "Certificate not found: $cert_path"
        return 1
    fi

    log_info "Certificate location: $cert_path"
    log_info "Files:"
    ls -lh "$cert_path" 2>/dev/null | grep -E "(fullchain|privkey|cert|chain)\.pem" | awk '{print "  " $9 " (" $5 ")"}' || true

    # Show expiry date
    local expiry
    expiry=$(sudo openssl x509 -in "$cert_path/cert.pem" -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$expiry" ]; then
        log_info "Expires: $expiry"
    fi

    # Show days left
    local expiry_epoch
    expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null)
    local current_epoch
    current_epoch=$(date +%s)
    local days_left=$(( (expiry_epoch - current_epoch) / 86400 ))
    log_info "Days until expiry: $days_left"
}

get_cert_email() {
    local domain="$1"

    # Try to extract email from renewal config
    local renewal_conf="/etc/letsencrypt/renewal/${domain}.conf"
    if [ -f "$renewal_conf" ]; then
        grep "^email" "$renewal_conf" | cut -d= -f2 | tr -d ' ' || echo "admin@localhost"
    else
        echo "admin@localhost"
    fi
}

#==============================================================================
# AUTO-RENEWAL SETUP
#==============================================================================

setup_auto_renewal() {
    log "Setting up automatic certificate renewal..."

    # Create deploy hook script
    create_deploy_hook

    # Create cron job
    local cron_file="/etc/cron.d/familybudget-certbot-renew"

    log_info "Creating cron job: $cron_file"

    sudo tee "$cron_file" > /dev/null <<'EOF'
# Auto-renewal for Family Budget Let's Encrypt certificates
# Runs twice daily at midnight and noon (UTC)
# Certbot checks if renewal is needed (< 30 days until expiry)

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Twice daily renewal check
0 0,12 * * * root certbot renew --quiet --deploy-hook "/usr/local/bin/familybudget-cert-renew" >> /var/log/letsencrypt/certbot-renew.log 2>&1
EOF

    sudo chmod 644 "$cron_file"

    log "✅ Auto-renewal configured"
    log_info "Schedule: Twice daily (00:00 and 12:00 UTC)"
    log_info "Cron file: $cron_file"
    log_info "Deploy hook: $DEPLOY_HOOK"
    log_info "Log file: /var/log/letsencrypt/certbot-renew.log"

    return 0
}

create_deploy_hook() {
    log_info "Creating deploy hook script: $DEPLOY_HOOK"

    sudo tee "$DEPLOY_HOOK" > /dev/null <<'EOF'
#!/bin/bash
# Family Budget Certificate Renewal Deploy Hook
# Called by certbot after successful certificate renewal
# Reloads nginx to pick up new certificates and ensures port 80 is closed

LOG_FILE="/var/log/letsencrypt/deploy-hook.log"

echo "[$(date)] Certificate renewed for: $RENEWED_DOMAINS" >> "$LOG_FILE"

# SECURITY: Close port 80 after renewal (certbot may have opened it)
echo "[$(date)] Checking port 80 status..." >> "$LOG_FILE"
if command -v ufw &> /dev/null; then
    if sudo ufw status | grep -q "80/tcp.*ALLOW"; then
        echo "[$(date)] Port 80 is open, closing for security..." >> "$LOG_FILE"
        if sudo ufw delete allow 80/tcp 2>> "$LOG_FILE"; then
            echo "[$(date)] ✅ Port 80 closed" >> "$LOG_FILE"
        else
            echo "[$(date)] ⚠ Failed to close port 80" >> "$LOG_FILE"
        fi
    else
        echo "[$(date)] ✅ Port 80 already closed" >> "$LOG_FILE"
    fi
else
    echo "[$(date)] ⚠ UFW not available, skipping port 80 check" >> "$LOG_FILE"
fi

# Reload nginx inside Docker container
if docker ps --format '{{.Names}}' | grep -q "familybudget-nginx"; then
    echo "[$(date)] Reloading nginx..." >> "$LOG_FILE"

    if docker exec familybudget-nginx nginx -s reload 2>&1 >> "$LOG_FILE"; then
        echo "[$(date)] ✅ Nginx reloaded successfully" >> "$LOG_FILE"
        exit 0
    else
        echo "[$(date)] ❌ Failed to reload nginx" >> "$LOG_FILE"
        exit 1
    fi
else
    echo "[$(date)] ❌ nginx container not found" >> "$LOG_FILE"
    exit 1
fi
EOF

    sudo chmod +x "$DEPLOY_HOOK"

    log "✅ Deploy hook created: $DEPLOY_HOOK"
    return 0
}

#==============================================================================
# CLEANUP
#==============================================================================

cleanup_certificates() {
    local domain="${1:-}"

    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Certificate Cleanup"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [[ -n "$domain" ]]; then
        # Remove specific domain
        log_info "Removing certificates for domain: $domain"

        if sudo certbot delete --cert-name "$domain" --non-interactive 2>&1 | tee -a "$CERTBOT_LOG"; then
            log "✅ Certificate removed successfully"
        else
            log_error "Failed to remove certificate"
            return 1
        fi
    else
        # List all certificates
        log_info "Listing all certificates:"
        sudo certbot certificates 2>/dev/null || log_warn "No certificates found"
    fi

    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    return 0
}

#==============================================================================
# MAIN COMMANDS
#==============================================================================

cmd_obtain() {
    local domain="$1"
    local email="$2"
    local server_ip="$3"

    if [[ -z "$domain" || -z "$email" || -z "$server_ip" ]]; then
        log_error "Missing required parameters"
        echo ""
        echo "Usage: $0 obtain <domain> <email> <server_ip>"
        echo ""
        echo "Example:"
        echo "  $0 obtain budget.example.com admin@example.com 1.2.3.4"
        return 1
    fi

    # Install certbot
    install_certbot || return 1

    # Validate DNS
    validate_domain_dns "$domain" "$server_ip" || return 1

    # Obtain certificate
    obtain_certificate "$domain" "$email" || return 1

    # Setup auto-renewal
    setup_auto_renewal || return 1

    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "✅ SSL certificate setup completed successfully!"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    return 0
}

cmd_renew() {
    local domain="$1"

    if [[ -z "$domain" ]]; then
        log_error "Missing domain parameter"
        echo ""
        echo "Usage: $0 renew <domain>"
        return 1
    fi

    renew_certificate "$domain"
}

cmd_check() {
    local domain="$1"

    if [[ -z "$domain" ]]; then
        log_error "Missing domain parameter"
        echo ""
        echo "Usage: $0 check <domain>"
        return 1
    fi

    show_certificate_info "$domain"
    echo ""
    validate_certificate "$domain"
}

cmd_cleanup() {
    local domain="${1:-}"
    cleanup_certificates "$domain"
}

cmd_install() {
    install_certbot
}

cmd_setup_cron() {
    setup_auto_renewal
}

#==============================================================================
# USAGE
#==============================================================================

show_usage() {
    cat <<EOF
Family Budget SSL Certificate Manager v1.0.0

USAGE:
  sudo $0 <command> [options]

COMMANDS:
  obtain <domain> <email> <server_ip>   Obtain new SSL certificate
  renew <domain>                        Renew existing certificate
  check <domain>                        Check certificate status
  cleanup [domain]                      Remove certificate(s)
  install                               Install certbot
  setup-cron                            Setup auto-renewal cron jobs
  help                                  Show this help

EXAMPLES:
  # Obtain certificate
  sudo $0 obtain budget.example.com admin@example.com 1.2.3.4

  # Renew certificate
  sudo $0 renew budget.example.com

  # Check certificate status
  sudo $0 check budget.example.com

  # Setup auto-renewal
  sudo $0 setup-cron

  # Remove certificate
  sudo $0 cleanup budget.example.com

NOTES:
  - Certbot must be installed (use 'install' command)
  - Port 80 must be accessible for HTTP-01 challenge
  - nginx container will be temporarily stopped during certificate acquisition
  - Auto-renewal runs twice daily (00:00 and 12:00 UTC)

EOF
}

#==============================================================================
# MAIN
#==============================================================================

main() {
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run with sudo"
        exit 1
    fi

    local command="${1:-help}"

    case "$command" in
        obtain)
            shift
            cmd_obtain "$@"
            ;;
        renew)
            shift
            cmd_renew "$@"
            ;;
        check)
            shift
            cmd_check "$@"
            ;;
        cleanup)
            shift
            cmd_cleanup "$@"
            ;;
        install)
            cmd_install
            ;;
        setup-cron)
            cmd_setup_cron
            ;;
        help|--help|-h)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main if script is executed (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
