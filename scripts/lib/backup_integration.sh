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
        info "Weekly S3 uploads will occur on Sundays"
    else
        info "S3 backup not configured - only local backups will be created"
        info "To enable S3: configure S3_BUCKET_NAME, S3_ACCESS_KEY_ID in .env"
    fi

    # Add cron job for daily backups at 2 AM (works with or without S3)
    local cron_cmd="0 2 * * * cd $DEPLOY_DIR && bash scripts/backup.sh >> logs/backup.log 2>&1"

    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "$DEPLOY_DIR/scripts/backup.sh"; then
        info "Backup cron job already exists"
    else
        (crontab -l 2>/dev/null; echo "$cron_cmd") | crontab -
        success "Backup cron job added (daily at 2 AM)"
    fi
}
