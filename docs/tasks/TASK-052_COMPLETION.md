# TASK-052: Cron Job Setup for Backups - Completion Report

**Epic:** EPIC-005 - Admin & Automation
**Status:** ✅ Completed
**Date:** 2025-10-14
**Effort:** 6h (estimated)

---

## Task Summary

Created comprehensive automation infrastructure for the PostgreSQL backup system, supporting both modern systemd timers and traditional cron jobs. Includes log rotation, health monitoring, and automated setup scripts.

---

## Deliverables

### 1. Systemd Integration

**Files:**
- `scripts/systemd/familybudget-backup.service` - Systemd service unit
- `scripts/systemd/familybudget-backup.timer` - Timer unit for scheduling

**Features:**
- ✅ Daily execution at 2:00 AM
- ✅ Runs 10 minutes after boot if system was off
- ✅ Persistent timer (runs missed executions after reboot)
- ✅ Randomized delay (0-5 minutes) to spread system load
- ✅ Resource limits (50% CPU quota, 512MB memory limit)
- ✅ Security hardening (PrivateTmp, NoNewPrivileges)
- ✅ Timeout protection (1 hour max)
- ✅ Logging to `/var/log/familybudget/`

**Timer Configuration:**
```ini
[Timer]
OnCalendar=*-*-* 02:00:00  # Daily at 2 AM
OnBootSec=10min             # 10 min after boot
Persistent=true             # Run missed timers
AccuracySec=15min           # Allow 15min delay
RandomizedDelaySec=5min     # Randomize 0-5min
```

### 2. Cron Integration

**Files:**
- `scripts/cron/familybudget-backup.cron` - Cron job definition

**Features:**
- ✅ Daily execution at 2:00 AM
- ✅ Environment variable loading from `.env`
- ✅ Logging to `/var/log/familybudget/cron.log`
- ✅ Compatible with `/etc/cron.d/` and `crontab -e`

**Cron Schedule:**
```bash
0 2 * * * root cd /opt/familybudget && set -a && source .env && set +a && ./scripts/backup.sh >> /var/log/familybudget/cron.log 2>&1
```

### 3. Log Rotation

**File:** `scripts/logrotate/familybudget`

**Features:**
- ✅ Daily rotation for application logs
- ✅ 30-day retention
- ✅ Compression (gzip)
- ✅ Date-based naming (`backup-20251014.log.gz`)
- ✅ Separate rules for backup logs, cron logs
- ✅ Permissions: 0640 root:root

**Rotation Schedules:**
```
/var/log/familybudget/*.log         # Daily, 30 rotations
/opt/familybudget/backups/logs/*.log # Daily, 30 rotations
/var/log/familybudget/cron.log      # Weekly, 12 rotations
```

### 4. Setup Script

**File:** `scripts/setup_automation.sh` (~400 lines)

**Features:**
- ✅ Interactive installation wizard
- ✅ Auto-detection of systemd vs cron
- ✅ Project location management
- ✅ Log directory creation
- ✅ File permission setup
- ✅ Test backup execution
- ✅ Uninstallation support
- ✅ Colored output with status indicators

**Usage:**
```bash
sudo ./scripts/setup_automation.sh         # Auto-detect
sudo ./scripts/setup_automation.sh --systemd  # Force systemd
sudo ./scripts/setup_automation.sh --cron     # Force cron
sudo ./scripts/setup_automation.sh --uninstall # Remove
```

### 5. Health Check Script

**File:** `scripts/check_backup_health.sh` (~350 lines)

**Features:**
- ✅ 8 automated health checks
- ✅ JSON output mode (for monitoring integration)
- ✅ Quiet mode (for cron jobs)
- ✅ Exit codes for alerting (0=healthy, 1=warning, 2=critical)
- ✅ Color-coded console output
- ✅ Configurable thresholds

**Health Checks:**
1. Backup exists for today
2. Latest backup age (< 26 hours)
3. Backup size (> 100KB)
4. Total backup count
5. Log file errors
6. Disk space usage (warn 80%, crit 90%)
7. S3 sync status
8. Docker container status

**Usage:**
```bash
./scripts/check_backup_health.sh            # Normal output
./scripts/check_backup_health.sh --json     # JSON output
./scripts/check_backup_health.sh --quiet    # Errors only
```

---

## Acceptance Criteria Validation

**From TASK-052 and FR-050 (PRD.md):**

| # | Criterion | Status | Validation |
|---|-----------|--------|------------|
| 1 | Cron задача для автоматического запуска | ✅ | `familybudget-backup.cron` with daily schedule |
| 2 | Systemd timer как альтернатива | ✅ | `familybudget-backup.timer` + `.service` |
| 3 | Log rotation настроена | ✅ | `/etc/logrotate.d/familybudget` with 30-day retention |
| 4 | Автоматическая установка | ✅ | `setup_automation.sh` interactive wizard |
| 5 | Мониторинг и health checks | ✅ | `check_backup_health.sh` with 8 checks |
| 6 | Документация | ✅ | Comprehensive README updates |

---

## Technical Implementation

### Systemd Timer Flow

```
systemd.timer (familybudget-backup.timer)
  │
  ├─ Trigger: Daily at 2:00 AM
  ├─ Trigger: 10 min after boot (if missed)
  └─ Starts: familybudget-backup.service
               │
               ├─ Load: /opt/familybudget/.env
               ├─ Execute: /opt/familybudget/scripts/backup.sh
               ├─ Log: /var/log/familybudget/backup.log
               └─ Resource limits: 50% CPU, 512MB RAM
```

### Cron Job Flow

```
cron daemon
  │
  ├─ Schedule: 0 2 * * * (2:00 AM daily)
  └─ Execute: /etc/cron.d/familybudget-backup
               │
               ├─ Change dir: cd /opt/familybudget
               ├─ Load env: source .env
               ├─ Run: ./scripts/backup.sh
               └─ Log: /var/log/familybudget/cron.log
```

### Log Rotation Flow

```
logrotate (daily via /etc/cron.daily/)
  │
  └─ Config: /etc/logrotate.d/familybudget
               │
               ├─ Rotate: /var/log/familybudget/*.log
               ├─ Rotate: /opt/familybudget/backups/logs/*.log
               ├─ Compress: gzip
               ├─ Date suffix: -YYYYMMDD
               └─ Delete: > 30 days
```

### Health Check Integration

```
check_backup_health.sh
  │
  ├─ Mode: Manual, Cron, or Monitoring System
  │
  ├─ Checks (8):
  │   1. Backup exists today
  │   2. Backup age < 26h
  │   3. Backup size > 100KB
  │   4. Total backups > 0
  │   5. No log errors
  │   6. Disk usage < 90%
  │   7. S3 sync on schedule
  │   8. Docker container running
  │
  └─ Output:
      ├─ Console: Color-coded status
      ├─ JSON: Monitoring integration
      └─ Exit code: 0/1/2 (healthy/warn/crit)
```

---

## Installation Guide

### Quick Install (Recommended)

```bash
# 1. Clone/copy project to /opt/familybudget
sudo mkdir -p /opt
sudo cp -r /path/to/project /opt/familybudget

# 2. Set up environment
cd /opt/familybudget
cp scripts/.env.example .env
nano .env  # Configure POSTGRES_USER, POSTGRES_DB, etc.

# 3. Run setup wizard
sudo ./scripts/setup_automation.sh

# 4. Verify installation
# For systemd:
systemctl status familybudget-backup.timer
systemctl list-timers familybudget-backup.timer

# For cron:
cat /etc/cron.d/familybudget-backup
tail -f /var/log/familybudget/cron.log
```

### Manual Install - Systemd

```bash
# Copy service files
sudo cp scripts/systemd/familybudget-backup.service /etc/systemd/system/
sudo cp scripts/systemd/familybudget-backup.timer /etc/systemd/system/

# Update paths if needed
sudo sed -i 's|/opt/familybudget|/your/path|g' /etc/systemd/system/familybudget-backup.service

# Reload and enable
sudo systemctl daemon-reload
sudo systemctl enable familybudget-backup.timer
sudo systemctl start familybudget-backup.timer

# Check status
systemctl status familybudget-backup.timer
```

### Manual Install - Cron

```bash
# Copy cron file
sudo cp scripts/cron/familybudget-backup.cron /etc/cron.d/familybudget-backup

# Update paths if needed
sudo sed -i 's|/opt/familybudget|/your/path|g' /etc/cron.d/familybudget-backup

# Set permissions
sudo chmod 644 /etc/cron.d/familybudget-backup

# Verify
cat /etc/cron.d/familybudget-backup
```

### Manual Install - Logrotate

```bash
# Copy logrotate config
sudo cp scripts/logrotate/familybudget /etc/logrotate.d/familybudget

# Update paths if needed
sudo sed -i 's|/opt/familybudget|/your/path|g' /etc/logrotate.d/familybudget

# Set permissions
sudo chmod 644 /etc/logrotate.d/familybudget

# Test configuration
sudo logrotate -d /etc/logrotate.d/familybudget
```

---

## Usage Examples

### Systemd Commands

```bash
# Check timer status
systemctl status familybudget-backup.timer

# List all timers
systemctl list-timers

# View next scheduled run
systemctl list-timers familybudget-backup.timer

# Run backup manually (immediate)
sudo systemctl start familybudget-backup.service

# View service logs
journalctl -u familybudget-backup.service -f

# Stop timer
sudo systemctl stop familybudget-backup.timer

# Disable timer
sudo systemctl disable familybudget-backup.timer
```

### Cron Commands

```bash
# View cron job
cat /etc/cron.d/familybudget-backup

# View cron logs
tail -f /var/log/familybudget/cron.log

# Test cron job manually
sudo bash /etc/cron.d/familybudget-backup

# Edit cron (alternative method)
sudo crontab -e
# Add: 0 2 * * * /opt/familybudget/scripts/backup.sh
```

### Health Check Commands

```bash
# Run health check
./scripts/check_backup_health.sh

# JSON output (for monitoring)
./scripts/check_backup_health.sh --json

# Quiet mode (errors only)
./scripts/check_backup_health.sh --quiet

# Exit code check
./scripts/check_backup_health.sh && echo "Healthy" || echo "Unhealthy"

# Integrate with cron (alert on failure)
*/30 * * * * /opt/familybudget/scripts/check_backup_health.sh --quiet || echo "Backup health check failed!" | mail -s "Alert" admin@example.com
```

### Log Rotation Commands

```bash
# View logrotate config
cat /etc/logrotate.d/familybudget

# Test configuration (dry run)
sudo logrotate -d /etc/logrotate.d/familybudget

# Force rotation
sudo logrotate -f /etc/logrotate.d/familybudget

# View rotated logs
ls -lh /var/log/familybudget/
ls -lh /opt/familybudget/backups/logs/
```

---

## Monitoring Integration

### Nagios/Icinga

```bash
# /etc/nagios/nrpe.cfg
command[check_backup]=/opt/familybudget/scripts/check_backup_health.sh --json
```

### Prometheus Node Exporter

```bash
# Textfile collector
*/5 * * * * /opt/familybudget/scripts/check_backup_health.sh --json > /var/lib/node_exporter/textfile_collector/backup_health.prom
```

### Custom Email Alerts

```bash
# Cron job for alerts
*/30 * * * * /opt/familybudget/scripts/check_backup_health.sh --quiet || echo "Backup health check failed at $(date)" | mail -s "[ALERT] Family Budget Backup" admin@example.com
```

### Telegram Notification (Future Enhancement)

```python
# Example integration with Telegram bot
import subprocess
import requests

result = subprocess.run(['/opt/familybudget/scripts/check_backup_health.sh', '--json'], capture_output=True)
if result.returncode != 0:
    requests.post(f'https://api.telegram.org/bot{TOKEN}/sendMessage', json={
        'chat_id': ADMIN_ID,
        'text': f'⚠️ Backup health check failed!\nExit code: {result.returncode}'
    })
```

---

## Testing

### Test Systemd Timer

```bash
# 1. Check timer is active
systemctl is-active familybudget-backup.timer

# 2. View next run time
systemctl list-timers familybudget-backup.timer

# 3. Run service manually
sudo systemctl start familybudget-backup.service

# 4. Check logs
journalctl -u familybudget-backup.service -n 50

# 5. Verify backup created
ls -lh /opt/familybudget/backups/backup_$(date +%Y%m%d)*.sql.gz
```

### Test Cron Job

```bash
# 1. Verify cron file exists
test -f /etc/cron.d/familybudget-backup && echo "OK" || echo "Missing"

# 2. Check syntax
cat /etc/cron.d/familybudget-backup

# 3. Run manually
sudo bash -c "cd /opt/familybudget && set -a && source .env && set +a && ./scripts/backup.sh"

# 4. Check cron logs
tail -20 /var/log/familybudget/cron.log

# 5. Verify backup
ls -lh /opt/familybudget/backups/
```

### Test Health Check

```bash
# 1. Run all checks
./scripts/check_backup_health.sh

# 2. Verify exit code
echo $?  # Should be 0 if healthy

# 3. JSON output
./scripts/check_backup_health.sh --json | jq '.'

# 4. Simulate failure (no backups)
mv backups backups.bak
./scripts/check_backup_health.sh
mv backups.bak backups
```

### Test Log Rotation

```bash
# 1. Dry run
sudo logrotate -d /etc/logrotate.d/familybudget

# 2. Force rotation
sudo logrotate -f /etc/logrotate.d/familybudget

# 3. Verify rotated files
ls -lh /var/log/familybudget/
ls -lh /opt/familybudget/backups/logs/

# 4. Check compression
file /var/log/familybudget/backup-*.log.gz
```

---

## Troubleshooting

### Systemd Timer Not Running

```bash
# Check timer status
systemctl status familybudget-backup.timer

# Check if enabled
systemctl is-enabled familybudget-backup.timer

# Enable if needed
sudo systemctl enable familybudget-backup.timer
sudo systemctl start familybudget-backup.timer

# Check for errors
journalctl -u familybudget-backup.timer -n 50
```

### Cron Job Not Executing

```bash
# Check cron service
systemctl status cron || systemctl status crond

# Check cron file permissions
ls -l /etc/cron.d/familybudget-backup  # Should be 644

# Check syslog for cron messages
grep CRON /var/log/syslog | tail -20

# Test manually
sudo bash /etc/cron.d/familybudget-backup
```

### Backups Not Created

```bash
# Check backup script manually
cd /opt/familybudget
set -a && source .env && set +a
./scripts/backup.sh --verbose

# Check Docker container
docker compose ps

# Check disk space
df -h /opt/familybudget

# Check permissions
ls -ld /opt/familybudget/backups
```

### Log Rotation Not Working

```bash
# Check logrotate status
sudo cat /var/lib/logrotate/status | grep familybudget

# Test configuration
sudo logrotate -d /etc/logrotate.d/familybudget

# Check for errors
sudo logrotate -v /etc/logrotate.d/familybudget

# Force run
sudo logrotate -f /etc/logrotate.d/familybudget
```

---

## Security Considerations

### File Permissions

```bash
# Service files
-rw-r--r-- /etc/systemd/system/familybudget-backup.service
-rw-r--r-- /etc/systemd/system/familybudget-backup.timer

# Cron file
-rw-r--r-- /etc/cron.d/familybudget-backup

# Scripts
-rwx------ /opt/familybudget/scripts/backup.sh
-rwx------ /opt/familybudget/scripts/check_backup_health.sh

# Environment file
-rw------- /opt/familybudget/.env

# Backup directory
drwx------ /opt/familybudget/backups

# Log directory
drwxr-x--- /var/log/familybudget
```

### Systemd Security Features

```ini
[Service]
PrivateTmp=yes           # Isolated /tmp
NoNewPrivileges=yes      # Prevent privilege escalation
CPUQuota=50%             # CPU limit
MemoryLimit=512M         # Memory limit
```

---

## Files Created

```
scripts/
├── systemd/
│   ├── familybudget-backup.service    # Systemd service unit
│   └── familybudget-backup.timer      # Systemd timer unit
├── cron/
│   └── familybudget-backup.cron       # Cron job definition
├── logrotate/
│   └── familybudget                   # Logrotate config
├── setup_automation.sh                # Setup wizard (400 lines)
└── check_backup_health.sh             # Health check script (350 lines)

# Installed to system:
/etc/systemd/system/familybudget-backup.service
/etc/systemd/system/familybudget-backup.timer
/etc/cron.d/familybudget-backup
/etc/logrotate.d/familybudget
/var/log/familybudget/
```

---

## Commit Details

**Commit Message:**
```
feat: Add backup automation with systemd/cron (TASK-052)

Comprehensive backup automation infrastructure:
- Systemd timer + service unit (daily 2 AM, persistent, resource limits)
- Cron job alternative (compatible with traditional systems)
- Log rotation (30-day retention, gzip compression)
- Setup wizard (interactive installation, auto-detection)
- Health check script (8 checks, JSON output, monitoring integration)

Files:
- scripts/systemd/* (2 files)
- scripts/cron/* (1 file)
- scripts/logrotate/* (1 file)
- scripts/setup_automation.sh (400 lines)
- scripts/check_backup_health.sh (350 lines)

Completes TASK-052: Cron Job Setup for Backups (EPIC-005)
```

---

## Status

✅ **TASK-052 COMPLETED**

**Next Task:** TASK-053 - Health Check Endpoints

---

**Document Version:** 1.0
**Date:** 2025-10-14
**Author:** Claude Code
**Status:** ✅ Verified and Complete
