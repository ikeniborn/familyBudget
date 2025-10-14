#!/bin/bash
################################################################################
# Family Budget - Backup Health Check Script
################################################################################
#
# Description:
#   Monitors backup status and alerts on issues.
#   Can be run manually or integrated into monitoring systems.
#
# Usage:
#   ./scripts/check_backup_health.sh [--json] [--quiet]
#
# Options:
#   --json     Output results in JSON format
#   --quiet    Suppress normal output (errors only)
#
# Exit Codes:
#   0 - All checks passed
#   1 - Warning: Minor issues detected
#   2 - Critical: Backup failed or missing
#   3 - Configuration error
#
# Integration Examples:
#   # Cron monitoring (alert on failure)
#   */30 * * * * /opt/familybudget/scripts/check_backup_health.sh --quiet || echo "Backup health check failed" | mail -s "Alert" admin@example.com
#
#   # Nagios/Icinga
#   command[check_backup]=/opt/familybudget/scripts/check_backup_health.sh --json
#
#   # Prometheus node_exporter textfile collector
#   ./check_backup_health.sh --json > /var/lib/node_exporter/textfile_collector/backup_health.prom
#
# TASK-052: Cron Job Setup for Backups (EPIC-005)
################################################################################

set -e

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
LOG_DIR="${LOG_DIR:-${BACKUP_DIR}/logs}"

# Thresholds
MAX_BACKUP_AGE_HOURS=26  # Alert if last backup older than 26 hours
MIN_BACKUP_SIZE_KB=100   # Alert if backup smaller than 100KB
WARN_DISK_USAGE_PERCENT=80  # Warn if disk usage above 80%
CRIT_DISK_USAGE_PERCENT=90  # Critical if disk usage above 90%

# Options
JSON_OUTPUT=false
QUIET_MODE=false

# Status tracking
CHECKS_PASSED=0
CHECKS_WARNING=0
CHECKS_CRITICAL=0
EXIT_CODE=0

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# ============================================================================
# Functions
# ============================================================================

log_check() {
    local status=$1
    local message=$2

    case $status in
        "PASS")
            ((CHECKS_PASSED++))
            if [ "$QUIET_MODE" = false ]; then
                echo -e "${GREEN}✓${NC} $message"
            fi
            ;;
        "WARN")
            ((CHECKS_WARNING++))
            EXIT_CODE=1
            echo -e "${YELLOW}⚠${NC} WARNING: $message" >&2
            ;;
        "CRIT")
            ((CHECKS_CRITICAL++))
            EXIT_CODE=2
            echo -e "${RED}✗${NC} CRITICAL: $message" >&2
            ;;
    esac
}

check_backup_exists() {
    local today=$(date +%Y%m%d)
    local backup_count=$(find "$BACKUP_DIR" -name "backup_${today}_*.sql.gz" 2>/dev/null | wc -l)

    if [ $backup_count -gt 0 ]; then
        log_check "PASS" "Backup exists for today ($backup_count file(s))"
        return 0
    else
        log_check "CRIT" "No backup found for today ($today)"
        return 1
    fi
}

check_backup_age() {
    local latest_backup=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f 2>/dev/null | sort -r | head -1)

    if [ -z "$latest_backup" ]; then
        log_check "CRIT" "No backups found in $BACKUP_DIR"
        return 1
    fi

    local backup_age_seconds=$(( $(date +%s) - $(stat -c %Y "$latest_backup") ))
    local backup_age_hours=$(( backup_age_seconds / 3600 ))

    if [ $backup_age_hours -le $MAX_BACKUP_AGE_HOURS ]; then
        log_check "PASS" "Latest backup is ${backup_age_hours}h old (threshold: ${MAX_BACKUP_AGE_HOURS}h)"
        return 0
    else
        log_check "CRIT" "Latest backup is ${backup_age_hours}h old (threshold: ${MAX_BACKUP_AGE_HOURS}h)"
        return 1
    fi
}

check_backup_size() {
    local latest_backup=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f 2>/dev/null | sort -r | head -1)

    if [ -z "$latest_backup" ]; then
        # Already reported by check_backup_age
        return 1
    fi

    local backup_size_kb=$(du -k "$latest_backup" | cut -f1)

    if [ $backup_size_kb -ge $MIN_BACKUP_SIZE_KB ]; then
        local backup_size_mb=$(( backup_size_kb / 1024 ))
        log_check "PASS" "Backup size is ${backup_size_mb}MB (threshold: ${MIN_BACKUP_SIZE_KB}KB)"
        return 0
    else
        log_check "WARN" "Backup size is ${backup_size_kb}KB (threshold: ${MIN_BACKUP_SIZE_KB}KB)"
        return 1
    fi
}

check_backup_count() {
    local backup_count=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f 2>/dev/null | wc -l)

    if [ $backup_count -gt 0 ]; then
        log_check "PASS" "Total backups: $backup_count"
        return 0
    else
        log_check "CRIT" "No backups found in $BACKUP_DIR"
        return 1
    fi
}

check_log_errors() {
    local today=$(date +%Y%m%d)
    local log_file="${LOG_DIR}/backup_${today}.log"

    if [ ! -f "$log_file" ]; then
        log_check "WARN" "Today's log file not found: $log_file"
        return 1
    fi

    local error_count=$(grep -c "\[ERROR\]" "$log_file" 2>/dev/null || echo "0")

    if [ $error_count -eq 0 ]; then
        log_check "PASS" "No errors in today's log"
        return 0
    else
        log_check "WARN" "Found $error_count error(s) in today's log"
        return 1
    fi
}

check_disk_space() {
    local disk_usage=$(df "$BACKUP_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')

    if [ $disk_usage -ge $CRIT_DISK_USAGE_PERCENT ]; then
        log_check "CRIT" "Disk usage is ${disk_usage}% (critical threshold: ${CRIT_DISK_USAGE_PERCENT}%)"
        return 1
    elif [ $disk_usage -ge $WARN_DISK_USAGE_PERCENT ]; then
        log_check "WARN" "Disk usage is ${disk_usage}% (warning threshold: ${WARN_DISK_USAGE_PERCENT}%)"
        return 1
    else
        log_check "PASS" "Disk usage is ${disk_usage}% (thresholds: ${WARN_DISK_USAGE_PERCENT}%/${CRIT_DISK_USAGE_PERCENT}%)"
        return 0
    fi
}

check_s3_sync() {
    # Check if S3 is configured
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$S3_BUCKET_NAME" ]; then
        log_check "PASS" "S3 not configured (skipping)"
        return 0
    fi

    # Check if it's been more than 8 days since last Sunday
    local last_sunday=$(date -d "last sunday" +%Y%m%d)
    local days_since_sunday=$(( ( $(date +%s) - $(date -d "$last_sunday" +%s) ) / 86400 ))

    if [ $days_since_sunday -gt 8 ]; then
        log_check "WARN" "S3 sync overdue (last Sunday was $days_since_sunday days ago)"
        return 1
    else
        log_check "PASS" "S3 sync on schedule (last Sunday was $days_since_sunday days ago)"
        return 0
    fi
}

check_docker_container() {
    if ! command -v docker &> /dev/null; then
        log_check "WARN" "Docker not found (backup may fail)"
        return 1
    fi

    if docker compose -f "${PROJECT_ROOT}/docker-compose.yml" ps 2>/dev/null | grep -q postgres; then
        log_check "PASS" "PostgreSQL container is running"
        return 0
    else
        log_check "CRIT" "PostgreSQL container not running"
        return 1
    fi
}

generate_json_output() {
    local timestamp=$(date -Iseconds)
    local latest_backup=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f 2>/dev/null | sort -r | head -1)
    local backup_count=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f 2>/dev/null | wc -l)
    local disk_usage=$(df "$BACKUP_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')

    cat <<EOF
{
  "timestamp": "$timestamp",
  "status": {
    "overall": $([ $EXIT_CODE -eq 0 ] && echo '"healthy"' || echo '"unhealthy"'),
    "exit_code": $EXIT_CODE,
    "checks": {
      "passed": $CHECKS_PASSED,
      "warning": $CHECKS_WARNING,
      "critical": $CHECKS_CRITICAL
    }
  },
  "backups": {
    "count": $backup_count,
    "latest": "${latest_backup##*/}",
    "directory": "$BACKUP_DIR"
  },
  "disk": {
    "usage_percent": $disk_usage,
    "path": "$BACKUP_DIR"
  }
}
EOF
}

print_summary() {
    if [ "$JSON_OUTPUT" = true ]; then
        generate_json_output
        return
    fi

    echo ""
    echo "========================================"
    echo "Backup Health Check Summary"
    echo "========================================"
    echo "Checks passed:    $CHECKS_PASSED"
    echo "Checks warning:   $CHECKS_WARNING"
    echo "Checks critical:  $CHECKS_CRITICAL"
    echo ""

    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}Overall Status: HEALTHY${NC}"
    elif [ $EXIT_CODE -eq 1 ]; then
        echo -e "${YELLOW}Overall Status: WARNING${NC}"
    else
        echo -e "${RED}Overall Status: CRITICAL${NC}"
    fi

    echo "========================================"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --json)
                JSON_OUTPUT=true
                shift
                ;;
            --quiet)
                QUIET_MODE=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--json] [--quiet]"
                exit 3
                ;;
        esac
    done

    # Run checks
    check_backup_exists
    check_backup_age
    check_backup_size
    check_backup_count
    check_log_errors
    check_disk_space
    check_s3_sync
    check_docker_container

    # Print summary
    print_summary

    exit $EXIT_CODE
}

# Run main
main "$@"
