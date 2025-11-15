#!/bin/bash
################################################################################
# Family Budget - Backup Automation Setup Script
################################################################################
#
# Description:
#   Interactive setup for automated backups using systemd or cron.
#
# Usage:
#   sudo ./scripts/setup_automation.sh
#
# Options:
#   --systemd     Force systemd timer (default if available)
#   --cron        Force cron job
#   --uninstall   Remove automation
#
# TASK-052: Cron Job Setup for Backups (EPIC-005)
################################################################################

set -e

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="/opt/familybudget"
LOG_DIR="/var/log/familybudget"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Options
FORCE_SYSTEMD=false
FORCE_CRON=false
UNINSTALL=false

# ============================================================================
# Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Family Budget - Backup Automation Setup${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root"
        echo "Please run: sudo $0"
        exit 1
    fi
    print_success "Running as root"
}

check_systemd() {
    if command -v systemctl &> /dev/null && systemctl --version &> /dev/null; then
        return 0
    else
        return 1
    fi
}

detect_automation_system() {
    print_info "Detecting automation system..."

    if [ "$FORCE_CRON" = true ]; then
        echo "cron"
        return
    fi

    if [ "$FORCE_SYSTEMD" = true ]; then
        if check_systemd; then
            echo "systemd"
        else
            print_error "systemd not available but --systemd flag set"
            exit 1
        fi
        return
    fi

    # Auto-detect
    if check_systemd; then
        print_info "systemd detected (recommended)"
        echo "systemd"
    else
        print_info "systemd not available, using cron"
        echo "cron"
    fi
}

check_project_location() {
    print_info "Checking project location..."

    if [ "$PROJECT_ROOT" != "$INSTALL_DIR" ]; then
        print_warning "Project is not in $INSTALL_DIR"
        print_warning "Current location: $PROJECT_ROOT"
        echo ""
        read -p "Move project to $INSTALL_DIR? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Moving project to $INSTALL_DIR..."
            mkdir -p "$(dirname "$INSTALL_DIR")"
            cp -r "$PROJECT_ROOT" "$INSTALL_DIR"
            PROJECT_ROOT="$INSTALL_DIR"
            print_success "Project moved to $INSTALL_DIR"
        else
            print_warning "Keeping project in $PROJECT_ROOT"
            print_warning "You'll need to update paths in service/cron files"
            INSTALL_DIR="$PROJECT_ROOT"
        fi
    else
        print_success "Project is in $INSTALL_DIR"
    fi
}

create_log_directory() {
    print_info "Creating log directory..."

    mkdir -p "$LOG_DIR"
    chmod 755 "$LOG_DIR"

    print_success "Log directory created: $LOG_DIR"
}

install_systemd_timer() {
    print_info "Installing systemd timer..."

    # Copy service and timer files
    cp "$SCRIPT_DIR/systemd/familybudget-backup.service" /etc/systemd/system/
    cp "$SCRIPT_DIR/systemd/familybudget-backup.timer" /etc/systemd/system/

    # Update paths in service file
    sed -i "s|/opt/familybudget|$INSTALL_DIR|g" /etc/systemd/system/familybudget-backup.service

    # Reload systemd
    systemctl daemon-reload

    # Enable and start timer
    systemctl enable familybudget-backup.timer
    systemctl start familybudget-backup.timer

    print_success "systemd timer installed and started"
    echo ""
    print_info "Timer status:"
    systemctl status familybudget-backup.timer --no-pager || true
    echo ""
    print_info "Next run:"
    systemctl list-timers familybudget-backup.timer --no-pager || true
}

install_cron_job() {
    print_info "Installing cron job..."

    # Copy cron file
    cp "$SCRIPT_DIR/cron/familybudget-backup.cron" /etc/cron.d/familybudget-backup

    # Update paths
    sed -i "s|/opt/familybudget|$INSTALL_DIR|g" /etc/cron.d/familybudget-backup

    # Set permissions
    chmod 644 /etc/cron.d/familybudget-backup

    # Restart cron service
    if systemctl is-active --quiet cron; then
        systemctl restart cron
    elif systemctl is-active --quiet crond; then
        systemctl restart crond
    fi

    print_success "Cron job installed"
    echo ""
    print_info "Cron job content:"
    cat /etc/cron.d/familybudget-backup
}

install_logrotate() {
    print_info "Installing logrotate configuration..."

    if [ ! -d /etc/logrotate.d ]; then
        print_warning "logrotate not installed, skipping"
        return
    fi

    # Copy logrotate config
    cp "$SCRIPT_DIR/logrotate/familybudget" /etc/logrotate.d/familybudget

    # Update paths
    sed -i "s|/opt/familybudget|$INSTALL_DIR|g" /etc/logrotate.d/familybudget

    # Set permissions
    chmod 644 /etc/logrotate.d/familybudget

    # Test configuration
    if logrotate -d /etc/logrotate.d/familybudget &> /dev/null; then
        print_success "logrotate configuration installed"
    else
        print_warning "logrotate configuration may have issues"
    fi
}

test_backup() {
    print_info "Testing backup script..."
    echo ""

    read -p "Run test backup now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$INSTALL_DIR"

        # Load environment
        if [ -f .env ]; then
            set -a
            source .env
            set +a
        else
            print_warning ".env file not found, backup may fail"
        fi

        # Run backup in verbose mode
        if ./scripts/backup.sh --verbose; then
            print_success "Test backup completed successfully"
        else
            print_error "Test backup failed"
            print_info "Check logs in $INSTALL_DIR/backups/logs/"
        fi
    else
        print_info "Skipping test backup"
    fi
}

uninstall_automation() {
    print_info "Uninstalling backup automation..."

    # Remove systemd files
    if [ -f /etc/systemd/system/familybudget-backup.timer ]; then
        systemctl stop familybudget-backup.timer 2>/dev/null || true
        systemctl disable familybudget-backup.timer 2>/dev/null || true
        rm -f /etc/systemd/system/familybudget-backup.timer
        rm -f /etc/systemd/system/familybudget-backup.service
        systemctl daemon-reload
        print_success "systemd timer removed"
    fi

    # Remove cron job
    if [ -f /etc/cron.d/familybudget-backup ]; then
        rm -f /etc/cron.d/familybudget-backup
        print_success "Cron job removed"
    fi

    # Remove logrotate config (optional)
    read -p "Remove logrotate configuration? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f /etc/logrotate.d/familybudget
        print_success "logrotate configuration removed"
    fi

    # Keep logs
    print_info "Logs preserved in $LOG_DIR"
    print_info "Backups preserved in $INSTALL_DIR/backups"

    print_success "Automation uninstalled"
}

print_summary() {
    local automation_type=$1

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Installation Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Automation type: $automation_type"
    echo "Project location: $INSTALL_DIR"
    echo "Log directory: $LOG_DIR"
    echo "Backup directory: $INSTALL_DIR/backups"
    echo ""

    if [ "$automation_type" = "systemd" ]; then
        echo "Useful commands:"
        echo "  systemctl status familybudget-backup.timer   # Check timer status"
        echo "  systemctl list-timers                        # List all timers"
        echo "  journalctl -u familybudget-backup.service    # View logs"
        echo "  systemctl start familybudget-backup.service  # Run backup now"
    else
        echo "Useful commands:"
        echo "  cat /etc/cron.d/familybudget-backup          # View cron job"
        echo "  tail -f /var/log/familybudget/cron.log       # View cron logs"
        echo "  cd $INSTALL_DIR && ./scripts/backup.sh       # Run backup manually"
    fi

    echo ""
    echo "Backup schedule: Daily at 2:00 AM"
    echo "Local retention: 7 days"
    echo "S3 upload: Weekly (Sundays)"
    echo ""
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --systemd)
                FORCE_SYSTEMD=true
                shift
                ;;
            --cron)
                FORCE_CRON=true
                shift
                ;;
            --uninstall)
                UNINSTALL=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--systemd | --cron | --uninstall]"
                exit 1
                ;;
        esac
    done

    print_header

    # Check root
    check_root

    # Uninstall if requested
    if [ "$UNINSTALL" = true ]; then
        uninstall_automation
        exit 0
    fi

    # Detect automation system
    AUTOMATION_TYPE=$(detect_automation_system)
    print_success "Using $AUTOMATION_TYPE for automation"

    # Check project location
    check_project_location

    # Create log directory
    create_log_directory

    # Install automation
    if [ "$AUTOMATION_TYPE" = "systemd" ]; then
        install_systemd_timer
    else
        install_cron_job
    fi

    # Install logrotate
    install_logrotate

    # Test backup
    test_backup

    # Print summary
    print_summary "$AUTOMATION_TYPE"

    print_success "Setup complete!"
    echo ""
}

# Run main
main "$@"
