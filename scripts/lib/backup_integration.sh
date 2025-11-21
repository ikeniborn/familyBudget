#!/bin/bash
#
# backup_integration.sh - Backup Integration
#
# Module for integrating with backup script
#
# Dependencies: config.sh, utils.sh
#

# Setup backup cron job
setup_backup_cron() {
    step "Setting up Backup Automation"

    # Check if backup script exists
    if [[ ! -f "$DEPLOY_DIR/scripts/backup.sh" ]]; then
        warning "Backup script not found at $DEPLOY_DIR/scripts/backup.sh"
        info "Backup automation will not be configured"
        return 0
    fi

    # Source .env to check backup configuration
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    # Check if S3 backup is configured (optional)
    if [[ -n "${S3_BUCKET_NAME:-}" ]] && [[ -n "${S3_ACCESS_KEY_ID:-}" ]]; then
        info "S3 backup is configured: s3://${S3_BUCKET_NAME}"
        info "Daily S3 uploads will occur automatically"
    else
        info "S3 backup not configured - only local backups will be created"
        info "To enable S3: configure S3_BUCKET_NAME, S3_ACCESS_KEY_ID in .env"
    fi

    # Add cron job for daily backups at 2 AM (works with or without S3)
    # IMPORTANT: Uses absolute paths (no sudo needed - cron runs as root)
    local cron_cmd="0 2 * * * /bin/bash $DEPLOY_DIR/scripts/backup.sh >> $DEPLOY_DIR/logs/backup.log 2>&1"

    # Remove any existing backup.sh cron entries (to avoid duplicates on redeploy)
    local existing_cron=$(crontab -l 2>/dev/null || true)
    local updated_cron=$(echo "$existing_cron" | grep -v "scripts/backup.sh" || true)

    # Check if we actually removed something
    if [[ "$existing_cron" != "$updated_cron" ]]; then
        info "Removing old backup cron job(s)..."
    fi

    # Add new cron entry
    (echo "$updated_cron"; echo "$cron_cmd") | crontab -
    success "Backup cron job configured (daily at 2 AM)"
}
